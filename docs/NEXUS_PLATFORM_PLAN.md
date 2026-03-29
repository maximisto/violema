# Nexus Platform Plan

## Goal

Turn Nexus from a strong single assistant into an orchestrated AI work platform:

- one primary user-facing copilot
- a background team of specialized agents
- a governed task system
- a points-based consumption model
- clear upgrade paths for heavier usage

This should feel like "hire one AI teammate" on day one, but expand into "run an AI organization" as usage matures.

## Product Thesis

The winning version of Nexus is not:

- a generic chatbot
- a bare workflow builder
- a collection of disconnected tools

The winning version is:

- a work execution platform
- with one visible assistant interface
- backed by a managed team of hidden specialist agents
- governed by budgets, approvals, and recurring routines

In short:

- ChatGPT is the conversation layer
- Paperclip is the company-management layer
- Nexus should become both, but with a cleaner commercial model and better execution UX

## What To Adopt From Paperclip

Adopt these ideas aggressively:

### 1. Goals and task ancestry

Every task should belong to:

- workspace
- project
- objective
- task
- subtask

This gives every agent context on the "why," not just the prompt.

### 2. Agent roles

Nexus should support a small set of first-class internal agent roles:

- Researcher
- Operator
- Engineer
- Reviewer
- Analyst
- Writer
- Scheduler

The end user still sees "Nexus." Internally, Nexus delegates to specialists.

### 3. Heartbeats

Agents should wake on:

- schedule
- event trigger
- task assignment
- failure retry

This is the right way to run ongoing work without keeping one giant session alive forever.

### 4. Governance

Every task should have an execution mode:

- auto
- review-required
- human-approved

And every action should be traceable:

- who initiated it
- which agent executed it
- what tools were called
- what it cost
- whether it succeeded

### 5. Budgets

Budgets should exist at multiple levels:

- per workspace
- per project
- per automation
- per agent role

This is essential once agents run 24/7.

### 6. Persistent work state

Tasks should resume with:

- task history
- prior outputs
- relevant artifacts
- tool outputs
- current status

No restart-from-zero loops.

## What Not To Adopt

Do not copy:

- org-chart theater as the main UX
- explicit "hire/fire agents" complexity for normal users
- a separate company-management product surface too early

For most customers:

- they should talk to Nexus
- Nexus should decide when to fan out to specialist agents
- advanced controls should exist, but not dominate the product

## Product Model

Nexus should have three layers:

### Layer 1. Copilot

This is the visible interface:

- chat
- search
- screenshots
- reports
- tasks
- messages
- automations

This remains the main user entry point.

### Layer 2. Work graph

This is the hidden execution system:

- objectives
- tasks
- subtasks
- dependencies
- task state
- budgets
- approval checkpoints

This becomes the operating backbone.

### Layer 3. Agent runtime

This is the execution layer:

- model routing
- specialist agents
- recurring heartbeats
- retries
- tool orchestration
- cost accounting

## Recommended Internal Agent System

### Primary agent

The visible assistant is:

- `Nexus`

Responsibilities:

- understand user intent
- plan execution
- choose model tier
- decide whether to delegate
- communicate progress and outcomes

### Specialist agents

The first internal team should be:

- `Researcher`
  - web search
  - synthesis
  - competitive scans
  - current facts

- `Operator`
  - Slack
  - email
  - CRM/admin tasks
  - scheduling

- `Engineer`
  - code changes
  - debugging
  - integrations
  - scripts

- `Reviewer`
  - QA
  - sanity checks
  - policy/risk verification
  - regression spotting

- `Analyst`
  - metrics
  - reporting
  - trend analysis
  - dashboard summaries

- `Scheduler`
  - recurring jobs
  - heartbeat routing
  - retries
  - failure escalation

Users should not need to manually select these most of the time.

## Execution Lifecycle

Every request should follow this lifecycle:

1. Intake
2. Route
3. Budget check
4. Plan
5. Delegate if needed
6. Execute
7. Review if required
8. Deliver result
9. Log cost and artifacts
10. Schedule follow-up if applicable

## Points Economy

The product should not sell raw tokens.
It should sell:

- credits
- automation capacity
- higher autonomy
- larger work budgets

Call them:

- `Nexus Credits`

This is cleaner than "tokens" for customers.

## Why Credits Work

Credits let us:

- hide provider-level complexity
- normalize cost across different tools and models
- support promos and referrals
- create plan ladders
- avoid exposing raw model economics

## Recommended Credit Model

### Base principle

Each user action consumes credits based on:

- model tier
- number of tool calls
- runtime length
- automation frequency
- artifact generation

### Credit cost formula

Use a blended internal cost model:

`credits = base_task_cost + model_cost + tool_cost + automation_cost + artifact_cost`

### Suggested starting rules

#### Chat tasks

