# Agent Studio Manual

## What Agent Studio is

Agent Studio is the control room for a workflow's multi-agent system.

It exists to help you answer four questions fast:

1. What is happening right now?
2. Why did the last run succeed or fail?
3. What should change?
4. Should that change ship?

Inside Violema, Agent Studio is the place for:

- inspecting how a workflow is being routed
- understanding why runs degrade, stall, or overspend
- comparing operating setups before changing the live policy
- validating whether a change actually improved the system

It is not the place to create the workflow itself. That still lives in Dashboard.

## Why Agent Studio is needed

Without Agent Studio, workflow management collapses into one blurred surface:

- schedule editing
- workflow authoring
- run status
- debugging
- policy tuning
- cost and quality tradeoffs

That gets confusing fast.

Agent Studio separates the operating problem from the scheduling problem.

Dashboard answers:

- What workflows exist?
- When do they run?
- What does this workflow do?

Agent Studio answers:

- Which worker or phase is under pressure?
- What changed between a healthy run and a weak one?
- Is the current policy too cheap, too strict, or just mismatched?
- What should we test next?

That separation is why Studio matters. It is the place where workflow operations become legible instead of noisy.

## When to use Agent Studio

Use Agent Studio when you already have a scheduled workflow and want to:

- inspect the current system state
- diagnose a weak or failed run
- compare a new operating setup before applying it
- understand whether cost, speed, or review pressure is the real bottleneck

Stay in Dashboard when you need to:

- create a new workflow
- edit workflow steps
- change the schedule
- manage the schedule list directly

Rule of thumb:

- Dashboard is for authoring and scheduling.
- Agent Studio is for operating, debugging, and improving the agent system behind a workflow.

## What you need before Studio becomes useful

Agent Studio becomes useful as soon as you have one real scheduled workflow.

It becomes much more useful after a few completed runs.

Why:

- `Live` can still show the current topology and active policy with little history.
- `Replay` and the `Operational context map` get stronger once there are completed runs to compare.
- historical evidence like `Similar runs` and `Last healthy baseline` only appears when there is real run history to learn from.

If Studio says there is not enough history yet, that is normal for a new workflow.

## The mental model

Think in four objects:

- `Workflow`: the scheduled job you are operating
- `Run`: one execution of that workflow
- `Replay`: the explanation layer for what happened in a run
- `Release`: the policy or setup change you might apply next

Do not start with the deeper machinery.

Most users should spend almost all of their time in:

- the selected workflow
- the current or recent run
- the recommended next move
- the candidate change under test

Advanced controls are there when needed, but they are not the main path.

## How to open it

The current route is:

- `/dashboard/agents`

Typical entry paths:

- from Dashboard, open `Agent Studio`
- from a workflow row, open that workflow directly in Studio

If there are no workflows yet, Studio will show:

- `Create test workflow`
- `Open dashboard`

That is intentional. Studio is not useful until there is at least one real workflow to operate.

## The main flow

The simplest way to use Agent Studio is:

1. Select a workflow.
2. Start in `Live`.
3. If the run looks wrong or costly, move to `Replay`.
4. Decide what fix is worth testing.
5. Move to `Optimize`.
6. Compare the candidate against the live posture.
7. Apply only if the evidence holds up.
8. Come back to `Live` to validate the next run.

This is why the top of Studio has a `Control loop` strip. It is trying to move you through one operating loop instead of making you scan everything at once.

## The three rooms

### Live

Purpose:

- operate the current system

Start here when you want to know:

- Is the workflow healthy right now?
- Which role is under pressure?
- Where should I focus first?

Key surfaces:

- `Live system map`
- `Operator brief`
- `Node inspector`
- `Lane roster`
- `Next experiments`
- advanced live controls behind `Show advanced live`

How to use it:

1. Read the map first.
2. Read the `Operator brief`.
3. Inspect the one worker or phase that matters.
4. Follow the suggested next move into `Replay` or stay in `Live` if the issue is obvious.

What the `Operator brief` does:

- narrows the room to one next move
- shows the closest relevant earlier run
- shows the last healthy anchor when one exists

This is one of the main reasons Studio is useful. It converts a busy system into one readable operating recommendation.

### Replay

Purpose:

- explain the last run clearly enough that the next fix becomes obvious

Start here when you want to know:

- What changed the outcome?
- Which phase failed, slowed down, or overspent?
- What is the first fix worth testing?

Key surfaces:

- run timeline
- `Replay decision brief`
- comparison and phase evidence
- `Operational context map`
- advanced replay controls behind `Show advanced replay`

How to use it:

1. Open the specific run you care about.
2. Read the timeline before touching governance/history.
3. Read the `Replay decision brief`.
4. Use the `Operational context map` to answer:
   - Have we seen this before?
   - What changed since the last healthy state?
   - Why is Studio recommending this move?
5. Turn the finding into a candidate change in `Optimize`.

What the `Operational context map` gives you:

- `Similar runs`
- `Last healthy baseline`
- `Why this recommendation`

This is a core differentiator. It gives you evidence, not just charts.

### Optimize

Purpose:

- test and release a better operating setup

