export function readPositiveIntegerEnv(name: string, fallback: number) {
  const parsed = Number(process.env[name] || fallback);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.trunc(parsed);
}

export function parseToolResultPayload(result: string): unknown {
  try {
    return JSON.parse(result);
  } catch {
    return {
      raw: result,
      parse_error: true,
    };
  }
}

export function buildToolLoopCapMessage(maxToolIterations: number) {
  return `\n\nI hit the ${maxToolIterations}-step tool limit for this task, so I stopped before spending more credits. Narrow the request or continue with a smaller next step.`;
}
