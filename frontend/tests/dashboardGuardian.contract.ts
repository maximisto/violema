import {
  getDimaHiddenStorageKey,
  getDimaMischiefStorageKey,
  getDimaBubbleDefaultOpen,
  getDimaPatternNotes,
  getDimaPatrolOffset,
  getDimaQuoteForDay,
  getDimaSpritePath,
  selectDimaCue,
} from '../src/features/guardian/dashboardGuardian';

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(getDimaHiddenStorageKey('acme') === 'violema_dima_hidden_acme', 'scopes hidden preference by workspace');
assert(getDimaMischiefStorageKey('acme') === 'violema_dima_mischief_acme', 'scopes mischief preference by workspace');
assert(getDimaBubbleDefaultOpen({ desktop: true, panelOffset: false }) === true, 'desktop Dima defaults to the advice box');
assert(getDimaBubbleDefaultOpen({ desktop: false, panelOffset: false }) === false, 'mobile Dima defaults to compact mode');
assert(getDimaBubbleDefaultOpen({ desktop: true, panelOffset: true }) === false, 'open panels default Dima to compact mode');

const chatCue = selectDimaCue({
  area: 'home',
  tab: 'chat',
  activeAgentLabel: 'Operator',
  hasEvidence: true,
  totalSteps: 4,
});
assert(chatCue.ritual === 'guard', 'chat defaults to guardian advice');
assert(chatCue.sprite === 'patrol', 'chat uses patrol sprite');
assert(chatCue.message.includes('outcome'), 'chat advice nudges the user toward outcomes');

const morningHomeCue = selectDimaCue({
  area: 'home',
  tab: 'chat',
  hourOfDay: 8,
  spriteStep: 0,
  hasEvidence: true,
  totalSteps: 4,
});
assert(morningHomeCue.sprite === 'action', 'morning home patrol uses action sprite');

const morningRotatedHomeCue = selectDimaCue({
  area: 'home',
  tab: 'chat',
  hourOfDay: 8,
  spriteStep: 1,
  hasEvidence: true,
  totalSteps: 4,
});
assert(morningRotatedHomeCue.sprite === 'patrol', 'home patrol rotates images after the first beat');

const eveningHomeCue = selectDimaCue({
  area: 'home',
  tab: 'chat',
  hourOfDay: 19,
  spriteStep: 0,
  hasEvidence: true,
  totalSteps: 4,
});
assert(eveningHomeCue.sprite === 'thinking', 'evening home patrol uses thinking sprite');

const overnightHomeCue = selectDimaCue({
  area: 'home',
  tab: 'chat',
  hourOfDay: 23,
  spriteStep: 0,
  hasEvidence: true,
  totalSteps: 4,
});
assert(overnightHomeCue.sprite === 'swarm', 'overnight home patrol uses swarm sprite');

const boardCue = selectDimaCue({
  area: 'board',
  tab: 'active',
  activeAgentLabel: 'Researcher',
  hasEvidence: true,
  totalSteps: 5,
});
assert(boardCue.message.includes('lane'), 'board advice references status lanes');
assert(boardCue.sprite === 'action', 'board uses action sprite');

const mapCue = selectDimaCue({
  area: 'map',
  tab: 'workflow',
  hasEvidence: true,
  totalSteps: 3,
});
assert(mapCue.message.includes('step'), 'map advice references workflow steps');
assert(mapCue.sprite === 'thinking', 'map uses thinking sprite');

const calendarCue = selectDimaCue({
  area: 'calendar',
  tab: 'upcoming',
  hasEvidence: true,
  totalSteps: 3,
});
assert(calendarCue.message.includes('delivery'), 'calendar advice references delivery target');
assert(calendarCue.sprite === 'action', 'calendar uses scheduled action sprite');

const analyticsCue = selectDimaCue({
  area: 'analytics',
  tab: 'credits',
  hasEvidence: true,
  totalSteps: 3,
});
assert(analyticsCue.sprite === 'credits', 'analytics uses credits sprite even before low runway');

const integrationsCue = selectDimaCue({
  area: 'integrations',
  tab: 'core',
  hasEvidence: true,
  totalSteps: 3,
});
assert(integrationsCue.sprite === 'swarm', 'integrations uses swarm sprite');

const lowCreditCue = selectDimaCue({
  area: 'analytics',
  tab: 'credits',
  lowCreditRunway: true,
  hasEvidence: true,
  totalSteps: 3,
});
assert(lowCreditCue.ritual === 'mark', 'low credit runway gets warning marker');
assert(lowCreditCue.tone === 'warning', 'low credit runway uses warning tone');
assert(lowCreditCue.sprite === 'credits', 'low credit runway uses credits sprite');

