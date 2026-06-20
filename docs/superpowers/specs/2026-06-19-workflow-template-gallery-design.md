# Workflow Template Gallery — design

**Date:** 2026-06-19
**Goal:** Make Violema's proven recurring-work templates *discoverable*, to shorten the path from signup to a founder's first valuable run.

## Problem

The product already ships five real workflow templates (weekly founder brief,
revenue watch, competitor monitor, customer-risk digest, investor follow-up) and
a working "apply template → prefilled editor" flow (`applyFounderWorkflowTemplate`
in `Dashboard.tsx`). But they are **buried**: the only way to see them is to first
click "create automation" and scroll inside the editor's setup section. A new
founder never discovers them, so activation suffers.

This is a discoverability gap, not a missing capability.

## Approved decisions

- **Install flow:** picking a template opens the existing automation editor
  **prefilled** (review → save → the existing save flow can run immediately).
  Keeps the human-in-the-loop "reviewable" promise and reuses working code.
- **Placement:** in-product first, on the home **activity / command-center**
  surface. The shared catalog is structured so a public `/templates/<slug>` SEO
  page is a thin follow-up (not built now — YAGNI).
- **Content:** the existing five templates, enriched, plus one (monthly investor
  update) = six.

## Architecture

Single source of truth, client-side (no new backend endpoint needed):

- **`frontend/src/content/workflowTemplates.ts`** — extracted from `Dashboard.tsx`
  and enriched. Exports:
  - `WorkflowTemplateStep`, `WorkflowTemplateDefinition`, `WorkflowTemplateCategory`
  - `WORKFLOW_TEMPLATES: WorkflowTemplateDefinition[]`
  - `getWorkflowTemplateById(id)`
  - Each definition adds: `slug`, `category`, `outcome` (one-line payoff),
    `integrations` (e.g. `['Stripe','GitHub']`). The `step` shape stays
    structurally identical to `Omit<WorkflowBlockDraft,'id'>` so the existing
    `createWorkflowBlock(step.kind, …)` consumption is unchanged.
- **`frontend/src/features/templates/WorkflowTemplateGallery.tsx`** — presentational.
  Props: `templates`, `onUse(id)`. Renders a responsive card grid: category chip,
  title, outcome, integration chips, cadence, step count, and a "Use template"
  button → `onUse(id)`. Matches the existing dark editorial styling.
- **`Dashboard.tsx`** — import the shared catalog (delete the inline copy), keep
  `applyFounderWorkflowTemplate` (now resolves via `getWorkflowTemplateById`),
  and render `<WorkflowTemplateGallery>` on the home activity surface. The
  in-editor template list also reads the shared catalog.

## Data flow

`WorkflowTemplateGallery` (Use) → `applyFounderWorkflowTemplate(id)` → prefilled
`automationEditor` (mode: create) → existing save (`POST /api/automations`) →
existing optional immediate run. No new API surface.

## Testing

- `frontend/tests/workflowTemplates.contract.ts`: ≥6 templates; unique `id`/`slug`;
  every template has ≥2 steps, non-empty `title`/`outcome`/`description`/`cadence`,
  a valid `category`, and at least one integration; every step `kind` is allowed;
  any `deliver` step carries a `deliveryTarget`; `getWorkflowTemplateById` resolves
  a known id and returns `undefined` for an unknown one.
- `tsc + vite build` must stay green; existing contract suite unchanged.

## Out of scope (now)

Public `/templates` SEO pages, a dedicated nav area, and a backend catalog
endpoint — all enabled by the shared catalog, deferred deliberately.
