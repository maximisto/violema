// Violema films, as checked. Spoken lines are the locked script's words; on-screen text is as drawn in the cut.
// Editing a line here does not change the film. A line that differs from the film, or any new claim, reopens the
// fact check for that line (README, "Films"). Times are seconds into the cut; both cuts share one soundtrack.

const deepFreeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
};

const FLORIDA = {
  history: 'https://www.flsenate.gov/Session/Bill/1998/660/ByCategory',
  statute: 'https://www.flsenate.gov/Laws/statutes/2010/411.0106',
  repeal: 'https://laws.flrules.org/files/Ch_2013-252.pdf',
};

export const ZERO_BABIES = deepFreeze({
  slug: 'zero-babies',
  number: '01',
  title: 'Zero Babies',
  runtime: 52,
  checked: '2026-11-15',
  // 'draft' shows the draft note under the player. With the final media in place, set 'final' and the release date.
  status: 'draft',
  published: null,
  draftNote: 'Draft cut. Music and sound are still to come. The final film replaces this file.',
  description: 'A 52-second film on how a 1993 study of 36 college students became a claim about babies. With each claim it makes, its sources, its limits and its date.',
  lede: 'In 1993, a study of 36 college students reported a short-lived effect of Mozart on spatial tasks. By 1998, Georgia’s governor asked for $105,000 to send classical music to every newborn in the state. This film follows the claim. Below it is the record: each claim, with its sources, its limits and its date.',

  // Kept out of git and pinned here (README, "Films"). Names carry the first 8 hex digits of the file's SHA-256.
  media: {
    duration: 52.012,
    captions: 'zero-babies.en.vtt',
    card: { file: 'zero-babies-card.jpg', alt: 'A still from Zero Babies, a Violema film: a baby in a crib beside the words 0 babies.' },
    cuts: [
      { id: 'wide', label: 'Wide', ratio: '2.39:1', file: 'zero-babies-wide-e422f2c9.mp4', sha256: 'e422f2c9babbf3b0669c0f7a7a19ed3e13af43148bbafd1945a8363699ed28e3', bytes: 17439371, width: 1920, height: 804, poster: 'zero-babies-wide-poster.webp' },
      { id: 'vertical', label: 'Vertical', ratio: '9:16', file: 'zero-babies-vertical-6eee4604.mp4', sha256: '6eee4604a0c42a0d5e95a4422b440a846292a6b9cde71a33001fa5ef775ff830', bytes: 16026884, width: 1080, height: 1920, poster: 'zero-babies-vertical-poster.webp' },
    ],
  },

  // Caption cues from the cut's word timing: [start, end, text].
  cues: [
    [0.6, 2.253, 'Play Mozart to your baby.'],
    [2.253, 3.839, 'It’ll make them smarter.'],
    [4.58, 6.284, 'Not one baby was in the study.'],
    [7.28, 8.876, 'Thirty-six college students.'],
    [8.876, 10.233, 'Ten minutes of Mozart.'],
    [10.233, 12.32, 'Three spatial reasoning tasks.'],
    [12.32, 15.166, 'Within fifteen minutes, the boost was gone.'],
    [16.38, 17.832, 'The claim kept growing.'],
    [17.832, 22.765, 'In 1998, Georgia’s governor asked for $105,000'],
    [22.765, 25.672, 'to send every newborn in the state classical music.'],
    [27.98, 29.454, 'Thirty-six college students.'],
    [29.454, 30.734, 'Zero babies.'],
    [35.68, 37.767, 'Now the claims are about cancer drugs.'],
    [37.767, 39.59, 'AI writes one in seconds.'],
    [39.59, 41.18, 'Testing it takes a lab.'],
    [42.88, 44.181, 'Violema keeps the record.'],
    [44.181, 47.557, 'Each claim with its sources, its limits and its date.'],
  ],

  // Numbered as in the film. `read` says how the source was read on the check date.
  sources: [
    { n: 1, citation: 'Rauscher, Shaw and Ky. “Music and spatial task performance.” Nature 365, 611 (1993).', href: 'https://doi.org/10.1038/365611a0', read: 'Read in full from a copy hosted by the University of Wisconsin Oshkosh. The publisher’s page required a login.' },
    { n: 2, citation: 'Alix Spiegel. “‘Mozart Effect’ Was Just What We Wanted To Hear.” NPR, 28 June 2010.', href: 'https://www.kpbs.org/news/national/2010/06/27/mozart-effect-was-just-what-we-wanted-to-hear', read: 'Read through the KPBS reprint, dated 27 June 2010.' },
    { n: 3, citation: '“Classical music for babies? Yes, Georgia governor says.” Deseret News, 14 January 1998.', href: 'https://www.deseret.com/1998/1/14/19357794/classical-music-for-babies-yes-georgia-governor-says/', read: 'Read on the publisher’s site.' },
    { n: 4, citation: 'Florida Senate Bill 660 (1998), enrolled text, section 1.', href: 'https://www.flsenate.gov/Session/Bill/1998/660/BillText/er/HTML', read: 'Read on the Florida Senate site, with the bill’s history and its repeal.' },
    { n: 5, citation: 'Chabris. “Prelude or requiem for the ‘Mozart effect’?” Nature 400, 826 (1999), with Rauscher’s reply in the same issue.', href: 'https://www.chabris.com/Chabris1999a.pdf', read: 'Read in full from the author’s site.' },
    { n: 6, citation: 'Pietschnig, Voracek and Formann. “Mozart effect–Shmozart effect: A meta-analysis.” Intelligence 38(3), 314 (2010).', href: 'https://doi.org/10.1016/j.intell.2010.03.001', read: 'Read from a reproduction of the paper on Academia.edu. The publisher’s page did not load.' },
  ],

  // The record the film ends on, entry by entry: the text on screen, what the source says, and its limits.
  record: {
    claim: 'Listening to Mozart makes babies smarter',
    chip: 'Babies in the 1993 study: 0',
    entries: [
      {
        year: '1993',
        screen: '36 college students, three spatial tasks. Gone within 15 minutes.',
        refs: [1],
        found: '36 college students. Ten minutes of Mozart’s Sonata for Two Pianos in D major, K. 448. Three Stanford-Binet tasks: pattern analysis, multiple-choice matrices, and multiple-choice paper folding and cutting, one after each listening condition.',
        limits: 'The authors reported an effect confined to the 10 to 15 minutes of testing. They ran no delayed retest, so “gone within 15 minutes” restates their stated duration. It is not a measured fade. No babies took part.',
      },
      {
        year: '1998',
        screen: 'Georgia’s governor asks for $105,000. Florida writes classical music into law.',
        refs: [3, 4],
        found: 'Georgia’s governor asked the legislature for $105,000 to give CDs or cassettes of classical music to new parents, some 100,000 a year. Florida’s Senate Bill 660 required classical music in state-funded education and care programs for children from birth to five. It was approved on 21 May 1998 as chapter 98-70.',
        limits: 'Our sources show Georgia’s request, not whether it was approved or spent. Florida’s bill says family daycare centers “are encouraged, but not required, to comply”. The requirement later became section 411.0106 and was repealed effective 1 July 2013.',
        also: [['Bill history', FLORIDA.history], ['Section 411.0106, 2010', FLORIDA.statute], ['Chapter 2013-252, the repeal', FLORIDA.repeal]],
      },
      {
        year: '1999',
        screen: '16 studies. Average test-score effect equivalent to 1.4 IQ points.',
        refs: [5],
        found: 'Chabris pooled 16 studies. Across 20 comparisons of Mozart with silence, the average test-score effect was equivalent to 1.4 IQ points.',
        limits: 'The 1.4-point figure expresses an effect size in IQ units. It is not a measured gain in IQ. Rauscher replied in the same issue and disputed his reading.',
      },
      {
        year: '2010',
        screen: '39 studies. Little evidence for a Mozart-specific gain.',
        refs: [6],
        found: 'Pietschnig, Voracek and Formann pooled 39 studies with more than 3,000 participants, including unpublished theses.',
        limits: 'Their abstract says nearly 40 studies. They found a small difference between Mozart and other music (d = 0.15) and little evidence for an effect specific to Mozart.',
      },
    ],
    now: { year: '2026', screen: '2026 · this film' },
  },

  // Every spoken and on-screen line, in film order. `at` is where the beat starts in the cut.
  lines: [
    { at: 0, beat: 'Hook', kind: 'test', voice: 'Announcer', spoken: 'Play Mozart to your baby. It’ll make them smarter.', screen: ['Dramatization'], refs: [], note: 'The popular claim, voiced as a 1998 announcer. It is the claim the film tests. It does not quote any real advertisement.' },
    { at: 4.2, beat: 'Turn', kind: 'derived', voice: 'Narrator', spoken: 'Not one baby was in the study.', screen: [], refs: [1, 2], note: 'Every participant in the 1993 study was a college student.' },
    { at: 6.9, beat: 'The study', kind: 'sourced', voice: 'Narrator', spoken: 'Thirty-six college students. Ten minutes of Mozart. Three spatial reasoning tasks. Within fifteen minutes, the boost was gone.', screen: ['1993', '36 students', '10 minutes', '3 tasks'], refs: [1, 2], note: 'The paper ran no delayed retest. “Within fifteen minutes” restates the authors’ stated duration of 10 to 15 minutes.' },
    { at: 15.9, beat: 'The claim travels', kind: 'sourced', voice: 'Narrator', spoken: 'The claim kept growing. In 1998, Georgia’s governor asked for a hundred and five thousand dollars to send every newborn in the state classical music.', screen: ['Dramatization', 'Florida, 1998: classical music required in state-funded education and care programs for children from birth to five. Family daycare centers exempt.'], refs: [3, 4], note: 'A request, for CDs or cassettes. The 1998 report calls the recipients both new parents and newborns. Florida’s requirement was law from 1998 until its repeal, effective 1 July 2013. The film does not say daily: in the bill, “each day” may cover only the reading requirement.' },
    { at: 26.9, beat: 'Callback', kind: 'derived', voice: 'Narrator', spoken: 'Thirty-six college students. Zero babies.', screen: ['0 babies'], refs: [1, 2], note: 'The study’s sample, repeated.' },
    { at: 31.3, beat: 'Scale', kind: 'sourced', voice: null, spoken: null, screen: ['TESTED · 1993', '36', 'college students', 'Each dot is one person. Two different groups, drawn at one scale.', 'PROPOSED · 1998', 'about 100,000', 'new parents a year', 'Georgia’s governor asked for $105,000.', 'the 36, at the same scale', 'Babies in the 1993 study: 0'], refs: [1, 3], note: 'Two different groups. The 36 students were not drawn from the parents. The 1998 report counts new parents, some 100,000 a year, not babies, and it reports a request.' },
    { at: 35.3, beat: 'Why now', kind: 'argument', voice: 'Narrator', spoken: 'Now the claims are about cancer drugs. AI writes one in seconds. Testing it takes a lab.', screen: [], refs: [], note: 'No source is cited. This is the film’s reason the record matters now, not a measured comparison.' },
    { at: 42.5, beat: 'The record', kind: 'product', voice: 'Narrator', spoken: 'Violema keeps the record. Each claim with its sources, its limits and its date.', screen: ['THE RECORD', 'Claim: “Listening to Mozart makes babies smarter”', 'Babies in the 1993 study: 0', '2026 · this film'], refs: [1, 3, 4, 5, 6], note: 'This page is that record. The four dated entries on screen are under The record, with their sources and limits. Keeping a record is not independent scientific review.' },
    { at: 48.2, beat: 'End card', kind: 'card', voice: 'Narrator', spoken: 'Violema. Where science keeps score.', screen: ['Where science keeps score.', 'violema.com/films/zero-babies', 'Scenes are generated. Six sources.'], refs: [], note: 'The six sources are listed below. What the scenes show is described under the film.' },
  ],

  disclosures: [
    'Every scene is generated. None of it is archival footage.',
    'The people on screen are dramatizations, including Georgia’s governor and the baby. They are not footage of real people.',
    'The newspaper and the disc are invented props.',
    'The opening line voices the popular claim. It does not quote any real advertisement.',
    'The record near the end is an animation, not a screen recording of a product.',
    'The voices are generated.',
    'Six sources, numbered in the film as on this page.',
  ],

  notClaimed: [
    'It does not say the 1993 result was false. The study reported a short-lived effect on spatial tasks in college students.',
    'It does not say music has no effect on babies. A study of adults cannot show an effect in babies, and it cannot rule one out.',
    'It does not say the study’s authors promised smarter babies. Applying the result to children came later.',
    'It does not say Georgia’s request was approved or spent. Our sources show only the request.',
    'It does not say Florida’s requirement is law today. It was repealed effective 1 July 2013.',
    'It does not present the line about cancer drugs as a finding. It is the film’s argument, and no source is cited for it.',
  ],

  checkedBy: 'Checked against the sources on 15 November 2026. AI models read each source, including the full 1993 paper, and an AI model also reviewed the record in the role of a music-cognition researcher. Violema’s founder approved the wording of the film and of this page. No independent human expert has reviewed this record. Violema made the film to promote its business.',
});

export const FILMS = Object.freeze([ZERO_BABIES]);
