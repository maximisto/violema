/**
 * Operator-owned business context: the workspace-level answer to "whose
 * business is this?" that seeded steps consume at run time.
 *
 * Seeds used to hardcode Violema's own market into search queries, and
 * `mergeSeedIntoStoredAutomation` keeps steps seed-owned on purpose — so any
 * operator edit to step content died at the next seed bump (proven live,
 * 2026-08-05). Steps now carry `use_business_context: true` + `query_suffix`
 * and this module composes the real query per workspace. Pure by design: the
 * store accessors live in workspace.ts, everything here is testable without
 * I/O.
 */
import type { PersistedAutomationStep, WorkspaceBusinessContext } from './types';

export const BUSINESS_CONTEXT_LIMITS = {
  summaryLength: 300,
  keywords: 10,
  keywordLength: 40,
  competitors: 20,
  competitorLength: 100,
  exclusions: 10,
  exclusionLength: 60,
  composedQueryLength: 400,
} as const;

export interface BusinessContextInput {
  summary?: unknown;
  marketKeywords?: unknown;
  competitors?: unknown;
  exclusions?: unknown;
}

export type BusinessContextValue = Pick<
  WorkspaceBusinessContext,
  'summary' | 'marketKeywords' | 'competitors' | 'exclusions'
>;

export function isBusinessContextSet(
  ctx: WorkspaceBusinessContext | null | undefined,
): ctx is WorkspaceBusinessContext {
  return Boolean(ctx && ctx.summary.trim() && ctx.marketKeywords.length >= 1);
}

function normalizeList(
  value: unknown,
  field: string,
  maxItems: number,
  maxLength: number,
  errors: string[],
): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    errors.push(`${field} must be an array of strings.`);
    return [];
  }
  const items = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
  if (items.length > maxItems) {
    errors.push(`${field} allows at most ${maxItems} entries.`);
    return [];
  }
  const tooLong = items.find((item) => item.length > maxLength);
  if (tooLong) {
    errors.push(`${field} entries must be at most ${maxLength} characters.`);
    return [];
  }
  return items;
}

export function validateBusinessContextInput(
  input: BusinessContextInput,
): { ok: true; value: BusinessContextValue } | { ok: false; errors: string[] } {
  const errors: string[] = [];

  const summary = typeof input.summary === 'string' ? input.summary.trim() : '';
  if (!summary) errors.push('summary is required.');
  else if (summary.length > BUSINESS_CONTEXT_LIMITS.summaryLength) {
    errors.push(`summary must be at most ${BUSINESS_CONTEXT_LIMITS.summaryLength} characters.`);
  }

  const marketKeywords = normalizeList(
    input.marketKeywords, 'marketKeywords',
    BUSINESS_CONTEXT_LIMITS.keywords, BUSINESS_CONTEXT_LIMITS.keywordLength, errors,
  );
  if (marketKeywords.length === 0 && !errors.some((error) => error.startsWith('marketKeywords'))) {
    errors.push('marketKeywords needs at least one entry.');
  }

  const competitors = normalizeList(
    input.competitors, 'competitors',
    BUSINESS_CONTEXT_LIMITS.competitors, BUSINESS_CONTEXT_LIMITS.competitorLength, errors,
  );
  const exclusions = normalizeList(
    input.exclusions, 'exclusions',
    BUSINESS_CONTEXT_LIMITS.exclusions, BUSINESS_CONTEXT_LIMITS.exclusionLength, errors,
  );

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      summary,
      marketKeywords,
      competitors,
      exclusions: exclusions.length ? exclusions : undefined,
    },
  };
}

export function composeSearchQuery(ctx: WorkspaceBusinessContext, querySuffix: string): string {
  const parts = [...ctx.marketKeywords, querySuffix, ...ctx.competitors];
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    kept.push(trimmed);
  }
  return kept.join(' ').slice(0, BUSINESS_CONTEXT_LIMITS.composedQueryLength).trim();
}

export function contextPreamble(ctx: WorkspaceBusinessContext): string {
  const lines = [
    `Business context for this account: ${ctx.summary}`,
    `Market: ${ctx.marketKeywords.join(', ')}.`,
  ];
  if (ctx.competitors.length) lines.push(`Named competitors: ${ctx.competitors.join(', ')}.`);
  if (ctx.exclusions?.length) lines.push(`Avoid: ${ctx.exclusions.join(', ')}.`);
  return lines.join(' ');
}

/**
 * Resolve one persisted step against the workspace's context. Steps that did
 * not opt in pass through untouched — byte-identical behavior for everything
 * that exists today. With no context, opted-in steps also pass through: the
 * run gate blocks non-demo runs first, and demo workspaces deliberately fall
 * back to the objective-inferred query.
 */
export function applyBusinessContextToStep(
  step: PersistedAutomationStep,
  ctx: WorkspaceBusinessContext | null,
): PersistedAutomationStep {
  const inputs = step.inputs;
  if (!inputs || inputs.use_business_context !== true || !isBusinessContextSet(ctx)) return step;

  if (step.kind === 'search') {
    const suffix = typeof inputs.query_suffix === 'string' ? inputs.query_suffix : '';
    const numResults = typeof inputs.num_results === 'number' ? inputs.num_results : 6;
    return { ...step, inputs: { query: composeSearchQuery(ctx, suffix), num_results: numResults } };
  }

  if (step.kind === 'analyze' || step.kind === 'summarize') {
    const instruction = typeof inputs.instruction === 'string' && inputs.instruction.trim()
      ? inputs.instruction
      : step.objective;
    return { ...step, inputs: { ...inputs, instruction: `${contextPreamble(ctx)}\n\n${instruction}` } };
  }

  return step;
}
