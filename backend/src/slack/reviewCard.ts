// Block Kit for the interactive review card.
//
// `slackBlocks.ts` renders delivery prose and its SlackBlock union has no
// `actions` variant. Widening that union would touch every existing send, so
// the interactive block shapes live here instead — this file owns the one
// message type that carries buttons.
//
// The card is the Slack half of a two-surface state machine: it must always be
// possible to look at the message and know whether the review is still open,
// and if not, who closed it and when. That is why the resolved card drops the
// buttons entirely rather than disabling them.

export const SLACK_APPROVE_ACTION_ID = 'violema_review_approve';
export const SLACK_REQUEST_CHANGES_ACTION_ID = 'violema_review_request_changes';

interface SlackPlainText {
  type: 'plain_text';
  text: string;
  emoji?: boolean;
}

interface SlackMrkdwn {
  type: 'mrkdwn';
  text: string;
}

export interface SlackButtonElement {
  type: 'button';
  action_id: string;
  text: SlackPlainText;
  value: string;
  style?: 'primary' | 'danger';
  confirm?: {
    title: SlackPlainText;
    text: SlackMrkdwn;
    confirm: SlackPlainText;
    deny: SlackPlainText;
    style?: 'primary' | 'danger';
  };
}

export type SlackInteractiveBlock =
  | { type: 'header'; text: SlackPlainText }
  | { type: 'section'; text: SlackMrkdwn }
  | { type: 'context'; elements: SlackMrkdwn[] }
  | { type: 'divider' }
  | { type: 'actions'; block_id?: string; elements: SlackButtonElement[] };

export interface ReviewActionValue {
  automationId: string;
  runId: string;
  workspaceId: string;
}

const HEADER_LIMIT = 148;
const SECTION_LIMIT = 2900;

function truncate(value: string, limit: number) {
  const text = (value || '').trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1)}…`;
}

export function buildReviewActionValue(value: ReviewActionValue): string {
  // Slack caps a button value at 2000 chars; ids are short, so this is only
  // ever routing data — never the brief body.
  return JSON.stringify({ a: value.automationId, r: value.runId, w: value.workspaceId });
}

export function parseReviewActionValue(raw: string | undefined | null): ReviewActionValue | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const automationId = typeof parsed.a === 'string' ? parsed.a : '';
    const runId = typeof parsed.r === 'string' ? parsed.r : '';
    const workspaceId = typeof parsed.w === 'string' ? parsed.w : '';
    if (!automationId || !runId || !workspaceId) return null;
    return { automationId, runId, workspaceId };
  } catch {
    return null;
  }
}

export function buildReviewRequestBlocks(input: {
  missionName: string;
  deliveryTarget: string;
  summary?: string;
  automationId: string;
  runId: string;
  workspaceId: string;
}): SlackInteractiveBlock[] {
  const value = buildReviewActionValue({
    automationId: input.automationId,
    runId: input.runId,
    workspaceId: input.workspaceId,
  });

  const blocks: SlackInteractiveBlock[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: truncate(`Ready for review: ${input.missionName}`, HEADER_LIMIT), emoji: true },
    },
  ];

  const summary = truncate(input.summary || '', SECTION_LIMIT);
  if (summary) {
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: summary } });
  }

  blocks.push({
    type: 'context',
    elements: [{
      type: 'mrkdwn',
      text: `Delivers to *${input.deliveryTarget}* on approval · run \`${input.runId}\``,
    }],
  });

  blocks.push({
    type: 'actions',
    block_id: 'violema_review_actions',
    elements: [
      {
        type: 'button',
        action_id: SLACK_APPROVE_ACTION_ID,
        text: { type: 'plain_text', text: 'Approve and deliver', emoji: true },
        style: 'primary',
        value,
        // Approving performs a real, irreversible send. One deliberate
        // confirmation is cheap; an accidental delivery is not.
        confirm: {
          title: { type: 'plain_text', text: 'Send this delivery?' },
          text: {
            type: 'mrkdwn',
            text: `This delivers *${truncate(input.missionName, 120)}* to *${input.deliveryTarget}* for real.`,
          },
          confirm: { type: 'plain_text', text: 'Send it' },
          deny: { type: 'plain_text', text: 'Cancel' },
          style: 'primary',
        },
      },
      {
        type: 'button',
        action_id: SLACK_REQUEST_CHANGES_ACTION_ID,
        text: { type: 'plain_text', text: 'Request changes', emoji: true },
        value,
      },
    ],
  });

  return blocks;
}

export type ReviewResolvedOutcome =
  | 'approved'
  | 'changes_requested'
  | 'already_resolved'
  | 'blocked';

const OUTCOME_LABELS: Record<ReviewResolvedOutcome, string> = {
  approved: 'Approved and delivered',
  changes_requested: 'Changes requested',
  already_resolved: 'Already handled',
  blocked: 'Not delivered',
};

export function buildReviewResolvedBlocks(input: {
  missionName: string;
  outcome: ReviewResolvedOutcome;
  detail: string;
  actorLabel: string;
  resolvedAt: string;
}): SlackInteractiveBlock[] {
  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: truncate(`${OUTCOME_LABELS[input.outcome]}: ${input.missionName}`, HEADER_LIMIT),
        emoji: true,
      },
    },
    { type: 'section', text: { type: 'mrkdwn', text: truncate(input.detail, SECTION_LIMIT) } },
    {
      type: 'context',
      elements: [{
        type: 'mrkdwn',
        text: `${input.actorLabel} · ${input.resolvedAt}`,
      }],
    },
  ];
}

/** Plain-text fallback for clients that cannot render blocks (and for notifications). */
export function buildReviewFallbackText(input: { missionName: string; deliveryTarget: string }) {
  return `Ready for review: ${input.missionName} — delivers to ${input.deliveryTarget} on approval.`;
}
