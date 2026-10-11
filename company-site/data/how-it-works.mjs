// Figures printed by the method page's "How it works" section: a dated snapshot of PsychDoc's psilocybin
// synthesis, version 2.2 of 2026-10-11, copied from maximisto/psychdoc-ai pull request 15 at the commit named in
// `synthesis.commit`, before that pull request merged. The page says which version and date they describe; PsychDoc
// shows the current state. The comment above each group names the PsychDoc file it was read from; provenance.md
// lists them too. Nothing here is estimated or rounded.
export const howItWorks = Object.freeze({
  synthesis: Object.freeze({
    slug: 'psilocybin-rewiring',
    version: '2.2',
    updatedAt: '2026-10-11',
    commit: 'ec08ae5d41689b7275477184157f88d086e2b74b',
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
  // lib/content/insights/psilocybin-rewiring.ts: 23 claims (tiers 22 preliminary, 1 established), 13 relations,
  // 1 posed as a question.
  claims: Object.freeze({ total: 23, preliminary: 22, relations: 13, posed: 1 }),
  // lib/synthesis/trust.ts computeTrust with the 2026-09-28 scan: independence.programs over the 24 sources
  // (Goodwin and Raison share two authors and count as one program).
  independence: Object.freeze({ papers: 24, programs: 15 }),
  // lib/content/insights/psilocybin-rewiring.ts openQuestions: the open question the planned diagram poses, verbatim.
  openQuestion: 'Does the lasting change in neuron function seen in rats months after one dose of psilocybin or 25CN-NBOH, with no structural difference detected at the sampled follow-up, hold for psilocybin on its own and in other labs, and is there a human counterpart?',
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
  // lib/policies/content.ts aiUsePolicy at commit cd43890 of the same pull request (updated 2026-10-11): the
  // "Where AI helps" list and the editorial-judgment line of "Where AI does not decide", verbatim except that
  // "this site" in the last list line names PsychDoc. The searching and screening lines reach psychdoc.ai only
  // when that pull request merges.
  aiPolicy: Object.freeze({
    url: 'https://psychdoc.ai/policies/ai-use',
    updatedAt: '2026-10-11',
    intro: 'We use AI models, including models made by Anthropic and OpenAI, for these steps:',
    helps: Object.freeze([
      'Searching for candidate papers: writing and running keyword searches on literature databases, with each query and its hit count recorded. The weekly citation scan is code, not an AI model.',
      'Screening candidate papers: drafting the written rules for a screening pass, a verdict on each paper and the reason for it.',
      'Drafting claim text, relations and plain-language summaries from the sources.',
      'Automated stress tests: AI agents with separate briefs look for errors, confounds and overstatement in a posed reading.',
      'Writing the code that builds PsychDoc and checks its content.',
    ]),
    decides: 'Nothing is published until the publisher approves the change. Counts on the trust panel are computed by code. Which studies to include, the tier of each claim and every posed reading are editorial judgments.',
  }),
});
