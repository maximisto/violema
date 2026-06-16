import {
  getDimaHiddenStorageKey,
  getDimaMischiefStorageKey,
  getDimaPatternNotes,
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

const notes = getDimaPatternNotes();
assert(notes.some((note) => note.includes('never mutates real code')), 'documents that Dima never mutates real code');
assert(notes.some((note) => note.includes('homepage asset as the brand/sidebar guardian')), 'documents reuse of homepage Cane Corso asset');
assert(notes.some((note) => note.includes('expressive sprite set')), 'documents interactive sprite role');
assert(notes.some((note) => note.includes('left sidebar Corso as a static homepage mark')), 'documents that left sidebar Corso stays static');