const lowCreditMorningCue = selectDimaCue({
  area: 'home',
  tab: 'chat',
  hourOfDay: 8,
  lowCreditRunway: true,
  hasEvidence: true,
  totalSteps: 3,
});
assert(lowCreditMorningCue.sprite === 'credits', 'low credit image overrides time-of-day image');

const solvedCue = selectDimaCue({
  area: 'board',
  tab: 'done',
  missionStatus: 'completed',
  hasEvidence: true,
  completedSteps: 4,
  totalSteps: 4,
});
assert(solvedCue.ritual === 'kiss', 'completed work gets Dima approval kiss');
assert(solvedCue.sprite === 'kiss', 'completed work gets kiss sprite');
assert(solvedCue.message.includes('Approved'), 'success cue uses approval language');

const weakCue = selectDimaCue({
  area: 'reviews',
  tab: 'approvals',
  hasEvidence: false,
  reviewWaiting: true,
  totalSteps: 4,
  mischiefEnabled: true,
});
assert(weakCue.ritual === 'chew', 'missing evidence can trigger visual chew ritual');
assert(weakCue.sprite === 'chew', 'weak evidence gets chew sprite');
assert(weakCue.message.includes('refused'), 'chew cue rejects weak logic');

const professionalCue = selectDimaCue({
  area: 'reviews',
  tab: 'approvals',
  hasEvidence: false,
  reviewWaiting: true,
  totalSteps: 4,
  mischiefEnabled: false,
});
assert(professionalCue.ritual === 'guard', 'disabled mischief suppresses chew ritual');
assert(professionalCue.sprite === 'thinking', 'professional weak-evidence mode keeps serious sprite');
assert(!professionalCue.message.includes('refused'), 'professional mode keeps advice direct');

assert(getDimaSpritePath('swarm') === '/brand/dima/dima-swarm.png', 'returns public sprite path');
assert(getDimaQuoteForDay(0) === 'Guard the work before you ship it.', 'selects deterministic first quote');
assert(getDimaQuoteForDay(7) === 'Guard the work before you ship it.', 'wraps quote selection by day');

const anchoredPatrol = getDimaPatrolOffset({ motionAllowed: true, panelOffset: false, ritual: 'guard', step: 0 });
const roamingPatrol = getDimaPatrolOffset({ motionAllowed: true, panelOffset: false, ritual: 'guard', step: 1 });
const wrappedPatrol = getDimaPatrolOffset({ motionAllowed: true, panelOffset: false, ritual: 'guard', step: 5 });
assert(anchoredPatrol.x === '0rem' && anchoredPatrol.y === '0rem', 'first patrol step starts from the dock');
assert(roamingPatrol.x !== '0rem' || roamingPatrol.y !== '0rem', 'desktop patrol moves Dima away from one fixed position');
assert(wrappedPatrol.x === roamingPatrol.x && wrappedPatrol.y === roamingPatrol.y, 'patrol steps wrap deterministically');

const noMotionPatrol = getDimaPatrolOffset({ motionAllowed: false, panelOffset: false, ritual: 'guard', step: 1 });
const panelPatrol = getDimaPatrolOffset({ motionAllowed: true, panelOffset: true, ritual: 'guard', step: 1 });
const ritualPatrol = getDimaPatrolOffset({ motionAllowed: true, panelOffset: false, ritual: 'kiss', step: 1 });
assert(noMotionPatrol.x === '0rem' && noMotionPatrol.y === '0rem', 'reduced-motion users keep Dima docked');
assert(panelPatrol.x === '0rem' && panelPatrol.y === '0rem', 'open panels keep Dima from patrolling into controls');
assert(ritualPatrol.x === '0rem' && ritualPatrol.y === '0rem', 'special rituals own their own motion');

const notes = getDimaPatternNotes();
assert(notes.some((note) => note.includes('never mutates real code')), 'documents that Dima never mutates real code');
assert(notes.some((note) => note.includes('homepage asset as the brand/sidebar guardian')), 'documents reuse of homepage Cane Corso asset');
assert(notes.some((note) => note.includes('expressive sprite set')), 'documents interactive sprite role');
assert(notes.some((note) => note.includes('left sidebar Corso as a static homepage mark')), 'documents that left sidebar Corso stays static');
