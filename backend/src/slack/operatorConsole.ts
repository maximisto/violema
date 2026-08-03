// Renders the deterministic intent replies.
//
// Pure formatting over records the caller reads from the stores, so the wording
// is testable without a server. Every number here is counted from real task and
// run state — this surface never estimates, and when it has nothing to report
// it says so rather than implying quiet success.

import type { TaskRecord, TaskRunRecord } from '../platform/types';

export interface ConsoleAutomation {
  id: string;
  name: string;
  schedule?: string;
  next_run_at?: string;
  status?: string;
}

export interface OperatorConsoleData {
  automations: ConsoleAutomation[];
  tasks: TaskRecord[];
  taskRuns: TaskRunRecord[];
}

/** Where a review card was posted, so a reply can point at it. */
export interface ReviewCardLocation {
  channel: string;
  ts: string;
}

export function readReviewCardLocation(taskRun: TaskRunRecord): ReviewCardLocation | null {
  const record = taskRun.metadata?.slackReviewMessage;
  if (!record || typeof record !== 'object') return null;
  const { channel, ts } = record as Record<string, unknown>;
  if (typeof channel !== 'string' || typeof ts !== 'string' || !channel || !ts) return null;
  return { channel, ts };
}

function automationNameFor(task: TaskRecord, automations: ConsoleAutomation[]) {
  const automationId = typeof task.metadata?.automationId === 'string' ? task.metadata.automationId : '';
  const match = automations.find((automation) => automation.id === automationId);
  return match?.name || task.title || 'Untitled mission';
}

function formatWhen(value: string | undefined) {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
}

/** Waiting reviews, newest first, paired with the run that produced them. */
export function collectWaitingReviews(data: OperatorConsoleData) {
  return data.tasks
    .filter((task) => task.status === 'waiting_review')
    .map((task) => {
      const taskRun = data.taskRuns
        .filter((run) => run.taskId === task.id)
        .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt))[0];
      return {
        task,
        taskRun,
        missionName: automationNameFor(task, data.automations),
        card: taskRun ? readReviewCardLocation(taskRun) : null,
      };
    })
    .filter((item) => Boolean(item.taskRun));
}

export function buildStatusReply(data: OperatorConsoleData): string {
  const running = data.tasks.filter((task) => task.status === 'running').length;
  const waiting = data.tasks.filter((task) => task.status === 'waiting_review').length;
  const blocked = data.tasks.filter((task) => task.status === 'blocked').length;

  const lines = [
    `*Violema status* — ${running} running · ${waiting} waiting review · ${blocked} blocked`,
  ];

  const waitingReviews = collectWaitingReviews(data);
  if (waitingReviews.length > 0) {
    lines.push('', '*Waiting on you*');
    for (const review of waitingReviews) {
      const location = review.card ? ` — card in <#${review.card.channel}>` : '';
      lines.push(`• ${review.missionName}${location}`);
    }
  }

  const upcoming = data.automations
    .filter((automation) => automation.status !== 'paused' && automation.next_run_at)
    .sort((left, right) => Date.parse(left.next_run_at || '') - Date.parse(right.next_run_at || ''))
    .slice(0, 3);

  if (upcoming.length > 0) {
    lines.push('', '*Next scheduled*');
    for (const automation of upcoming) {
      const when = formatWhen(automation.next_run_at);
      lines.push(`• ${automation.name}${when ? ` — ${when}` : ''}`);
    }
  }

  if (running === 0 && waiting === 0 && blocked === 0 && upcoming.length === 0) {
    lines.push('', 'Nothing is running and nothing is scheduled.');
  }

  return lines.join('\n');
}

export function buildReviewsReply(data: OperatorConsoleData): string {
  const waitingReviews = collectWaitingReviews(data);
  if (waitingReviews.length === 0) {
    return 'Nothing is waiting for approval right now.';
  }

  const lines = [`*${waitingReviews.length} waiting for approval*`];
  for (const review of waitingReviews) {
    const location = review.card
      ? ` — approve on the card in <#${review.card.channel}>`
      : ' — approve from the dashboard';
    lines.push(`• ${review.missionName}${location}`);
  }

  return lines.join('\n');
}

