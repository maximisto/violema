# Violema Agent Office Design

Date: 2026-06-14

## Decision

Evolve Violema into a chat-first agent office for founder missions.

Do not replace the current product shell. The current direction is already close: a calm conversational center, persistent navigation, operational context, scheduler, steps, task/runs, integrations, and approval-oriented delivery. The next product step is to make the work visible around chat without turning the app into a crowded dashboard or an n8n clone.

The product should preserve what Violema already nailed:

- chat as the emotional and operational center
- premium dark cinematic interface
- founder-work positioning
- human review before sensitive delivery
- source-linked outputs and run evidence
- recurring workflow scheduling
- step-based automation planning

The new layer is a contextual mission workspace that slides, folds, pins, and expands around chat.

## Product Thesis

Violema is an AI office that helps founders turn complex work into visible, reviewable, reusable missions.

The first wedge is founder operating workflows:

- weekly founder operating brief
- revenue / risk monitor
- build and release digest
- competitor / market brief
- follow-up queue

The durable platform is broader:

1. User asks Violema to do meaningful work.
2. Violema turns the goal into a mission.
3. Violema decomposes the mission into steps.
4. Each step is assigned to the right agent role, tool, integration, or skill.
5. Work executes visibly.
6. The user can inspect, chat, pause, reroute, approve, or request changes.
7. The run produces artifacts, evidence, costs, and follow-ups.
8. Successful mission patterns can become recurring automations.

## Positioning

Primary line:

> AI agents for founder work.

Product promise:

> Violema turns founder missions into planned, staffed, visible work your team can review, schedule, and improve.

Do not position the product as:

- a generic AI coworker
- an agent debugging console
- a workflow-builder-first product
- a visual automation canvas
- a team messenger replacement

The stronger category is an agent office / mission control system. Founder workflows are the entry point.

## Competitive Learning

Current products validate pieces of the direction:

- ChatGPT Canvas and Claude Artifacts validate the pattern of chat plus a side workspace for substantial work that needs inspection and iteration.
- n8n and Gumloop validate visual workflow building, but also show why the canvas should not be the default experience for non-technical founders.
- Relevance AI validates specialist agents, teams, tools, and agent monitoring.
- Zapier's agent guidance validates visible oversight, success and failure tracking, and human control.

Violema should borrow the best pattern, not the whole product model:

- keep chat calm by default
- open a workspace when there is real work to inspect
- use visual maps for understanding and editing workflows
- show agents as roles doing visible work
- keep approvals, evidence, and costs close to delivery
- make credit efficiency a value metric, not just a billing balance

Reference sources:

