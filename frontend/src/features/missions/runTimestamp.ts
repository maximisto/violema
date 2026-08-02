/**
 * Run timestamps, formatted against the viewer's LOCAL calendar day.
 *
 * Why this module exists: every run stamp in the app was either fully absolute
 * (`Jul 31, 2:02 PM`) or a coarse elapsed string (`5h ago`), so the only
 * "today"/"yesterday" wording a founder ever saw came from model-authored
 * summary prose — which freezes at generation time and therefore keeps saying
 * "today" long after the day has turned over. Relative day wording has to be
 * recomputed at render time from the raw instant, and the day boundary has to
 * be the viewer's local midnight, never UTC midnight: a 19:02Z run is the
 * *previous* local day for a UTC-5 viewer once their own clock rolls past
 * midnight, and that same instant is *already tomorrow* for a UTC+9 viewer.
 *
 * Leaf module by design (no runtime imports) so the contract tests can load it
 * directly under Node.
 */

export interface RunTimestampOptions {
  /** Injected in tests; defaults to the real clock. */
  now?: Date;
  /** Returned when the value is missing. */
  fallback?: string;
  /** Injected in tests; defaults to the runtime locale. */
  locale?: string | string[];
}

const DAY_MS = 86_400_000;

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Whole local calendar days between `value` and `now` (0 = same local day,
 * -1 = the local day before). Rounding absorbs the 23h/25h spans that daylight
 * saving transitions produce between two local midnights.
 */
export function localDayOffset(value: Date, now: Date) {
  return Math.round((startOfLocalDay(value).getTime() - startOfLocalDay(now).getTime()) / DAY_MS);
}

function formatClock(date: Date, locale?: string | string[]) {
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(date);
}

function formatCalendarDate(date: Date, now: Date, locale?: string | string[]) {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

/**
 * `today 2:02 PM` / `yesterday 2:02 PM` / `tomorrow 9:00 AM` / `Jul 29, 2:02 PM`.
 *
 * Unparseable input is returned verbatim: callers pass fields like
 * `task.schedule` ("every monday at 9am") through the same helper, and those
 * must survive untouched rather than collapse into a fallback.
 */
export function formatRunTimestamp(
  value: string | number | Date | undefined | null,
  options: RunTimestampOptions = {},
) {
  const { now = new Date(), fallback = '', locale } = options;

  if (value === undefined || value === null || value === '') return fallback;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return typeof value === 'string' ? value : fallback;

  const offset = localDayOffset(date, now);
  if (offset === 0) return `today ${formatClock(date, locale)}`;
  if (offset === -1) return `yesterday ${formatClock(date, locale)}`;
  if (offset === 1) return `tomorrow ${formatClock(date, locale)}`;

  return formatCalendarDate(date, now, locale);
}
