# Violema Fresh Audit and Beta Readiness

Date: 2026-05-07

## Bottom line

Violema has enough real product substance to become a credible controlled beta, but it is not ready for a broad public or consumer beta yet.

The strongest path is not "more AI features." It is a sharper product wedge:

> Violema runs recurring operational workflows for founders and small teams, with visible outcomes, human control, and dependable delivery.

The current product already has meaningful pieces: public site, auth, dashboard, chat, recurring automations, Slack/email delivery, Stripe billing, credit accounting, model routing, web search, browser screenshots, task history, and an embedded Agent Studio. The problem is focus and trust. The product still tries to explain too much architecture, claims too much breadth, and hides too much of the reliability story users need before they let it act for them.

## Current reality

### What is real

- Live host is `https://nexus.purpleorange.io`.
- `violema.com` is not cut over yet. It still resolves through Hostinger parking and HTTPS fails.
- Backend health is live at `https://nexus.purpleorange.io/api/health`.
- Runtime integrations exist for model routing, Anthropic/OpenAI/OpenRouter/Mistral, Tavily web search, Slack, Postmark email, Stripe, recurring automations, browser screenshots, task runs, credit ledger, and Agent Studio read models.
- The frontend has public landing, signup, login, pricing, integrations, dashboard, billing, Slack setup, settings, and Agent Studio surfaces.

### What is not yet beta-grade

- Domain trust is not solved until `violema.com` serves the app with valid TLS, auth callbacks, Stripe returns, and cookies.
- Auth is still described internally as the highest-priority trust gap.
- The dashboard and Agent Studio surfaces are too large and cognitively heavy.
- Several major files are too big to iterate on safely:
  - `backend/src/server.ts`: 4,741 lines
  - `frontend/src/pages/Dashboard.tsx`: 4,266 lines
  - `frontend/src/pages/AgentStudio.tsx`: 9,358 lines
- Public messaging is stronger than before, but still broad: "AI coworker for real work" is usable, not ownable.
- The asset system is thin: Violema has a mark, icon, and Purple Orange logo, but no distinctive product imagery, workflow screenshots, investor demo frames, founder story visuals, or beta onboarding assets.
- Direct `/pricing` is blank because pricing is an anchored landing section while the actual app route is `/plans`.
- Some backend paths still support mock checkout fallback and mock provider tokens for unconfigured environments. That is useful for development but must be explicit in beta.

## Fresh positioning

Do not position Violema as a general AI coworker. That market is noisy and hard to trust.

Position it as:

> The AI operator for recurring founder work.

Sharper version:

> Violema turns recurring founder workflows into monitored runs, delivered outputs, and follow-through.

The product should own one boring but valuable loop:

1. Pick a recurring workflow.
2. Connect the minimum tools.
3. Run it once now.
4. Review the output.
5. Schedule it.
6. See every run, cost, failure, and delivery.

If that loop is excellent, investor and beta conversations become grounded. If that loop is weak, the rest reads as ambition without proof.

## Recommended first beta wedge

Start with founder/operator workflows, not consumers and not broad teams.

Best controlled-beta users:

- Max's own companies first.
- 3-5 friendly founders after that.
- Small teams with repeated work in Slack, email, Stripe, GitHub, docs, and web research.

Best first workflow categories:

1. Weekly investor / board update
   - Pull metrics and notes.
   - Search for relevant market/customer signals.
   - Draft update.
   - Send to Slack/email after approval.

2. Daily revenue / risk monitor
   - Check Stripe or supplied metrics.
   - Detect anomalies.
   - Summarize what changed.
   - Alert in Slack.

3. Fundraising intelligence brief
   - Monitor investors, competitors, target accounts, and market events.
   - Produce concise bullets and suggested follow-up.
   - Keep source links and run history.

Do not launch with 20 templates. Launch with 3 workflows that feel complete.

## Product improvements

### 1. Make the dashboard an operations inbox

The dashboard should answer four questions immediately:

- What is running?
- What finished?
- What needs my approval or attention?
- What should I automate next?

Reduce visible architecture. Move worker lanes, topology, promotion logic, and optimization controls behind an advanced path.

### 2. Make one workflow setup feel premium

