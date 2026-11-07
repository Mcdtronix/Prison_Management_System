/**
 * Sentence arithmetic shared by offence registration and Record Court Outcome.
 * Mirrors the backend (Reception/models.py calculate_inmate_release_dates):
 *   - lengths are calendar-based from the sentence date (dateutil relativedelta);
 *   - counts that run concurrently form one group, counted once at its longest sentence;
 *   - groups and consecutive counts are added one after another from the earliest sentence date.
 */

export interface SentenceCount {
  /** Stable id for this count, e.g. "new:0" or "existing:15". */
  key: string;
  years: number;
  months: number;
  days: number;
  sentenceDate?: string;
  /** Key of the count this one runs concurrently with; empty = consecutive. */
  concurrentWith?: string | null;
}

export interface SentenceTotal {
  totalDays: number;
  remissionDays: number;
  daysToServe: number;
  /** Whole months as sentenced (years x 12 + months). */
  months: number;
  /** Count keys grouped into concurrent sets (only sets of two or more). */
  concurrentSets: string[][];
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Calendar days in a sentence of years/months/days starting on `start`
 * (yyyy-mm-dd). Month ends clamp like dateutil: 31 Jan + 1 month = 28/29 Feb.
 * Without a start date, falls back to 365/30-day units.
 */
export const calendarDays = (start: string | undefined, years: number, months: number, days: number) => {
  const match = ISO_DATE.exec(start || "");
  if (!match) return years * 365 + months * 30 + days;
  const [y, m, d] = [Number(match[1]), Number(match[2]) - 1, Number(match[3])];
  const totalMonths = m + years * 12 + months;
  const endYear = y + Math.floor(totalMonths / 12);
  const endMonth = ((totalMonths % 12) + 12) % 12;
  const lastDayOfMonth = new Date(Date.UTC(endYear, endMonth + 1, 0)).getUTCDate();
  const end = Date.UTC(endYear, endMonth, Math.min(d, lastDayOfMonth) + days);
  return Math.round((end - Date.UTC(y, m, d)) / 86_400_000);
};

export const formatSentence = (years = 0, months = 0, days = 0) => {
  const parts = [
    years ? `${years} yr${years === 1 ? "" : "s"}` : "",
    months ? `${months} mth${months === 1 ? "" : "s"}` : "",
    days ? `${days} day${days === 1 ? "" : "s"}` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" ") : "0 days";
};

/** Effective sentence for a set of counts, honouring concurrent links. */
export const computeEffectiveSentence = (counts: SentenceCount[]): SentenceTotal => {
  const n = (v: unknown) => Math.max(0, Number(v) || 0);
  const valid = counts.filter((c) => n(c.years) || n(c.months) || n(c.days));
  const keys = new Set(valid.map((c) => c.key));

  // Union-find over concurrent links.
  const parent = new Map(valid.map((c) => [c.key, c.key]));
  const find = (k: string): string => {
    while (parent.get(k) !== k) k = parent.get(k)!;
    return k;
  };
  valid.forEach((c) => {
    if (c.concurrentWith && keys.has(c.concurrentWith) && c.concurrentWith !== c.key) {
      parent.set(find(c.key), find(c.concurrentWith));
    }
  });

  const groups = new Map<string, SentenceCount[]>();
  valid.forEach((c) => {
    const root = find(c.key);
    groups.set(root, [...(groups.get(root) || []), c]);
  });

  let years = 0, months = 0, days = 0;
  let start: string | undefined;
  groups.forEach((members) => {
    const longest = members.reduce((best, c) =>
      calendarDays(c.sentenceDate, n(c.years), n(c.months), n(c.days)) >
      calendarDays(best.sentenceDate, n(best.years), n(best.months), n(best.days)) ? c : best,
    );
    years += n(longest.years);
    months += n(longest.months);
    days += n(longest.days);
    members.forEach((c) => {
      if (c.sentenceDate && ISO_DATE.test(c.sentenceDate) && (!start || c.sentenceDate < start)) start = c.sentenceDate;
    });
  });

  const totalDays = calendarDays(start, years, months, days);
  const remissionDays = Math.floor(totalDays / 3);
  return {
    totalDays,
    remissionDays,
    daysToServe: totalDays - remissionDays,
    months: years * 12 + months,
    concurrentSets: [...groups.values()].filter((g) => g.length > 1).map((g) => g.map((c) => c.key)),
  };
};
