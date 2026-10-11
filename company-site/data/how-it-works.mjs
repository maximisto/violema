// Figures printed by the method page's "How it works" section. Every value is copied from PsychDoc's
// psilocybin synthesis, version 2.2: maximisto/psychdoc-ai pull request 15, commit ec643e7, in review and
// not yet published. The comment above each group names the PsychDoc file it was read from; provenance.md
// lists them too. Nothing here is estimated or rounded.
export const howItWorks = Object.freeze({
  synthesis: Object.freeze({
    slug: 'psilocybin-rewiring',
    version: '2.2',
    commit: 'ec643e70621c08ab39024c1c5d470d1b5ca71586',
    pullRequest: 'https://github.com/maximisto/psychdoc-ai/pull/15',
    walkthrough: 'https://psychdoc.ai/how-it-works',
  }),
  // .github/workflows/corpus-refresh.yml (cron "0 6 * * 1"); lib/synthesis/discover.ts citingWorks (cap 100,
  // sorted by cited_by_count descending); content/corpus/psilocybin-rewiring/2026-09-28.json, the last accepted
  // scan. multiSeed counts candidates whose seedLinks is 2 or more (29 + 3 + 2).
  scan: Object.freeze({ schedule: 'Every Monday at 06:00 UTC', date: '2026-09-28', seeds: 5, candidates: 521, multiSeed: 34, citingKept: 100 }),
  // content/corpus/psilocybin-rewiring/2026-10-10.screening.json. fromScan: snapshotDecisions, the scan's
  // candidates from 2024 to 2026 (161: 3 include, 153 exclude, 5 pending); fromSearch: searchDecisions (174: 17,
  // 147, 10). unscreened: the scan's other candidates, with no verdict. foundBySearch: the 17 search includes plus
  // the 2 scan includes listed in searchOverlapWithSnapshot; scanOnly: the scan include the searches missed.
  screening: Object.freeze({
    date: '2026-10-10',
    criteriaVersion: 'c8662963b',
    include: Object.freeze(['A primary study, systematic review or meta-analysis, in people or animals, that measures brain structure, function or molecular markers at least one week after psilocybin, with the timepoints stated.']),
    exclude: Object.freeze([
      'Narrative reviews, commentaries, editorials, news, protocols, conference abstracts and theses.',
      'Retracted papers.',
      'Other drugs, unless the paper compares them with psilocybin.',
      'Brain measures only in the first week after dosing.',
      'No brain measure: clinical, behavioural, psychological or blood outcomes only.',
    ]),
    records: 335,
    fromScan: 161,
    fromSearch: 174,
    unscreened: 360,
    included: 20,
    excluded: 300,
    pending: 15,
    foundBySearch: 19,
    foundByScan: 3,
    scanOnly: 1,
  }),
  // lib/content/insights/psilocybin-rewiring.ts: 22 claims (tiers 21 preliminary, 1 established), 13 relations,
  // 1 posed as a question.
  claims: Object.freeze({ total: 22, preliminary: 21, relations: 13, posed: 1 }),
  // lib/synthesis/trust.ts computeTrust: independence.programs over the 22 sources.
  independence: Object.freeze({ papers: 22, programs: 15 }),
  // provenance.reviewedBy is empty: no signed expert review yet.
  expertReviews: 0,
  // The three real claims the planned diagram draws together: first source, its venue, and the last author's
  // surname, which names the lab in this field's convention. Shao's "about a third" is from
  // lib/content/specimen-copy.ts (about a third of the day-one new spines remained at day 34).
  converging: Object.freeze([
    Object.freeze({ claimId: 'c-rat-months-function', source: 'Kramer 2026', venue: 'Neuropsychopharmacology', lab: 'Nichols' }),
    Object.freeze({ claimId: 'c-mouse-spines-persist', source: 'Shao 2021', venue: 'Neuron', lab: 'Kwan' }),
    Object.freeze({ claimId: 'c-healthy-sv2a', source: 'Johansen 2026', venue: 'Translational Psychiatry', lab: 'Knudsen' }),
  ]),
});
