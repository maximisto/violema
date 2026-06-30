import type { PersistedAutomationStep } from './types';

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function normalizePersistedAutomationSteps(input: unknown[]): PersistedAutomationStep[] {
  return input.reduce<PersistedAutomationStep[]>((steps, item, index) => {
    if (!isObjectRecord(item)) return steps;
    const kind = typeof item.kind === 'string' ? item.kind.trim().toLowerCase() : '';
    if (!['search', 'query', 'summarize', 'deliver', 'capture', 'analyze', 'note'].includes(kind)) return steps;

    const objectiveCandidate = typeof item.objective === 'string'
      ? item.objective.trim()
      : typeof item.title === 'string'
        ? item.title.trim()
        : '';
    if (!objectiveCandidate) return steps;

    let deliveryTarget: PersistedAutomationStep['deliveryTarget'] = null;
    if (
      isObjectRecord(item.deliveryTarget) &&
      (item.deliveryTarget.channel === 'slack' || item.deliveryTarget.channel === 'email') &&
      typeof item.deliveryTarget.target === 'string' &&
      item.deliveryTarget.target.trim()
    ) {
      deliveryTarget = {
        channel: item.deliveryTarget.channel,
        target: item.deliveryTarget.target.trim(),
      };
    }

    const normalized: PersistedAutomationStep = {
      id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `step_${index + 1}`,
      kind: kind as PersistedAutomationStep['kind'],
      title: typeof item.title === 'string' && item.title.trim() ? item.title.trim() : undefined,
      objective: objectiveCandidate,
      inputs: isObjectRecord(item.inputs) ? item.inputs : undefined,
      deliveryTarget,
    };
    if (item.optional === true) {
      normalized.optional = true;
    }

    steps.push(normalized);
    return steps;
  }, []);
}