The current workflow authoring direction is promising, but beta users need a guided path. Add a first-run wizard:

- choose workflow type
- connect or confirm destination
- review typed steps
- run once now
- approve output
- schedule recurring run

The first successful run is the real activation event.

### 3. Build trust surfaces before adding breadth

Every run should show:

- status
- steps executed
- tools used
- delivery target
- output
- source links / artifacts
- cost in Violema credits
- failure reason and retry path

This is what makes an AI operator investable: not just autonomy, but inspectable autonomy.

### 4. Reframe Agent Studio as internal / advanced

Agent Studio is valuable, but it should not be part of the first Violema user story.

For beta:

- Keep Agent Studio available to Max/admins.
- Hide it from default navigation.
- Let Violema receive policy improvements quietly.
- Do not make normal users understand topology, promotion, rollback, replay, or scenario math.

### 5. Make the brand fresher and less generic

The current visual system is competent but familiar: dark navy, violet, gradients, terminal mockups, cards, and "AI coworker" language. It looks plausible, but not fresh enough for investor-grade differentiation.

Keep:

- the Violema mark
- the orange/violet identity
- the premium dark interface base

Change:

- reduce generic purple SaaS gradients
- replace terminal mockups with real workflow/run visuals
- introduce an "operating table" visual motif: runs, evidence, delivery, approvals
- show real artifacts and outputs, not abstract capability cards
- use fewer broad claims and more proof-like surfaces

### 6. Fix domain and route trust

Before `violema.com` goes public:

- point `violema.com` and `www.violema.com` to the VPS
- terminate TLS correctly
- set final auth cookie and public origin envs
- update Google/Microsoft OAuth callbacks
- update Stripe success/cancel URLs
- redirect legacy `nexus.purpleorange.io` safely
- fix or redirect `/pricing` to `/plans` or `/#pricing`

## Investor-ready definition

Investor-ready does not mean every system is finished. It means the product can survive a serious demo without exposing avoidable weakness.

Minimum bar:

- `violema.com` loads with valid HTTPS.
- Signup/login works on final domain.
- A user can create or select one beta workflow.
- The workflow runs once.
- The output is delivered to Slack or email.
- Run history shows steps, artifacts, status, and cost.
- Billing and credit state are coherent.
- Failure states are understandable.
- Demo data is clearly labeled when demo data is used.
- Agent Studio is hidden unless intentionally shown as advanced/internal capability.

## Four-week execution path

### Week 1: Trust foundation

- Finish backend-owned auth and admin identity.
- Fix `violema.com` DNS/TLS/auth/Stripe cutover path.
- Add `/pricing` redirect or route.
- Remove or label mock paths from beta-facing UX.
- Define three beta workflows and their required inputs.

### Week 2: First workflow loop

- Build guided setup for one workflow category.
- Make "run once now" the central activation.
- Improve run results panel: steps, output, artifacts, delivery, cost, failure.
- Make Slack delivery setup less manual where possible.

### Week 3: Dashboard simplification

- Reframe dashboard as operations inbox.
- Hide Agent Studio/default architecture surfaces.
- Add attention states: needs approval, failed, ready, scheduled.
- Refactor the highest-risk dashboard sections while touching them.

### Week 4: Beta/investor demo hardening

- Create seeded demo workspace with real-looking but clearly labeled demo data.
- Prepare 3 investor demo scripts:
  - founder weekly update
  - revenue/risk monitor
  - fundraising intelligence brief
- Run smoke tests on final domain.
- Prepare beta onboarding doc and support path.

## What to avoid

- Do not broaden into generic "AI teammate for everything."
- Do not lead with multi-agent architecture.
- Do not ship a public beta while `violema.com` is parked or TLS-broken.
- Do not make Agent Studio feel required for normal users.
- Do not add more connectors until the first three workflow loops are reliable.
- Do not claim production readiness until real auth, run durability, billing, and domain cutover are verified.

## Recommended next move

Make Violema beta-ready around one flagship workflow:

> Weekly founder update: metrics, market notes, risks, wins, next asks, delivered to Slack/email with approval.

This is concrete, valuable, demoable, and directly useful for Max's own companies. It also creates investor-friendly proof: Violema is not a chatbot. It is an operator that turns recurring founder work into trusted execution.