- [OpenAI ChatGPT Canvas help](https://help.openai.com/en/articles/9930697-what-is-the-canvas-feature-in-chatgpt-and-how-do-i-use-it)
- [Claude Artifacts help](https://support.claude.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them)
- [n8n workflow executions](https://docs.n8n.io/workflows/executions/)
- [n8n editor UI](https://docs.n8n.io/courses/level-one/chapter-1/)
- [Relevance AI Workforces](https://relevanceai.com/docs/get-started/core-concepts/workforces)
- [Relevance AI Agents](https://relevanceai.com/docs/get-started/key-concepts/agent)

## UX Shell

### Default State: Clean Chat

The default user experience remains clean chat.

Users should be able to land in Violema and simply talk:

- ask for work
- ask what is happening
- refine instructions
- approve or reject output
- talk to Violema or a specific agent

The right side should be collapsed or minimal unless there is useful work to inspect.

### Active Mission State: Chat + Docked Workspace

When a mission is active, the mission workspace can slide in beside chat.

The docked workspace shows:

- mission progress
- current step
- assigned agents
- current agent activity
- key data
- controls
- review state
- credit estimate

This lets users keep the chat context while seeing the work happen.

### Inspection State: Expanded Work Surface

When the user selects a deep work mode, the workspace gets more room.

Inspection modes:

- Mission
- Agents
- Board
- Map
- Reviews
- Calendar
- Analytics

Chat should remain accessible. It can become narrower, but it should not disappear.

### Mobile

Mobile should show one surface at a time:

- Chat
- Mission
- Review
- Map
- Analytics

There must always be a fast return to chat.

## Navigation

Keep the persistent left navigation.

Recommended primary nav:

- Home
- Missions
- Board
- Reviews
- Calendar
- Knowledge
- Integrations
- Credits
- Settings

Within a selected mission, use local tabs:

- Chat
- Mission
- Agents
- Board
- Map
- Reviews
- Calendar
- Analytics

These tabs should change the contextual work surface, not make the user feel they have entered a separate product.

## Core Objects

### Mission

The main work container.

Fields:

- id
- title
- goal
- status
- owner
- source prompt
- selected workflow template
- created at
- updated at
- schedule id, optional
- automation id, optional
- active run id, optional
- credit budget, optional
- review policy

### Mission Plan

The current step editor evolves into the mission plan.

Each plan step includes:

- title
- objective
- kind
- assigned agent role
- tool or integration
- dependencies
- condition
- inputs
- delivery target
- review gate
- estimated credits
- current status

### Agent Role

Agents are shown as understandable roles, not technical topology.

Initial roles:

- Violema Manager
- Researcher
- Analyst
- Builder
- Writer
- Reviewer
- Messenger
- Scheduler
- Monitor

Each role card should show:

- avatar / icon
- status
- current task
- key data used
- cost or estimate
- controls: ask, pause, reroute, require review

### Artifact

Artifacts are concrete outputs:

- draft brief
- Slack message
- email draft
- report
- evidence list
- follow-up task
- calendar prep note
- release note
- run summary

### Review Gate

Review gates are explicit human checkpoints.

Examples:

- approve final brief
- approve outbound Slack post
- approve investor-sensitive language
- approve email delivery
- request revision
- rerun a failed step

### Automation

Automation is a reusable mission pattern.

A successful mission can become:

- run once manually
- scheduled recurring mission
- event-triggered mission
- paused workflow
- template for similar work

## Functional Architecture

### Chat

Chat remains the command layer.

It should be mission-aware:

- user can ask about the selected mission
- user can address a specific agent
- messages can create or update missions
- chat can open the relevant workspace panel
- chat can summarize current work state

### Mission Workspace

The fold-in workspace is the proof layer.

It shows:

- where the mission is
- which agent is active
- what data is being used
- which step is blocked
- what requires approval
- what has been delivered
- what credits were spent

### Scheduler / Calendar

The existing scheduler is a core asset and should not be buried.

It becomes the Calendar / Cadence layer:

- run once now
- recurring schedule
- timezone
- conditional runs
- pause / resume
- next run
- monthly credit burn estimate
- schedule history

### Steps Editor

The current step editor becomes Mission Plan.

Keep:

- guided blocks
- explicit steps
- delivery targets
- schedule fields
- condition fields
- save and run-now path

Add:

- assigned agent role
- integration / tool chip
- review gate flag
- estimated credits per step
- plain-language dependency display
- advanced controls behind disclosure

### Board

Board is a Kanban-like operational view:

- planned
- running
- waiting review
- failed
- completed
- follow-up

Cards can represent:

- missions
- steps
- runs
- review gates
- follow-up tasks

### Map

Map is a lightweight visual anatomy of the mission.

It should show:

- data sources
- tools
- agents
- step dependencies
- review gates
- delivery targets

It should not become the default product center.

Use a proven library later, likely React Flow / xyflow, instead of hand-rolling graph editing.

### Reviews

Reviews show:

- draft output
- evidence
- risks
- source links
- delivery target
- credit cost
- reviewer notes
- approve / request changes / rerun controls

### Analytics

Credits become an operational metric, not only billing.

Analytics should show:

- credit balance
- estimated cost before run
- actual cost after run
- credits by mission
- credits by agent role
- credits by tool / integration
- credits per useful artifact
- projected time saved
- failed or wasted loop cost
- retry cost
- automation leverage
- underused workflow opportunities

Example value statement:

> This mission used 38 credits, produced 6 useful artifacts, saved an estimated 3.2 hours, and had low waste.

## Integrations

Public integration presentation should be elegant and confident.

Do not clutter the main UI with status badges such as Live, Planned, Ready next, or Coming soon.

The user-facing surface should show clean logo lines or categorized integration groups.

Internally, the platform still tracks readiness:

- enabled
- configured
- hidden
- invite-only
- custom
- unavailable

### Core First

Activate first:

- Slack
- Stripe
- GitHub

These prove the founder operating loop:

- Slack for review and delivery
- Stripe for revenue and risk signal
- GitHub for build and product signal

### Visible Catalog

Show or support the full operating stack over time:

- Slack
- Stripe
- GitHub
- Email
- Gmail
- Google Calendar
- Google Drive
- Outlook
- Microsoft Calendar
- OneDrive / SharePoint
- Microsoft Teams
- Linear
- Jira
- Notion
- Airtable
- HubSpot
- Salesforce
- Intercom
- Zendesk
- Webhooks
- API connector
- Browser / website monitor
- Database / warehouse connector
- Custom MCP

In mission setup, show only relevant connectors.

For Weekly Founder Operating Brief:

- recommended: Slack, Stripe, GitHub
- optional: Gmail, Google Calendar, Google Drive, Outlook

No logo wall should make the product feel unfinished.

## Current Code Fit

This should build from current architecture.

Keep and upgrade:

- `frontend/src/pages/Dashboard.tsx`: main app shell, sidebar, chat center, fold-in workspace
- `frontend/src/components/ChatInterface.tsx`: command layer, made mission-aware
- existing automation scheduler: Calendar / Cadence
- existing step editor: Mission Plan
- existing task/run panel: Board, Runs, Reviews
- existing Agent Studio data: powers Agent Floor, Map, and run explanation
- existing integration catalog: clean integration directory and workflow readiness source
- existing credit surfaces: expanded into credit utilization analytics

Agent Studio's current Live / Replay / Optimize concepts should not remain the user-facing mental model.

Map them internally:

- Live -> current mission / active agent state
- Replay -> what happened and why
- Optimize -> make this cheaper, better, faster, or safer next time

## Implementation Boundaries

Do not:

- rebuild n8n
- replace current chat
- bury scheduler and steps
- expose topology language to default users
- make Agent Studio a required user journey
- crowd the product with integration status badges
- show unavailable integrations in core mission setup unless relevant
- build full email/calendar automation before the first core proof loop works

Do:

- preserve chat-first Violema
- add sliding contextual panels
- make missions the structured work object
- make scheduler and steps first-class
- make agents visually legible
- make credits explain value
- keep integrations elegant on the surface and honest internally

## First Flagship Workflow

Build the first proof around Weekly Founder Operating Brief.

Core connected inputs:

- Stripe
- GitHub
- Slack

Optional future inputs:

- Gmail
- Google Calendar
- Google Drive
- Outlook

Mission stages:

1. Plan
2. Staff
3. Collect
4. Draft
5. Review
6. Deliver
7. Learn

Default agents:

- Violema Manager
- Researcher
- Analyst
- Builder
- Writer
- Reviewer
- Messenger

Key output:

- founder operating brief
- evidence list
- Slack delivery draft
- follow-up tasks
- credit utilization summary

## Success Criteria

The redesign succeeds if a user can:

- open Violema and still feel the product is clean and conversational
- start a founder mission from chat or a template
- see the mission plan and steps without leaving chat
- inspect which agent is working and what it is doing
- see Stripe, GitHub, and Slack evidence in the mission
- schedule the mission or run it once now
- approve or request changes before delivery
- understand how credits were used
- turn a successful mission into a recurring automation

## Validation Plan For Implementation

When implementation starts, validate with:

- frontend build
- backend build
- existing integration registry tests
- existing settings store tests
- scheduler save / run-now smoke test
- mission chat smoke test
- responsive screenshots for:
  - clean chat
  - docked mission workspace
  - expanded inspection
  - mobile single-surface mode

## Approved Direction

Max approved:

- A 70% Founder Operations Control Room focus
- B/C 30% builder and agent-control depth
- D team messenger later
- chat-first current shell preservation
- fold-in mission workspace
- scheduler and step editor preservation
- clean integration presentation without public status clutter
- core integration start with Slack, Stripe, GitHub
- visible future integration catalog for email, Google, Microsoft, CRM, project, and custom MCP
