import type { WorkspaceAreaId, WorkspaceTabId } from '../missions/workspaceShell';

export type GuardianRitual = 'guard' | 'kiss' | 'chew' | 'mark';
export type GuardianTone = 'neutral' | 'success' | 'warning' | 'mischief';
export type DimaSprite = 'patrol' | 'thinking' | 'kiss' | 'action' | 'chew' | 'mark' | 'credits' | 'swarm';

export interface DimaPatrolContext {
  motionAllowed?: boolean;
  panelOffset?: boolean;
  ritual?: GuardianRitual;
  step?: number;
}

export interface DimaPatrolOffset {
  x: string;
  y: string;
}

export interface DimaBubbleDefaultContext {
  desktop?: boolean;
  panelOffset?: boolean;
}

export interface GuardianContext {
  area: WorkspaceAreaId;
  tab?: WorkspaceTabId;
  missionStatus?: string;
  activeAgentLabel?: string;
  lowCreditRunway?: boolean;
  hasEvidence?: boolean;
  reviewWaiting?: boolean;
  completedSteps?: number;
  totalSteps?: number;
  failedSteps?: number;
  mischiefEnabled?: boolean;
  hourOfDay?: number;
  spriteStep?: number;
}

export interface GuardianCue {
  ritual: GuardianRitual;
  tone: GuardianTone;
  sprite: DimaSprite;
  title: string;
  message: string;
}

const DEFAULT_WORKSPACE_ID = 'default';
const DIMA_DOCKED_PATROL_OFFSET: DimaPatrolOffset = { x: '0rem', y: '0rem' };
const DIMA_PATROL_OFFSETS: DimaPatrolOffset[] = [
  DIMA_DOCKED_PATROL_OFFSET,
  { x: '-2.25rem', y: '-1.4rem' },
  { x: '-4.5rem', y: '-0.25rem' },
  { x: '-1.2rem', y: '-2.35rem' },
];
const DIMA_QUOTES = [
  'Guard the work before you ship it.',
  'Good systems protect good taste.',
  'If the evidence is thin, Dima waits.',
  'Move fast. Keep receipts.',
  'The owner gets clarity, not chaos.',
  'Automation is only useful when it can be trusted.',
  'A clean mission beats a loud dashboard.',
];

export function getDimaHiddenStorageKey(workspaceId = DEFAULT_WORKSPACE_ID) {
  return `violema_dima_hidden_${workspaceId || DEFAULT_WORKSPACE_ID}`;
}

export function getDimaMischiefStorageKey(workspaceId = DEFAULT_WORKSPACE_ID) {
  return `violema_dima_mischief_${workspaceId || DEFAULT_WORKSPACE_ID}`;
}

export function getDimaBubbleDefaultOpen(context: DimaBubbleDefaultContext) {
  return Boolean(context.desktop && !context.panelOffset);
}

function normalizeStatus(value?: string) {
  return (value || '').trim().toLowerCase();
}

function isCompletedMission(context: GuardianContext) {
  const status = normalizeStatus(context.missionStatus);
  const totalSteps = context.totalSteps || 0;
  const completedSteps = context.completedSteps || 0;

  if (status === 'completed' || status === 'complete' || status === 'done') {
    return true;
  }

  return totalSteps > 0 && completedSteps >= totalSteps;
}

function hasWeakEvidence(context: GuardianContext) {
  return context.hasEvidence === false && (context.reviewWaiting || context.area === 'reviews' || context.area === 'map');
}

function getAreaAdvice(context: GuardianContext) {
  const agentLabel = context.activeAgentLabel || 'the active agent';

  if (context.area === 'home') {
    return 'Give Violema the outcome, not just the task. I will guard the messy parts.';
  }

  if (context.area === 'missions') {
    return `${agentLabel} has the baton. Check the next step before opening more lanes.`;
  }

  if (context.area === 'board') {
    return 'Keep each lane honest: active, waiting, review, done. Loose work belongs in review.';
  }

  if (context.area === 'map') {
    return 'Every step should have a tool, owner, or evidence source. Empty nodes smell weak.';
  }

  if (context.area === 'reviews') {
    return 'Review gates protect the owner. Sources first, output second, delivery last.';
  }

  if (context.area === 'calendar') {
    return 'Recurring missions need one clear delivery target and a clean next run.';
  }

  if (context.area === 'analytics') {
    return 'Credits are good when they buy reusable output. Watch waste, not just spend.';
  }

  if (context.area === 'integrations') {
    return 'Connect the tools that feed the work. Integrations without missions are just wiring.';
  }

  return 'Advanced rooms are for diagnosis. I will keep an eye on the sharp controls.';
}

