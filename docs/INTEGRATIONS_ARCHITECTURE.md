# VIOLEMA Integrations Architecture

This is the strategic plan for going from **mock tools** to **real integrations** that actually pull/push data from customer systems.

## Current state (Mar 2026)

VIOLEMA exposes 7 mock tools to Claude:
- `web_search`, `run_code`, `create_task`, `send_message`, `query_data`, `generate_report`, `schedule_automation`

Each tool returns **fabricated demo data** (fake Stripe MRR, fake HubSpot contacts, etc.). The chat experience is convincing but **nothing real happens**.

This document describes how to ship real integrations without burning 6 months of engineering time.

---

## Decision: Hybrid integration strategy

We will ship integrations in **two tiers**:

### Tier 1 — Hero integrations (custom-built)
Brand-defining integrations that need pixel-perfect UX, error handling, and trust:

- **Slack** (mention, DM, channel digest, file upload)
- **GitHub** (PR triage, issue creation, code search)
- **Stripe** (MRR, churn, customer lookup, dispute alerts)
- **HubSpot** (contact enrichment, deal updates, pipeline reports)
- **Linear** (task CRUD, sprint reports, blocker detection)

These get **native OAuth flows** in our app, custom storage, custom UX. ~1 week per integration.

### Tier 2 — Long-tail integrations (Composio)
Everything else (Notion, Asana, Trello, Salesforce, Jira, Google Workspace, Microsoft 365, Airtable, Discord, Zendesk, Intercom, Mailchimp, Calendly, etc.) — **250+ tools** delivered via [Composio](https://composio.dev/).

Composio handles:
- OAuth for every supported service
- Rate limiting, retries, error normalization
- Standardized tool schemas (compatible with Claude's tool format)
- Per-user/per-workspace credential storage
- Audit logs for compliance

Cost: free for ~200 tool calls/day, ~$50/mo for production scale.

---

## Why this split?

| | Tier 1 (custom) | Tier 2 (Composio) |
|---|---|---|
| Integrations | 5 hero tools | 250+ long-tail |
| Build time | 1 week each | Plug-and-play |
| Brand control | Total | Composio-mediated |
| Cost at scale | Engineering time | $50–500/mo |
| Customization | Unlimited | Limited to Composio surface |

Hero integrations are where customers **judge VIOLEMA**. Get them perfect. Long-tail integrations are where customers say *"oh and it also works with Notion"* — Composio is faster than building 250 OAuth flows.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Frontend                                               │
│  - /integrations page lists tier 1 + tier 2             │
│  - User clicks "Connect Slack" → OAuth                  │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Backend                                                │
│  ┌────────────────────┐    ┌─────────────────────────┐ │
│  │ Tier 1 dispatcher  │    │ Tier 2 (Composio SDK)   │ │
│  │ - slack.ts         │    │ - composio-core         │ │
│  │ - github.ts        │    │ - 250 tool schemas      │ │
│  │ - stripe.ts        │    │ - OAuth handled         │ │
│  │ - hubspot.ts       │    │                         │ │
│  │ - linear.ts        │    │                         │ │
│  └────────────────────┘    └─────────────────────────┘ │
│                          ↓                              │
│  Unified Tool Schema → Claude API (tool_use)            │
└─────────────────────────────────────────────────────────┘
                          ↓
                    External APIs
```

### Backend module layout
```
backend/src/integrations/
├── index.ts              # Unified tool registry
├── slack/
│   ├── oauth.ts
│   ├── client.ts
│   └── tools.ts          # send_message, get_channels, etc
├── github/...
├── stripe/...
├── hubspot/...
├── linear/...
└── composio/
    ├── client.ts         # Composio SDK wrapper
    └── tools.ts          # Auto-generated from Composio
```

---

## Per-integration credential storage

We need per-workspace, per-user storage for OAuth tokens.

```ts
// backend/src/integrations/credentialVault.ts
interface IntegrationCredential {
  workspaceId: string;
  userId: string;
  provider: 'slack' | 'github' | 'stripe' | 'hubspot' | 'linear' | 'composio';
  scope?: string;          // for Composio: the underlying tool
  accessToken: string;     // encrypted at rest
  refreshToken?: string;   // encrypted at rest
  expiresAt?: number;
  createdAt: number;
}
```

**Encryption**: AES-256 with a workspace-scoped key derived from a master KMS key.
**Rotation**: Refresh tokens auto-rotate; access tokens cycled at expiry-30s.
**Revocation**: User clicks "Disconnect" → tokens deleted + provider revoke endpoint hit.

---

## OAuth flow (tier 1 example: Slack)

```
1. User clicks "Connect Slack"
   GET /api/integrations/slack/start
   → 302 redirect to slack.com/oauth/v2/authorize?...&state=<csrf>

2. User approves on Slack
   Slack → GET /api/integrations/slack/callback?code=...&state=...

3. Backend exchanges code for tokens
   POST slack.com/api/oauth.v2.access
   → { access_token, team_id, ... }

4. Store in vault
   credentialVault.upsert({ workspaceId, provider: 'slack', accessToken: ... })

5. Redirect to /settings/integrations
   User sees "Slack: Connected ✓"
```

For Composio, **all of this is done by Composio's hosted OAuth UI**. We just embed their connect button and store the user's Composio entity ID.

---

## Tool execution flow

```ts
// backend/src/integrations/index.ts

const NATIVE_TOOLS: Record<string, ToolHandler> = {
  slack_send_message: slack.sendMessage,
  slack_get_channels: slack.getChannels,
  github_triage_pr: github.triagePR,
  // ... etc
};

async function executeTool(
  toolName: string,
  input: any,
  ctx: { workspaceId: string; userId: string }
) {
  // Try native first
  if (NATIVE_TOOLS[toolName]) {
    const creds = await credentialVault.get(ctx, toolName.split('_')[0]);
    if (!creds) throw new ToolError(`${toolName.split('_')[0]} not connected`);
    return NATIVE_TOOLS[toolName](input, creds);
  }

  // Fall back to Composio
  return composio.executeAction(toolName, input, { entityId: ctx.userId });
}
```

The Claude API call passes the **union of native + Composio tools** as available tools. Claude picks; we dispatch.

---

## Migration plan (from mock tools)

### Phase 1 (week 1) — Foundation
- [ ] Add `credentialVault.ts` with encrypted at-rest storage
- [ ] Add `/api/integrations/:provider/start` and `/callback` route handlers
- [ ] Build `/integrations` settings page UI (connect buttons, status, disconnect)
- [ ] Install Composio SDK; wire `composio.executeAction` fallback

### Phase 2 (weeks 2-3) — Hero integrations
- [ ] Slack: send_message, get_channels, send_dm
- [ ] GitHub: list_prs, triage_pr, create_issue
- [ ] Stripe: get_mrr, list_customers, get_disputes

### Phase 3 (week 4) — Composio rollout
- [ ] Enable Composio for all users
- [ ] Add tool discovery: `GET /api/integrations/available` lists all available tools
- [ ] Add per-tool usage tracking + cost attribution

### Phase 4 (week 5) — HubSpot + Linear native
- [ ] Native HubSpot integration (CRM-grade UX)
- [ ] Native Linear integration (sprint reports, task CRUD)

### Phase 5 (ongoing) — Advanced
- [ ] Custom MCP server hosting (for advanced enterprise customers)
- [ ] Integration marketplace for partner-built tools
- [ ] Webhook ingestion from connected tools (event-driven workflows)

---

## Cost projections

| Tier | Stage | Cost |
|---|---|---|
| Composio | Free tier | $0 (≤200 calls/day) |
| Composio | Growth | ~$50/mo (5K calls/day) |
| Composio | Scale | ~$500/mo (50K calls/day) |
| OAuth/SDK fees | All providers | $0 (free APIs at our scale) |
| Engineering | Tier 1 (5 integrations) | ~5 weeks of dev |
| Engineering | Tier 2 (Composio scaffold) | ~1 week of dev |

**Total to launch**: ~6 weeks of dev + ~$50/mo infrastructure.

---

## Open questions

1. **Composio vs. Pica vs. Pipedream Connect** — Composio is the most AI-agent-native, but Pica is a strong contender with simpler pricing. Should we POC both?
2. **Per-integration billing** — do we charge customers different credit amounts for different integrations? (Yes, recommend cost-based pricing.)
3. **Webhook ingestion** — when do we add inbound events? (Phase 5; not critical for MVP.)
4. **MCP servers** — when do we expose custom MCP servers for enterprise? (Phase 5+.)

---

## Why not just MCP?

The Model Context Protocol is great in theory but:
- Most customer tools (Slack, Stripe, etc.) don't have official MCP servers yet
- Building MCP servers per tool ≈ same effort as native integrations
- Composio + native is a faster path to market today

We'll layer MCP on later for **customer-built** tools — that's where MCP shines.
