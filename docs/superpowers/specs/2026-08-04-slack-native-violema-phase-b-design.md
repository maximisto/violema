# Slack-native Violema (Phase B): hear, understand, act — design

**Date:** 2026-08-04 (written ~1am after tester-day-one; execute with fresh eyes)
**Trigger:** Max replied to @Violema in his tenant Slack asking about the memo she had just delivered — no response, and the chat brain would have had no idea what he meant. His bar: *"fully context and user aware, able to talk specifics on his business using google drive docs, logs, and integrations — useful in business from day one, not a dummy."*

**Prime directive carried over from Phase A:** the deterministic verbs are the operating contract; a model outage degrades Violema-on-Slack to a chat bot, never to a bot that silently stops executing. Nothing below weakens that.

---

## 0. Verified current state (all confirmed in prod tonight)

| Fact | Evidence |
| --- | --- |
| The Violema Slack app is live for tenant SENDS (custom Composio auth config `ac_Gu8dV46q9pI9`, pinned via `COMPOSIO_AUTH_CONFIG_SLACKBOT`) | delivered memo in #violema-reviews under Violema identity |
| The app has NO event subscriptions — tenant mentions never reach us | manifest shipped send-only by design |
| `/api/slack/events` verifies ONE signing secret (internal PurpleOrangeHQ app) | `verifySlackSignature` reads `SLACK_SIGNING_SECRET` |
| Tenant team→workspace mapping doesn't exist (auth-user slack fields empty for Composio-connected tenants) | `resolveSlackEventWorkspace` found nothing for maximus.mark999 |
| The chat path is context-blind | breadcrumbs: `handling=chat`; the "search Slack for the review" reply |
| Every Slack delivery's `slack_ts` is stored in run/ledger records | delivery metadata + `slackReviewMessage` pattern |
| Operator-console data (missions/runs/reviews) is one call away | `buildSlackOperatorConsoleData` |
| Library sections are readable via existing gateway | `readAccountLibrarySection`, `summarizeLibrarySection` |

## 1. Objective and non-goals

**Objective:** in a tenant's own Slack workspace, @Violema (and DMs to her) can:
1. Hear — receive mentions/DMs from the tenant's workspace (the app we own).
2. Understand — know what she just sent in this thread, what missions/runs/reviews exist, what lives in the account library, which integrations are healthy.
3. Act — answer with specifics; run the deterministic verbs; never send anything new without the review gate.

**Non-goals (this phase):**
- No chat-initiated writes/sends outside existing verbs + review gates. Chat is read-and-explain; `run` remains the only executor and approval remains on cards/dashboard.
- No approve/request-changes buttons in tenant Slack yet — that is Phase B.2, same app, after this lands.
- No multi-workspace Slack app distribution (App Directory); single-workspace installs per tenant.

## 2. Architecture — three layers, shipped in order

### Layer A — Hearing (tenant events reach the router)

1. **Manifest update** (SLACK_APP_SETUP.md): add `event_subscriptions` — request URL `https://violema.com/api/slack/events`, bot events `app_mention`, `message.im`. Max reinstalls the app (scope set unchanged → one-click reauthorize; document that the Composio connection survives reinstall — verify, else reconnect).
2. **Multi-app signature verification.** New env `SLACK_SIGNING_SECRET_VIOLEMA` (the Violema app's signing secret — clipboard pattern for transport). `verifySlackSignature` becomes try-each-secret (internal first, then Violema app), constant-time per attempt, and returns WHICH app verified — the router needs the source app identity. Fail-closed: no match → 401 exactly as today.
3. **Tenant team→workspace mapping.** New module `slackTeamDirectory.ts`:
   - Store `slack-team-workspaces.json` (gitignored runtime data): `{ teamId, workspaceId, source: 'composio_connection' | 'manual', verifiedAt }`.
   - Resolution order in `resolveSlackEventWorkspace`: existing per-user channel mapping (internal surface, unchanged) → team directory (tenant surface).
   - Population: on event from an unknown team verified by the VIOLEMA secret, resolve lazily — call `SLACKBOT` toolkit (team info / auth test) per candidate workspace with an active slackbot connection and cache the match; plus a backfill script for existing connections. One team maps to exactly one workspace; a second claimant fails closed with a breadcrumb (`skipped=team_conflict`) — cross-tenant leakage is the disaster case, so ambiguity never guesses.
4. **Authorization model for tenant verbs:** workspace-scoped, NOT the internal operator allowlist. Reads (`status`, `reviews`, `latest`, chat) — any member of the tenant's Slack workspace (they are inside the customer's own Slack; the workspace owner invited the bot). `run` — require the Slack user to map to a workspace member: match Slack profile email (users.info via Composio) against workspace members; unmapped users get the read-only notice. Document this boundary in the spec review with Max — it is a product decision.
5. **Breadcrumbs carry the app source:** `[slack] event … app=internal|violema`.