function getGuardSprite(context: GuardianContext): DimaSprite {
  if (context.area === 'map' || context.area === 'reviews') return 'thinking';
  if (context.area === 'missions' || context.area === 'board' || context.area === 'calendar') return 'action';
  if (context.area === 'analytics') return 'credits';
  if (context.area === 'integrations') return 'swarm';
  if (context.area === 'advanced') return 'action';
  if (context.area === 'home') return getHomeSpriteForHour(context.hourOfDay, context.spriteStep);
  return 'patrol';
}

function getHomeSpriteForHour(hourOfDay?: number, spriteStep = 0): DimaSprite {
  if (typeof hourOfDay !== 'number' || !Number.isFinite(hourOfDay)) return getSteppedSprite(['patrol', 'action', 'thinking', 'swarm'], spriteStep);

  const normalizedHour = ((Math.floor(hourOfDay) % 24) + 24) % 24;
  if (normalizedHour >= 5 && normalizedHour < 11) return getSteppedSprite(['action', 'patrol', 'swarm', 'thinking'], spriteStep);
  if (normalizedHour >= 17 && normalizedHour < 22) return getSteppedSprite(['thinking', 'patrol', 'action', 'swarm'], spriteStep);
  if (normalizedHour >= 22 || normalizedHour < 5) return getSteppedSprite(['swarm', 'thinking', 'patrol', 'action'], spriteStep);
  return getSteppedSprite(['patrol', 'action', 'thinking', 'swarm'], spriteStep);
}

function getSteppedSprite(sequence: DimaSprite[], spriteStep = 0): DimaSprite {
  const index = Math.abs(Math.floor(spriteStep)) % sequence.length;
  return sequence[index];
}

export function selectDimaCue(context: GuardianContext): GuardianCue {
  const mischiefEnabled = context.mischiefEnabled !== false;

  if (isCompletedMission(context)) {
    return {
      ritual: 'kiss',
      tone: 'success',
      sprite: 'kiss',
      title: 'Dima approved',
      message: 'Approved. Good work. The owner gets kisses for solved problems.',
    };
  }

  if (context.lowCreditRunway) {
    return {
      ritual: 'mark',
      tone: 'warning',
      sprite: 'credits',
      title: 'Dima is marking this corner',
      message: 'Credit runway is thin. Tighten scope before the mission burns extra cycles.',
    };
  }

  if (mischiefEnabled && context.failedSteps && context.failedSteps > 0) {
    return {
      ritual: 'chew',
      tone: 'mischief',
      sprite: 'chew',
      title: 'Dima found a bad strip',
      message: 'Dima refused this logic. Failed steps need a cleaner plan before delivery.',
    };
  }

  if (mischiefEnabled && hasWeakEvidence(context)) {
    return {
      ritual: 'chew',
      tone: 'mischief',
      sprite: 'chew',
      title: 'Dima refused this logic',
      message: 'Dima refused the weak part. Add evidence before this reaches the owner.',
    };
  }

  if (!mischiefEnabled && hasWeakEvidence(context)) {
    return {
      ritual: 'guard',
      tone: 'warning',
      sprite: 'thinking',
      title: 'Dima is guarding the gate',
      message: 'Evidence is missing. Add sources before approval or delivery.',
    };
  }

  return {
    ritual: 'guard',
    tone: 'neutral',
    sprite: getGuardSprite(context),
    title: 'Dima is on patrol',
    message: getAreaAdvice(context),
  };
}

export function getDimaSpritePath(sprite: DimaSprite) {
  return `/brand/dima/dima-${sprite}.png`;
}

export function getDimaPatrolOffset(context: DimaPatrolContext): DimaPatrolOffset {
  if (!context.motionAllowed || context.panelOffset || context.ritual !== 'guard') {
    return DIMA_DOCKED_PATROL_OFFSET;
  }

  const index = Math.abs(Math.floor(context.step || 0)) % DIMA_PATROL_OFFSETS.length;
  return DIMA_PATROL_OFFSETS[index];
}

export function getDimaQuoteForDay(daySeed: number) {
  const index = Math.abs(Math.floor(daySeed)) % DIMA_QUOTES.length;
  return DIMA_QUOTES[index];
}

export function getDimaPatternNotes() {
  return [
    'Dima uses the existing Cane Corso homepage asset as the brand/sidebar guardian mark.',
    'Dima uses a cleaner expressive sprite set for in-product state changes.',
    'Dima rotates the Home guardian image on a slow beat, with the time of day deciding which sprite leads the cycle.',
    'Dima can chew a decorative code strip, but never mutates real code or mission data.',
    'Dima marks risk as a tasteful warning ritual, not a literal gross gag.',
    'Dima kisses the owner only for solved, completed, or approved work.',
    'Dima keeps the left sidebar Corso as a static homepage mark while the bottom-right sprite changes by workspace mood.',
    'Dima lightly patrols from the lower-right dock on desktop, but stays docked for panels, reduced motion, and special rituals.',
    'Dima can be hidden per workspace and mischief can be disabled separately.',
  ];
}