- simple answer with no tools: `5 credits`
- answer with search or one tool: `15 credits`
- multi-step task with 2-4 tools: `30 credits`
- heavy research / report / code execution: `60 credits`
- high-intelligence critical task: `90 credits`

#### Automation runs

- simple scheduled check: `10 credits/run`
- report automation: `25 credits/run`
- multi-step automation with Slack/email/reporting: `40 credits/run`
- engineering or data-heavy automation: `75+ credits/run`

#### Background delegation

- internal specialist handoff: `+5 to +15 credits`
- review pass: `+10 credits`

#### Premium actions

- browser screenshot: `+8 credits`
- code execution: `+10 credits`
- report generation: `+15 credits`
- outbound email or Slack send: `+5 credits`

This is not the final pricing table. It is the right shape.

## Subscription Model

### Recommended launch pricing

#### Starter

- `$29/month`
- `500 credits`
- limited automations
- standard models only
- no background team view

#### Pro

- `$50/month`
- `1,000 credits`
- automations included
- multi-agent delegation
- priority models
- workspace memory

#### Team

- `$149/month`
- `5,000 credits`
- multiple users
- shared automations
- approval workflows
- workspace budgets
- advanced analytics

#### Business

- custom pricing
- dedicated limits
- custom connectors
- governance
- audit
- SSO
- spend controls

### Add-ons

Let customers buy top-ups:

- `500 credits`
- `1,500 credits`
- `5,000 credits`

Top-ups should not expire while the subscription is active.

## Referral System

### Recommended mechanics

- refer a friend who becomes a paying customer
- referrer gets `2,000 credits`
- new customer gets `500 credits`

This is strong enough to matter and still cheaper than paid acquisition in many cases.

Also support:

- seasonal bonus campaigns
- double-credit referral windows
- team invites with workspace credit grants

## Customer Experience Rules

The system should always show:

- credits remaining
- estimated task cost before major actions
- automation monthly burn estimate
- recommended upgrade when usage patterns justify it

Do not make cost feel mysterious.

But do not expose raw LLM token math.

## Autonomy Ladder

This is where Nexus becomes next-level.

### Level 1. Ask

User asks Nexus to do a task.

### Level 2. Delegate

Nexus quietly hands work to the right specialist agent.

### Level 3. Operate

Nexus runs recurring jobs in the background.

### Level 4. Govern

Workspace policies control budgets, approvals, and escalation.

### Level 5. Optimize

Nexus recommends:

- cheaper routes
- better schedules
- model substitutions
- automation consolidations
- upgrade paths

This turns Nexus into an operating system, not just an assistant.

## Core Features To Build Next

### Phase 1. Foundation

- task entity model
- credit ledger
- per-task cost accounting
- automation run metering
- route logging
- workspace limits

### Phase 2. Delegation

- internal specialist roles
- delegation framework
- task state and status model
- review checkpoints
- execution traces

### Phase 3. Governance

- approval rules
- workspace budgets
- automation budget caps
- monthly credit dashboards
- failure / retry policies

### Phase 4. Productization

- plans and billing
- top-ups
- referral credits
- upgrade prompts
- usage forecasting

## Recommended Data Model

Add these major entities:

- `workspace`
- `objective`
- `task`
- `task_run`
- `agent_role`
- `automation`
- `automation_run`
- `credit_ledger`
- `plan_subscription`
- `referral_event`
- `approval_event`
- `artifact`

## How To Meter Credits

Credits should be written as ledger events:

- `grant_monthly_plan`
- `grant_referral_bonus`
- `grant_promo_bonus`
- `debit_task_run`
- `debit_automation_run`
- `debit_premium_action`
- `credit_admin_adjustment`

Never mutate balances directly.

Always compute from ledger plus cached aggregate.

## UX Recommendations

### In chat

Show:

- estimated credit cost before expensive runs
- actual credit cost after completion
- whether Nexus used delegation
- whether a premium model was used

### In automations

Show:

- credits per run
- estimated monthly burn
- next run time
- current success rate

### In billing

Show:

- remaining credits
- burn rate
- projected depletion date
- upgrade recommendation

## Business Positioning

The best positioning is:

`Nexus is the AI operating layer for lean teams.`

Not:

- "just another AI agent"
- "a workflow builder"
- "an orchestration framework"

Sell:

- execution
- oversight
- cost control
- intelligent delegation

## Strategic Bet

The big bet is:

People do not want to manage many agents directly.
They want one trusted interface that can manage many agents for them.

That is where Nexus can win.

Paperclip is useful because it proves the orchestration layer matters.
But Nexus should make that orchestration feel invisible, premium, and commercially legible.

## Immediate Recommendation

Build next in this order:

1. Credit ledger
2. Task entity + run history
3. Delegation framework with specialist roles
4. Automation cost metering
5. Plan / top-up / referral system
6. Governance and approvals

That order gives both product leverage and monetization leverage quickly.