### Layer B — Understanding (context assembly)

New module `backend/src/slack/chatContext.ts`:

```
buildSlackChatContext({ workspaceId, channel, threadTs, slackUserId }) → {
  threadProvenance?  // THE killer feature: join threadTs ↔ ledger deliveries
                     // (slack_ts / slackReviewMessage.ts) → run → mission name,
                     // brief title, delivered-at, evidence links, receipt status.
                     // "What did you just send me?" answers itself.
  missions[]         // name, status, schedule, last run, next run (console data)
  waitingReviews[]   // what needs the human, with card/dashboard pointers
  recentDeliveries[] // last N ledger deliveries: what went where, when
  library[]          // section titles + entry titles + dates ONLY (no bodies)
  integrations[]     // healthy / degraded / missing, from capability report
  user?              // display name if resolvable; never guessed
}
```

Rules:
- **Workspace-scoped by construction** — every reader takes `workspaceId` and nothing else; no cross-workspace fields exist in the shape.
- **Privacy budget:** titles, dates, statuses, links. No document bodies, no email bodies, no secrets — the ledger-metadata discipline applies to prompt context too. Brief BODIES are allowed only for `threadProvenance` of the exact thread being discussed (she is being asked about a message she already delivered there).
- **Token budget:** hard cap (~3k tokens serialized); overflow drops oldest `recentDeliveries` first, then library titles; never drops threadProvenance.
- `buildSlackIncomingReply` receives the serialized context as a system-side preamble. Prompt layering stays decoupled from business logic (context builder returns data; prompt assembly stays in the reply builder).

### Layer C — Acting (grounded answers, safe hands)

1. Chat replies cite what they know: "the memo above is run 5 of Competitor monitor, delivered 22:31, sources: …" — from context, not retrieval theater.
2. Asks that map to verbs get the verb result inline (already deterministic).
3. Asks to SEND anything → honest boundary: "I deliver through the review gate — say `run competitor monitor` and approve the draft" (never a direct chat-initiated send).
4. `message.im` DMs: same pipeline, `isDm` path already exists.

## 3. Failure modes (design-in, not patch-later)

| Failure | Behavior |
| --- | --- |
| Unknown team on Violema-app event | breadcrumb `skipped=unmapped_team`, no reply (never guess a workspace) |
| Two workspaces claim one team | fail closed + breadcrumb `team_conflict`, alert in ops log |
| Composio/Slack API down during context build | context degrades to console data (local stores); reply says what it couldn't see |
| Model outage | verbs still work (unchanged contract); chat replies "brain offline, verbs available" |
| Thread ts not found in ledger | provenance omitted; no fabrication — she says she can't see that message's origin |
| Signing secret misconfigured | 401s + breadcrumb; internal surface unaffected (separate secret) |

## 4. Testing

- Unit: multi-secret verification (right/wrong/absent, which-app attribution); team directory (populate, conflict, lazy resolution); chatContext assembly from fixtures (provenance join on slack_ts, budget truncation, privacy exclusions).
- Route-level (serverMagicLinkRoutes pattern): Violema-signed event end-to-end → breadcrumb + reply; unknown team fail-closed.
- Contract: "the reply to a thread references the run that produced the thread" — fixture ledger + thread ts.
- Live smoke (scripted, like tonight): synthetic signed event with the VIOLEMA secret against prod; then Max's one human test: reply to a delivered memo, get a grounded answer.

## 5. Rollout order (tomorrow)

1. **Warm-ups (independent, ~1h):** preflight bot-membership check (not_in_channel BEFORE approve); zombie-task boot sweep; `posted_as_violema` flag semantics for own-app connections.
2. **A. Hearing** — env + multi-secret verify + team directory + manifest update + Max reinstalls app (~his 2 min). Milestone: `@Violema status` answers in tenant Slack.
3. **B. Understanding** — chatContext + reply integration. Milestone: replying to a delivered memo yields a grounded, specific answer about that exact run.
4. **C. Polish** — DM pipeline check, breadcrumb fields, docs, vault.
5. Each milestone: gates green → Max's deploy word → live verification as the tester (the tonight method: mint session, real event, real thread).

**Estimate:** A ≈ half day, B ≈ half day, C ≈ 1–2h. One day of focused work, two deploy gates.

## 6. Decisions Max should confirm at review (before build)

1. Tenant read-access rule: ANY member of the tenant's Slack can read status/reviews/briefs via chat — acceptable? (Alternative: owner-only until membership mapping ships.)
2. `run` from tenant Slack: email-mapped members only (proposed) — or owner-only?
3. Thread provenance may quote the delivered brief's own content back into the thread it was delivered to — confirmed fine? (It is the same channel that already holds the content.)
4. Review-notice emails once cards ship in tenant Slack (B.2): keep both, or cards replace email?
