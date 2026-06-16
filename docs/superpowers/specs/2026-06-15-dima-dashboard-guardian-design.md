# Dima Dashboard Guardian Design

## Goal

Add Dima, a gray Cane Corso dashboard companion, as a tasteful product layer that protects user work, celebrates solved problems, and flags weak workflows without crowding the Violema cockpit.

## Product Behavior

Dima is a friendly guardian, not a decorative toy. He uses the existing homepage Cane Corso visual language and appears inside the dashboard as a small silver/gray line-art companion with subtle Violema violet/cyan accents.

Dima should:

- sit docked near the lower-right workspace edge by default;
- lightly patrol on desktop when motion is allowed;
- stay still for `prefers-reduced-motion`;
- show short contextual advice based on the active dashboard area and tab;
- celebrate successful work with a kiss/approval ritual;
- occasionally reject weak or risky work with a playful chew/mark ritual;
- never modify real code or workflow data;
- be easy to hide and restore per workspace.

## Personality Rules

Dima is loyal, protective, slightly mischievous, and restrained. The humor should feel discovered, not loud.

Allowed rituals:

- `guard`: default advice and watchful state.
- `kiss`: positive celebration when work is good, solved, or completed.
- `chew`: visual rejection of weak logic or missing evidence by chewing a decorative code strip only.
- `mark`: rare warning marker for risky, vague, unaudited, or expensive work.

Disallowed behavior:

- no real code deletion;
- no gross literal rendering;
- no constant animation that competes with work;
- no blocking controls except later explicit safety flows.

## Architecture

Create a small guardian feature under `frontend/src/features/guardian`.

- `dashboardGuardian.ts`: pure selection logic for advice, rituals, and localStorage key names.
- `DashboardGuardian.tsx`: React overlay component that renders the Dima asset, advice bubble, controls, and visual ritual state.
- `Dashboard.tsx`: imports and mounts the overlay with current workspace area, tab, mission state, and credit signal.
- `index.css`: adds small scoped keyframes for Dima patrol, kiss, chew, and mark effects.
- `frontend/tests/dashboardGuardian.contract.ts`: contract test for deterministic advice, rituals, and persistence key naming.

## Data Flow

`Dashboard.tsx` already owns `workspaceArea`, `activeWorkspaceTab`, `selectedMission`, `lowCreditRunway`, and `workspaceId`. It passes those into `DashboardGuardian`.

`DashboardGuardian` calls pure helpers to choose a message and ritual. It stores only user preference:

- `violema_dima_hidden_<workspaceId>`
- `violema_dima_mischief_<workspaceId>`

## UX

Visible state:

- compact Dima body/head line art;
- small advice bubble titled `Dima`;
- `Hide` control;
- `Mischief on/off` control in the bubble.

Hidden state:

- tiny shield/dog restore button in the same corner.

Responsive behavior:

- desktop: patrol animation is allowed;
- mobile: no patrol, compact docked guardian;
- reduced motion: no patrol or ritual movement.

## Testing

Test the pure helper layer with a node-executable TypeScript contract file, matching the existing frontend test style.

Validate:

- storage keys include workspace id;
- dashboard/home/board/map/calendar/analytics messages are area-specific;
- low credit runway triggers a warning;
- review/done/completed conditions trigger kiss;
- missing evidence or weak review conditions trigger chew/mark;
- hidden and mischief settings stay separate.

## Scope

This pass ships the product-layer UI and deterministic behavior. It does not add generated art, backend telemetry, or real runtime safety blocks. Those can come later once the interaction proves useful.