Start here when you want to know:

- What are we optimizing for?
- What changes if I switch this setup?
- Is this candidate good enough to ship?

Key surfaces:

- `Current release`
- `Scenario simulator`
- `Release candidate`
- `Release decision brief`
- diagnostics and governance behind `Show advanced optimize`

How to use it:

1. Pick a scenario first.
2. Choose a candidate policy or preset.
3. Read the `Release decision brief` before diving into deep diagnostics.
4. Compare deltas.
5. Apply only when the case is strong.

The point of `Optimize` is not to give you more knobs.

It is to let you make one good release decision with evidence.

## Scenarios and presets

### Scenario presets

Scenarios simulate the pressure the workflow is likely to face.

Current scenarios:

- `Current workflow`
- `Rush mode`
- `Deep research`
- `Watch loop`
- `High stakes`

Use scenarios to frame the environment before judging a candidate.

Do not jump straight into manual overrides unless the preset path is clearly insufficient.

### Policy presets

Current live and preview presets are built around a few clear operating postures:

- `System recommended`
- `Lean ops`
- `Balanced`
- `High assurance`

Use them like this:

- `System recommended`: best default when you want the system to route stronger reasoning only when justified
- `Lean ops`: use when cost and tool-heavy operational work matter most
- `Balanced`: use when you need a stable middle ground
- `High assurance`: use when correctness matters more than cost

## How to read the top shell

The top of Studio is there to orient you quickly.

### Workflow selector

Use it to pick the workflow you want to operate.

Each workflow card gives you:

- schedule
- latest status
- authoring mode
- step count
- success rate
- a recent summary when available

### Workflow summary

Once selected, Studio shows:

- workflow shape
- current policy
- next run
- result health

That is the quick context layer before you enter one of the rooms.

### Room switcher

The room order is intentional:

1. `Live`
2. `Replay`
3. `Optimize`

That is the real operating loop:

- inspect the system
- explain the run
- test and release the change

### Control loop

The `Control loop` strip is not decorative.

It tells you:

- what the current room is trying to hand you off to next
- what signal or evidence is driving that handoff
- what action is most likely to matter

If you are not sure where to go next, read this strip before doing anything else.

## Common ways to use Studio

### 1. Investigate a failed or weak run

Use this path:

1. Open the workflow.
2. Go to `Replay`.
3. Read the run timeline.
4. Read the `Replay decision brief`.
5. Check the `Operational context map`.
6. Open the relevant phase in `Live` or simulate the fix in `Optimize`.

### 2. Reduce cost without wrecking quality

Use this path:

1. Open the workflow.
2. Go to `Optimize`.
3. Set the scenario that matches the real operating pressure.
4. Compare `System recommended` or `Balanced` against `Lean ops`.
5. Read the `Release decision brief`.
6. Apply only if spend improves without unacceptable assurance loss.

### 3. Increase review pressure for sensitive workflows

Use this path:

1. Open the workflow.
2. Go to `Replay` and confirm the weak point is real.
3. Move to `Optimize`.
4. Compare the live setup against `High assurance`.
5. Read the deltas and next-step guidance.
6. Apply only if the reliability gain is worth the cost.

### 4. Understand whether Studio has enough evidence yet

Use this path:

1. Open the workflow.
2. Check whether completed runs exist.
3. Look at `Replay` and the `Operational context map`.

If you see messages like:

- no historical context yet
- no similar runs surfaced yet
- no earlier healthy baseline

that means the workflow needs more run history before Studio can make stronger evidence-backed recommendations.

## Advanced controls

Each room has an advanced panel:

- `Show advanced live`
- `Show advanced replay`
- `Show advanced optimize`

Use these only after the default room path stops being enough.

Good reasons to open advanced controls:

- you need deeper telemetry
- you need governance history
- you are comparing branches or promotion/rollback behavior
- the simple recommendation path does not explain enough

Bad reason to open advanced controls:

- curiosity before understanding the primary issue

If you open advanced controls too early, the room gets harder to read and the main value of Studio drops.

## What Agent Studio is not

Agent Studio is not:

- the workflow builder
- the scheduling UI
- a generic chat assistant
- a visual toy for drawing agent graphs
- a place to tweak everything at once

If it feels like you are browsing panels without making a decision, you are probably off the main path.

Come back to:

- one workflow
- one run
- one question
- one next move

## A good default operating habit

If you are not sure how to use Studio well, use this habit:

1. Stay in `Live` until something looks wrong or worth understanding.
2. Use `Replay` to turn that into one concrete explanation.
3. Use `Optimize` to test one candidate change.
4. Return to `Live` to validate the next run.

That loop is the product.

## Current limitations

The current Studio is strongest when:

- the workflow is already scheduled
- there are completed runs to compare
- you are trying to improve routing, assurance, or cost

It is weaker when:

- the workflow is brand new and has no history
- you are still authoring the workflow itself
- you want generic free-form chat instead of operational control

That is expected. Studio is an operating surface, not a general-purpose assistant.

## One-line takeaway

Use Dashboard to create and schedule workflows.

Use Agent Studio to understand, debug, and improve the multi-agent system that runs them.
