import type { ModelTier, TaskKind, UsageEvent } from './types';

export interface CostEstimateInput {
  taskKind: TaskKind;
  modelTier: ModelTier;
  toolCalls?: number;
  automationRuns?: number;
  reviewRequired?: boolean;
  artifactCount?: number;
  complexity?: 'low' | 'medium' | 'high';
  durationSeconds?: number;
}

export interface CostEstimateBreakdown {
  baseCredits: number;
  modelCredits: number;
  toolCredits: number;
  automationCredits: number;
  reviewCredits: number;
  artifactCredits: number;
  durationCredits: number;
  complexityCredits: number;
}

export interface RuntimeCreditInput {
  taskKind: TaskKind;
  modelTier: ModelTier;
  toolCalls?: number;
  artifactCount?: number;
  complexity?: 'low' | 'medium' | 'high';
  durationSeconds?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface RuntimeCreditResult {
  actualCredits: number;
  breakdown: {
    baseCredits: number;
    tokenCredits: number;
    toolCredits: number;
    artifactCredits: number;
    durationCredits: number;
    complexityCredits: number;
  };
  rationale: string[];
}

export interface CostEstimate {
  estimatedCredits: number;
  breakdown: CostEstimateBreakdown;
  rationale: string[];
}

const BASE_TASK_CREDITS: Record<TaskKind, number> = {
  chat: 5,
  research: 18,
  analysis: 16,
  engineering: 24,
  automation: 12,
  message: 4,
  report: 18,
  review: 10,
  scheduling: 8,
};

const MODEL_TIER_CREDITS: Record<ModelTier, number> = {
  micro: 0,
  default: 6,
  hard: 20,
  critical: 42,
  ops: 12,
};

export const DEFAULT_TOOL_CREDIT_COST = 4;
export const DEFAULT_AUTOMATION_RUN_CREDIT_COST = 15;
export const DEFAULT_REVIEW_CREDIT_COST = 8;
export const DEFAULT_ARTIFACT_CREDIT_COST = 5;
export const DEFAULT_DURATION_CREDIT_COST_PER_MINUTE = 2;
const MODEL_TIER_CREDITS_PER_1K_TOKENS: Record<ModelTier, number> = {
  micro: 1,
  default: 4,
  hard: 10,
  critical: 18,
  ops: 5,
};

function normalizeCount(value?: number): number {
  if (!value || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

export function estimateCreditCost(input: CostEstimateInput): CostEstimate {
  const baseCredits = BASE_TASK_CREDITS[input.taskKind] || 0;
  const modelCredits = MODEL_TIER_CREDITS[input.modelTier] || 0;
  const toolCredits = normalizeCount(input.toolCalls) * DEFAULT_TOOL_CREDIT_COST;
  const automationCredits = normalizeCount(input.automationRuns) * DEFAULT_AUTOMATION_RUN_CREDIT_COST;
  const reviewCredits = input.reviewRequired ? DEFAULT_REVIEW_CREDIT_COST : 0;
  const artifactCredits = normalizeCount(input.artifactCount) * DEFAULT_ARTIFACT_CREDIT_COST;
  const durationCredits = Math.ceil(normalizeCount(input.durationSeconds) / 60) * DEFAULT_DURATION_CREDIT_COST_PER_MINUTE;
  const complexityCredits =
    input.complexity === 'high' ? 12 : input.complexity === 'medium' ? 5 : 0;

  const estimatedCredits =
    baseCredits +
    modelCredits +
    toolCredits +
    automationCredits +
    reviewCredits +
    artifactCredits +
    durationCredits +
    complexityCredits;

  const rationale = [
    `base:${baseCredits}`,
    `model:${modelCredits}`,
    `tools:${toolCredits}`,
    `automation:${automationCredits}`,
    `review:${reviewCredits}`,
    `artifacts:${artifactCredits}`,
    `duration:${durationCredits}`,
    `complexity:${complexityCredits}`,
  ];

  return {
    estimatedCredits,
    breakdown: {
      baseCredits,
      modelCredits,
      toolCredits,
      automationCredits,
      reviewCredits,
      artifactCredits,
      durationCredits,
      complexityCredits,
    },
    rationale,
  };
}

export function estimateUsageEventCredits(event: UsageEvent): number {
  if (typeof event.deltaCredits === 'number') {
    return Math.trunc(event.deltaCredits);
  }

  const inferredTaskKind: TaskKind = event.kind.includes('automation')
    ? 'automation'
    : event.kind.includes('review')
      ? 'review'
      : event.kind.includes('report')
        ? 'report'
        : 'chat';

  return estimateCreditCost({
    taskKind: inferredTaskKind,
    modelTier: event.modelTier || 'default',
    toolCalls: event.toolCount,
    durationSeconds: event.durationMs ? Math.ceil(event.durationMs / 1000) : undefined,
  }).estimatedCredits;
}

// Blended provider cost in USD per 1M tokens (input-heavy 3:1 ratio weighted average).
// Used only for margin reporting; does not affect credit billing.
const PROVIDER_COST_USD_PER_1M_TOKENS: Record<ModelTier, number> = {
  micro: 0.10,
  default: 6.00,
  hard: 15.00,
  critical: 30.00,
  ops: 0.20,
};

// Approximate USD value of one credit at Start-plan rates ($79 / 2000 credits).
export const CREDIT_VALUE_USD = 0.0395;

export function estimateProviderCostUsd(modelTier: ModelTier, totalTokens: number): number {
  const ratePerMillion = PROVIDER_COST_USD_PER_1M_TOKENS[modelTier] ?? 6.00;
  return (totalTokens / 1_000_000) * ratePerMillion;
}

export function calculateRuntimeCredits(input: RuntimeCreditInput): RuntimeCreditResult {
  const baseCredits = BASE_TASK_CREDITS[input.taskKind] || 0;
  const toolCredits = normalizeCount(input.toolCalls) * DEFAULT_TOOL_CREDIT_COST;
  const artifactCredits = normalizeCount(input.artifactCount) * DEFAULT_ARTIFACT_CREDIT_COST;
  const durationCredits = Math.ceil(normalizeCount(input.durationSeconds) / 60) * DEFAULT_DURATION_CREDIT_COST_PER_MINUTE;
  const complexityCredits =
    input.complexity === 'high' ? 12 : input.complexity === 'medium' ? 5 : 0;

  const totalTokens =
    normalizeCount(input.totalTokens) ||
    normalizeCount(input.inputTokens) + normalizeCount(input.outputTokens);
  const tokenCredits =
    totalTokens > 0
      ? Math.max(1, Math.ceil(totalTokens / 1000) * (MODEL_TIER_CREDITS_PER_1K_TOKENS[input.modelTier] || 0))
      : 0;

  const actualCredits =
    baseCredits +
    tokenCredits +
    toolCredits +
    artifactCredits +
    durationCredits +
    complexityCredits;

  return {
    actualCredits,
    breakdown: {
      baseCredits,
      tokenCredits,
      toolCredits,
      artifactCredits,
      durationCredits,
      complexityCredits,
    },
    rationale: [
      `base:${baseCredits}`,
      `tokens:${tokenCredits}`,
      `tools:${toolCredits}`,
      `artifacts:${artifactCredits}`,
      `duration:${durationCredits}`,
      `complexity:${complexityCredits}`,
    ],
  };
}