export function buildHelpReply(canOperate: boolean): string {
  const lines = [
    '*What I can do here*',
    '• `status` — what is running, waiting review, or blocked, plus what is scheduled next',
    '• `reviews` — everything waiting for approval',
    '• `run <mission name>` — start a mission now',
    '• `latest <mission name>` — repost the most recent brief a mission produced',
    '• `help` — this list',
    '',
    'Approve and request-changes happen on the review card I post when a run is ready.',
  ];

  if (!canOperate) {
    lines.push(
      '',
      'You can read status and reviews. Running missions and approving are limited to workspace operators.',
    );
  }

  lines.push('', 'Anything else and I answer normally.');
  return lines.join('\n');
}

export function buildAmbiguousRunReply(query: string, options: ConsoleAutomation[]): string {
  const lines = [`"${query}" matches ${options.length} missions. Which one?`];
  for (const option of options) {
    lines.push(`• ${option.name}`);
  }
  lines.push('', 'Nothing started — reply with the full name.');
  return lines.join('\n');
}

/** The most recent stored brief for a mission, or null when no run kept one. */
export interface LatestBrief {
  run: TaskRunRecord;
  markdown: string;
  title?: string;
  delivered: boolean;
  deliveryTarget?: string;
}

export function findLatestBrief(data: OperatorConsoleData, automationId: string): LatestBrief | null {
  const runs = data.taskRuns
    .filter((run) => run.metadata?.automationId === automationId)
    .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt));

  for (const run of runs) {
    const artifacts = Array.isArray(run.metadata?.artifacts)
      ? (run.metadata.artifacts as Array<{ kind?: unknown; title?: unknown; payload?: Record<string, unknown> }>)
      : [];
    const artifact = artifacts.find((item) =>
      item &&
      item.kind === 'review_gate' &&
      typeof item.payload?.markdown === 'string' &&
      (item.payload.markdown as string).trim().length > 0
    );
    if (!artifact) continue;

    const receipt = run.metadata?.reviewReceipt as { status?: unknown } | undefined;
    const deliveryTarget = artifact.payload?.deliveryTarget;
    return {
      run,
      markdown: artifact.payload?.markdown as string,
      ...(typeof artifact.title === 'string' && artifact.title ? { title: artifact.title } : {}),
      delivered: receipt?.status === 'delivered',
      ...(typeof deliveryTarget === 'string' && deliveryTarget ? { deliveryTarget } : {}),
    };
  }

  return null;
}

/**
 * The whole brief, reposted, with its provenance stated first: which run it
 * came from and whether a human approved it. A repost must never read as a
 * fresh delivery — that distinction is the review gate's entire point.
 */
export function buildLatestBriefReply(automation: ConsoleAutomation, brief: LatestBrief): string {
  const when = formatWhen(brief.run.startedAt);
  const provenance = brief.delivered
    ? `approved and delivered${brief.deliveryTarget ? ` to ${brief.deliveryTarget}` : ''}`
    : 'not yet approved for delivery';

  return [
    `*Latest from ${automation.name}*${brief.title ? ` — ${brief.title}` : ''}`,
    `_Run started ${when || 'recently'} · ${provenance}._`,
    '',
    brief.markdown,
  ].join('\n');
}

export function buildNoBriefReply(automation: ConsoleAutomation): string {
  return [
    `*${automation.name}* has no stored brief yet — no run has produced one that was kept.`,
    `Say \`run ${automation.name}\` and I will prepare a fresh one for review.`,
  ].join('\n');
}

export function buildAmbiguousLatestReply(query: string, options: ConsoleAutomation[]): string {
  const lines = [`"${query}" matches ${options.length} missions. Whose brief do you want?`];
  for (const option of options) {
    lines.push(`• \`latest ${option.name}\``);
  }
  return lines.join('\n');
}

export function buildUnknownMissionReply(query: string, automations: ConsoleAutomation[]): string {
  const lines = [`I could not find a mission matching "${query}".`];
  if (automations.length > 0) {
    lines.push('', '*Missions in this workspace*');
    for (const automation of automations.slice(0, 8)) {
      lines.push(`• ${automation.name}`);
    }
  } else {
    lines.push('', 'This workspace has no missions yet.');
  }
  return lines.join('\n');
}
