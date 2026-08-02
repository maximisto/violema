// Run-timestamp day-boundary contract.
//
// The regression this pins: a run at 19:02Z is 2:02 PM for a UTC-5 viewer, and
// it stays *their* "today" for another five hours after UTC midnight has
// already rolled the date forward. Any comparison done in UTC calls that run
// "yesterday" while the founder's own clock still says the same afternoon --
// and the mirror-image failure hits UTC+9 viewers, for whom the same instant is
// already the next local day.
//
// Node caches the process timezone at startup, so the suite re-execs itself
// once per zone rather than trying to mutate TZ in place.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { formatRunTimestamp, localDayOffset } from '../src/features/missions/runTimestamp.ts';

const ZONES = ['America/Chicago', 'Asia/Tokyo', 'UTC'];
const selfPath = fileURLToPath(import.meta.url);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/** ICU emits U+202F/U+00A0 around the day period; compare on plain spaces. */
function normalize(value) {
  return String(value).replace(/[  ]/g, ' ');
}

function expectLabel(iso, nowIso, expected, message) {
  const actual = normalize(
    formatRunTimestamp(iso, { now: new Date(nowIso), locale: 'en-US' }),
  );
  assert(actual === expected, `${message} (expected "${expected}", got "${actual}")`);
}

const activeZone = process.env.VIOLEMA_TZ_CASE;

if (!activeZone) {
  for (const zone of ZONES) {
    const result = spawnSync(process.execPath, [selfPath], {
      env: { ...process.env, TZ: zone, VIOLEMA_TZ_CASE: zone },
      stdio: 'inherit',
    });
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
  console.log(`runTimestamp.contract: local-day boundaries verified in ${ZONES.join(', ')}`);
  process.exit(0);
}

const resolvedZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
assert(
  resolvedZone === activeZone,
  `timezone case did not take effect (asked for ${activeZone}, running in ${resolvedZone})`,
);

// The run the founder actually saw mislabelled: Jul 31 19:02 UTC.
const FIELD_RUN = '2026-07-31T19:02:00.000Z';

if (activeZone === 'America/Chicago') {
  expectLabel(
    FIELD_RUN,
    '2026-07-31T23:30:00.000Z',
    'today 2:02 PM',
    'same local day, before UTC midnight',
  );

  // The load-bearing case: UTC has already turned over to Aug 1, but the
  // viewer's local clock still reads Jul 31 21:30.
  expectLabel(
    FIELD_RUN,
    '2026-08-01T02:30:00.000Z',
    'today 2:02 PM',
    'still the same LOCAL day after UTC midnight',
  );

  expectLabel(
    FIELD_RUN,
    '2026-08-01T13:00:00.000Z',
    'yesterday 2:02 PM',
    'previous local day reads as yesterday',
  );

  expectLabel(
    FIELD_RUN,
    '2026-08-03T13:00:00.000Z',
    'Jul 31, 2:02 PM',
    'older than yesterday falls back to a calendar date',
  );

  expectLabel(
    '2026-08-03T14:00:00.000Z',
    '2026-08-02T18:00:00.000Z',
    'tomorrow 9:00 AM',
    'next scheduled run one local day out reads as tomorrow',
  );

  // Daylight saving: two local midnights 25h apart (fall back, Nov 1 2026)
  // and 23h apart (spring forward, Mar 8 2026) must still be one day.
  expectLabel(
    '2026-11-01T12:00:00.000Z',
    '2026-11-02T12:00:00.000Z',
    'yesterday 6:00 AM',
    'DST fall-back keeps a 25-hour local day at offset -1',
  );
  expectLabel(
    '2026-03-08T12:00:00.000Z',
    '2026-03-09T12:00:00.000Z',
    'yesterday 7:00 AM',
    'DST spring-forward keeps a 23-hour local day at offset -1',
  );

  const crossYear = normalize(
    formatRunTimestamp('2025-12-31T19:02:00.000Z', {
      now: new Date('2026-08-01T13:00:00.000Z'),
      locale: 'en-US',
    }),
  );
  assert(
    crossYear.includes('2025') && crossYear.includes('Dec 31'),
    `a run from another year keeps its year (got "${crossYear}")`,
  );
}

if (activeZone === 'Asia/Tokyo') {
  // 19:02Z is already 04:02 the NEXT local morning at UTC+9.
  expectLabel(
    FIELD_RUN,
    '2026-07-31T20:00:00.000Z',
    'today 4:02 AM',
    'UTC+9 viewer sees the run on their own local day',
  );
  expectLabel(
    FIELD_RUN,
    '2026-07-31T14:00:00.000Z',
    'tomorrow 4:02 AM',
    'UTC+9 viewer still on the previous local day sees it as tomorrow',
  );
  expectLabel(
    FIELD_RUN,
    '2026-08-01T23:00:00.000Z',
    'yesterday 4:02 AM',
    'UTC+9 viewer one local day later sees yesterday',
  );
}

if (activeZone === 'UTC') {
  expectLabel(FIELD_RUN, '2026-07-31T23:00:00.000Z', 'today 7:02 PM', 'UTC viewer same day');
  expectLabel(FIELD_RUN, '2026-08-01T00:30:00.000Z', 'yesterday 7:02 PM', 'UTC viewer past midnight');
}

// Behaviour shared by every zone.
assert(
  formatRunTimestamp(undefined, { fallback: 'No completed run yet' }) === 'No completed run yet',
  'a missing timestamp returns the caller fallback',
);
assert(
  formatRunTimestamp('', { fallback: 'Not scheduled' }) === 'Not scheduled',
  'an empty timestamp returns the caller fallback',
);
assert(
  formatRunTimestamp('every monday at 9am') === 'every monday at 9am',
  'an unparseable schedule string passes through verbatim',
);
assert(
  localDayOffset(new Date('2026-07-31T19:02:00.000Z'), new Date('2026-07-31T19:02:00.000Z')) === 0,
  'an instant is zero local days from itself',
);
