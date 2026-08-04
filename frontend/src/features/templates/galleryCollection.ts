/**
 * Which live missions claim template cards, and which render as custom cards.
 *
 * Field observation, 2026-08-04: the founder workspace held two automations
 * both named "Competitor monitor" (platform seed + workspace copy). The old
 * Map-based claim kept only the newest under the shared title — the other fell
 * through to "Your missions" as a duplicate card, and the six-mission
 * collection read as eight. Same-name missions now fold into a single claim:
 * the newest (last in API order) fronts the card, and no same-titled sibling
 * renders separately. Same-name resolution by recency is the platform-wide
 * rule (Slack verbs resolve reads the same way).
 */

export interface CollectionMission {
  key: string;
  title: string;
}

/** Legacy or renamed live missions that should claim a template card anyway. */
const TEMPLATE_TITLE_ALIASES: Record<string, string> = {
  'weekly founder update': 'weekly founder brief',
};

export const normalizeMissionTitle = (title: string) => {
  const normalized = title.trim().toLowerCase();
  return TEMPLATE_TITLE_ALIASES[normalized] ?? normalized;
};

export function partitionCollectionMissions<M extends CollectionMission>(
  templateTitles: string[],
  missions: M[],
): { liveByTitle: Map<string, M>; customMissions: M[] } {
  // Map construction keeps the LAST same-title mission — API order is storage
  // order, so the newest copy fronts the card.
  const liveByTitle = new Map(missions.map((mission) => [normalizeMissionTitle(mission.title), mission]));
  const claimedTitles = new Set(
    templateTitles.map(normalizeMissionTitle).filter((title) => liveByTitle.has(title)),
  );
  return {
    liveByTitle,
    customMissions: missions.filter((mission) => !claimedTitles.has(normalizeMissionTitle(mission.title))),
  };
}
