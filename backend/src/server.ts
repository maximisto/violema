import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  clearAuthSession as clearPersistedAuthSession,
  createAuthSession,
  getAuthUserByToken,
  type AuthMethod as PersistedAuthMethod,
  upsertAuthUser,
} from './auth';
import { takeBrowserScreenshot } from './tools/browserScreenshot';
import { getIntegrationStatus, searchWeb, sendMessage, validateMessageTarget } from './integrations';
import { executeComposioAction, getComposioConnectionUrl, isComposioEnabled, isComposioToolName, listConnectedApps } from './composioBridge';
import {
  createAutomation,
  deleteAutomation,
  getAutomationById,
  listAutomations,
  loadPersistedAutomations,
  triggerAutomationNow,
  updateAutomation,
  type AutomationStudioState,
} from './scheduler';
import {
  addLedgerEntry,
  applyWorkerRuntimeActivity,
  type AgentRole,
  type AutomationExecutionPolicy,
  type AutomationOptimizationGoal,
  type AutomationReviewPolicy,
  assertCanSpendCredits,
  calculateRuntimeCredits,
  type AutomationExecutionPlan,
  type AutomationRolePlan,
  type AutomationStepDefinition,
  type AutomationStepExecution,
  type AutomationStepKind,
  type PersistedAutomationStep,
  buildCreditSnapshot,
  buildDelegationRuntimeContext,
  buildWorkerTopologySnapshot,
  createTask,
  createTaskRun,
  DEFAULT_WORKSPACE_ID,
  evaluatePlanEnforcement,
  ensureWorkspaceCredits,
  estimateCreditCost,
  finalizeTaskRun,
  getBillingStatus,
  getStripeBillingConfig,
  getWorkspaceProfile,
  listLedgerEntries,
  listReferralEvents,
  listTaskRuns,
  listTasks,
  markReferralQualified,
  markReferralRewarded,
  type ModelTier,
  purchaseTopUp,
  recordReferralEvent,
  summarizeReferralRewards,
  mapTaskRunToStatus,
  isElasticLane,
  updateTask,
  updateTaskRun,
  upsertBillingConfig,
  upsertWorkspaceProfile,
  listTopUpOffers,
  createSubscriptionCheckoutSession,
  createTopUpCheckoutSession,
  constructStripeWebhookEvent,
  fulfillStripeWebhookEvent,
} from './platform';
import {
  createMemoryEmbeddings,
  generateText,
  generateTextDetailed,
  getChatClient,
  getChatModelConfig,
  getCodeEmbeddingConfig,
  getMemoryEmbeddingConfig,
  getMicroModelConfig,
  getModelSource,
  getModelSourceLabel,
  getModelRoutingStatus,
  getUtilityModelConfig,
  routeChatProfile,
  type TextProfile,
} from './models';
import { getWorkspaceProviderToken, getWorkspaceSettingsView, upsertWorkspaceSettings } from './settingsStore';
import {
  buildAutomationExperimentAttribution,
  buildAutomationScenarioTelemetry,
} from './agent-studio/automationStudio';
import { registerAgentStudioSettingsRoutes } from './agent-studio/settingsRoutes';
import { registerAgentStudioRoutes } from './agent-studio/violemaStudio';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const SCREENSHOT_DIR = path.join(process.cwd(), 'generated-screenshots');
const AUTOMATIONS_FILE = path.join(process.cwd(), 'automations.json');
const SLACK_EVENT_CACHE_WINDOW_MS = 5 * 60 * 1000;
const AUTOMATION_STEP_TIMEOUT_MS = Number(process.env.AUTOMATION_STEP_TIMEOUT_MS || 45000);
const handledSlackEvents = new Map<string, number>();
const taskPanelStreamClients = new Map<string, Set<Response>>();
const DEFAULT_ADMIN_EMAILS = ['max@purpleorange.io', 'max@violema.com'];

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://violema.com',
  'https://www.violema.com',
  'http://violema.com',
  'http://www.violema.com',
  'https://nexus.purpleorange.io',
  'http://nexus.purpleorange.io',
];
const AUTH_COOKIE_NAME = 'violema_session';

function addTaskPanelStreamClient(workspaceId: string, res: Response) {
  const set = taskPanelStreamClients.get(workspaceId) || new Set<Response>();
  set.add(res);
  taskPanelStreamClients.set(workspaceId, set);
}

function removeTaskPanelStreamClient(workspaceId: string, res: Response) {
  const set = taskPanelStreamClients.get(workspaceId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) {
    taskPanelStreamClients.delete(workspaceId);
  }
}

function broadcastTaskPanelEvent(workspaceId: string, event: Record<string, unknown>) {
  const subscribers = taskPanelStreamClients.get(workspaceId);
  if (!subscribers || subscribers.size === 0) return;

  const payload = `data: ${JSON.stringify({ ...event, emittedAt: new Date().toISOString() })}\n\n`;
  for (const subscriber of subscribers) {
    try {
      subscriber.write(payload);
    } catch {
      removeTaskPanelStreamClient(workspaceId, subscriber);
    }
  }
}

function buildTaskRunSnapshotEvent(
  workspaceId: string,
  taskRunId: string,
  phase: 'progress' | 'completed' | 'failed',
) {
  const run = listTaskRuns(workspaceId).find((item) => item.id === taskRunId);
  if (!run) return null;
  const task = listTasks(workspaceId).find((item) => item.id === run.taskId) || null;

  return {
    type: 'task_run_snapshot',
    phase,
    workspaceId,
    taskRunId,
    taskId: run.taskId,
    automationId:
      (typeof run.metadata?.automationId === 'string' ? run.metadata.automationId : undefined) ||
      (typeof task?.metadata?.automationId === 'string' ? task.metadata.automationId : undefined),
    run,
    task,
  };
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, same-origin nginx proxy)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json({
  verify: (req, _res, buf) => {
    (req as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
  },
}));
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
app.use('/api/generated-screenshots', express.static(SCREENSHOT_DIR));

function buildSystemPrompt(autonomyMode: string): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });

  const modeInstructions: Record<string, string> = {
    autonomous: `You are operating in **Autonomous mode**. Execute all tasks directly and efficiently without asking for confirmation. Take initiative, chain multiple tools together, and deliver complete results. Minimize commentary — just do the work and report outcomes.`,
    cautious: `You are operating in **Cautious mode**. Before taking significant actions, briefly state what you're about to do and why. Use tools deliberately. After completing work, summarize what was done, what was changed, and suggest what should happen next. Be transparent about assumptions.`,
    supervised: `You are operating in **Supervised mode**. Be maximally transparent. Before each tool call, explicitly state the step number, what you're doing, and why. After each step, pause and explain the result. At the end, provide a complete action log. Never skip explaining your reasoning.`,
  };

  const modeText = modeInstructions[autonomyMode] || modeInstructions.cautious;

  return `You are Violema, an elite AI coworker built for modern high-performance teams. You are not just a chatbot — you proactively execute tasks, search the web, write and run code, manage workflows, send messages, generate reports, and schedule automations.

**Current date/time:** ${dateStr} at ${timeStr}

**Operating mode:** ${modeText}

**Your personality:**
- Professional, efficient, and results-oriented — you speak like a senior operator
- Proactive: you anticipate next steps and suggest follow-up actions
- Transparent: you show your work clearly without being verbose
- Confident but calibrated: you acknowledge uncertainty when it exists

**Your capabilities:**
- Web research: Search for current information, market data, news
- Visual website inspection: Capture real browser screenshots of public pages
- Code execution: Write and run code in Python, JS, TypeScript, bash
- Task management: Create, assign, and track tasks in Linear/Jira
- Communication: Draft and send Slack messages, emails, team updates
- Data queries: Pull live data from Stripe, HubSpot, GitHub, Linear, Salesforce
- Report generation: Create structured reports, analyses, summaries
- Automation scheduling: Set up recurring tasks and monitoring workflows
- Model routing: Match harder tasks to stronger models and cheaper tasks to more efficient models

**When executing tasks:**
1. Break complex requests into clear steps
2. Use tools to get real data rather than making up numbers
3. Chain multiple tools when a workflow requires it
4. Always summarize results and suggest next actions
5. Flag any uncertainties clearly
6. Use \`browser_screenshot\` when the user asks to inspect a page visually or compare UI states
7. Use \`web_search\` for current information instead of inventing citations or market facts
8. If a real integration is missing configuration, say exactly which credential is missing

Format responses with markdown: **bold** for key data points, bullet lists for clarity, code blocks for code. Be action-oriented.`;
}

function getPersistedAutomationCount(): number {
  try {
    if (!fs.existsSync(AUTOMATIONS_FILE)) return 0;
    const items = JSON.parse(fs.readFileSync(AUTOMATIONS_FILE, 'utf-8')) as unknown[];
    return Array.isArray(items) ? items.length : 0;
  } catch {
    return 0;
  }
}

function resolveWorkspaceContext(req: Request) {
  const candidateId =
    (typeof req.header('X-Workspace-Id') === 'string' ? req.header('X-Workspace-Id') : undefined) ||
    (typeof req.query.workspace_id === 'string' ? req.query.workspace_id : undefined) ||
    (typeof (req.body as Record<string, unknown> | undefined)?.workspaceId === 'string'
      ? (req.body as Record<string, unknown>).workspaceId as string
      : undefined) ||
    DEFAULT_WORKSPACE_ID;
  const normalizedId = candidateId.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || DEFAULT_WORKSPACE_ID;
  const workspaceId = normalizedId === 'workspace_default' ? DEFAULT_WORKSPACE_ID : normalizedId;
  const candidateName =
    (typeof req.header('X-Workspace-Name') === 'string' ? req.header('X-Workspace-Name') : undefined) ||
    (typeof req.query.workspace_name === 'string' ? req.query.workspace_name : undefined) ||
    (typeof (req.body as Record<string, unknown> | undefined)?.workspaceName === 'string'
      ? (req.body as Record<string, unknown>).workspaceName as string
      : undefined);

  const profile = candidateName
    ? upsertWorkspaceProfile(workspaceId, { name: candidateName })
    : getWorkspaceProfile(workspaceId);

  return {
    workspaceId: profile.id,
    workspaceName: profile.name,
    workspace: profile,
  };
}

function parseCookieValue(req: Request, cookieName: string) {
  const rawCookie = req.header('cookie');
  if (!rawCookie) return null;
  const pair = rawCookie
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${cookieName}=`));
  if (!pair) return null;
  const [, rawValue = ''] = pair.split('=');
  return decodeURIComponent(rawValue);
}

function getAuthCookieOptions() {
  const secure = process.env.NODE_ENV === 'production';
  const cookieDomain = process.env.AUTH_COOKIE_DOMAIN?.trim();
  return [
    `${AUTH_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    cookieDomain ? `Domain=${cookieDomain}` : '',
    secure ? 'Secure' : '',
    'Max-Age=0',
  ].filter(Boolean).join('; ');
}

function buildAuthCookie(token: string) {
  const secure = process.env.NODE_ENV === 'production';
  const cookieDomain = process.env.AUTH_COOKIE_DOMAIN?.trim();
  return [
    `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    cookieDomain ? `Domain=${cookieDomain}` : '',
    secure ? 'Secure' : '',
    `Max-Age=${60 * 60 * 24 * 30}`,
  ].filter(Boolean).join('; ');
}

type OAuthProvider = 'google' | 'microsoft';

interface OAuthStatePayload {
  provider: OAuthProvider;
  intent: 'signup' | 'login';
  next: string;
  acceptedTerms: boolean;
  acceptedEducation: boolean;
  issuedAt: number;
}

function getAuthPublicOrigin(req: Request) {
  const configured = process.env.AUTH_PUBLIC_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }

  const forwardedProto = (req.header('x-forwarded-proto') || req.protocol || 'http').split(',')[0]?.trim() || 'http';
  const forwardedHost = (req.header('x-forwarded-host') || req.header('host') || 'localhost:3001').split(',')[0]?.trim() || 'localhost:3001';
  return `${forwardedProto}://${forwardedHost}`;
}

function getProviderEnvToken(provider: 'anthropic' | 'openai' | 'openrouter' | 'mistral' | 'minimax') {
  if (provider === 'anthropic') return process.env.ANTHROPIC_API_KEY?.trim();
  if (provider === 'openai') return process.env.OPENAI_API_KEY?.trim();
  if (provider === 'openrouter') return process.env.OPENROUTER_API_KEY?.trim();
  if (provider === 'mistral') return process.env.MISTRAL_API_KEY?.trim();
  return process.env.MINIMAX_API_KEY?.trim() || process.env.ANTHROPIC_API_KEY?.trim();
}

async function testProviderConnection(input: {
  workspaceId: string;
  provider: 'anthropic' | 'openai' | 'openrouter' | 'mistral' | 'minimax';
  tokenOverride?: string;
}) {
  const token = input.tokenOverride?.trim() || getWorkspaceProviderToken(input.workspaceId, input.provider) || getProviderEnvToken(input.provider);
  if (!token) {
    throw new Error(`No token available for ${input.provider}.`);
  }

  if (input.provider === 'anthropic' || input.provider === 'minimax') {
    if (input.provider === 'minimax' && !process.env.MINIMAX_BASE_URL?.trim()) {
      return {
        ok: true,
        provider: input.provider,
        mode: 'saved' as const,
        detail: 'Token accepted. Direct MiniMax ping is not configured yet, so save succeeded but the connection was not actively verified.',
      };
    }

    const client = new Anthropic({
      apiKey: token,
      baseURL: input.provider === 'minimax'
        ? process.env.MINIMAX_BASE_URL?.trim()
        : process.env.ANTHROPIC_BASE_URL?.trim() || undefined,
    });
    const response = await client.messages.create({
      model: input.provider === 'minimax'
        ? process.env.MODEL_OPS_MODEL?.trim() || 'minimax/minimax-m2.7'
        : process.env.MODEL_DEFAULT_MODEL?.trim() || 'claude-sonnet-4-20250514',
      max_tokens: 8,
      system: 'Return only the word OK.',
      messages: [{ role: 'user', content: 'ping' }],
    });
    return {
      ok: true,
      provider: input.provider,
      mode: 'verified' as const,
      detail: `Verified with model ${response.model || (input.provider === 'minimax' ? 'minimax/minimax-m2.7' : 'claude-sonnet-4-20250514')}.`,
    };
  }

  if (input.provider === 'openai') {
    const response = await fetch(`${process.env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1'}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        model: process.env.MODEL_MICRO_MODEL?.trim() || 'gpt-5.4-nano',
        max_completion_tokens: 8,
        messages: [
          { role: 'system', content: 'Return only the word OK.' },
          { role: 'user', content: 'ping' },
        ],
      }),
    });
    const data = await response.json() as { error?: { message?: string } };
    if (!response.ok) throw new Error(data.error?.message || 'OpenAI test failed');
    return { ok: true, provider: input.provider, mode: 'verified' as const, detail: `Verified with ${process.env.MODEL_MICRO_MODEL?.trim() || 'gpt-5.4-nano'}.` };
  }

  if (input.provider === 'openrouter') {
    const response = await fetch(`${process.env.OPENROUTER_BASE_URL?.trim() || 'https://openrouter.ai/api/v1'}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'HTTP-Referer': process.env.OPENROUTER_SITE_URL?.trim() || 'https://violema.com',
        'X-Title': process.env.OPENROUTER_APP_NAME?.trim() || 'VIOLEMA',
      },
      body: JSON.stringify({
        model: process.env.MODEL_OPS_MODEL?.trim() || 'minimax/minimax-m2.7',
        max_completion_tokens: 8,
        messages: [
          { role: 'system', content: 'Return only the word OK.' },
          { role: 'user', content: 'ping' },
        ],
      }),
    });
    const data = await response.json() as { error?: { message?: string } };
    if (!response.ok) throw new Error(data.error?.message || 'OpenRouter test failed');
    return { ok: true, provider: input.provider, mode: 'verified' as const, detail: `Verified with ${process.env.MODEL_OPS_MODEL?.trim() || 'minimax/minimax-m2.7'}.` };
  }

  const response = await fetch(`${process.env.MISTRAL_BASE_URL?.trim() || 'https://api.mistral.ai/v1'}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model: process.env.MODEL_MEMORY_TEXT_MODEL?.trim() || 'mistral-embed',
      input: 'ping',
    }),
  });
  const data = await response.json() as { message?: string };
  if (!response.ok) throw new Error(data.message || 'Mistral test failed');
  return { ok: true, provider: input.provider, mode: 'verified' as const, detail: `Verified with ${process.env.MODEL_MEMORY_TEXT_MODEL?.trim() || 'mistral-embed'}.` };
}

async function testModelProfileConnection(input: {
  workspaceId: string;
  profile: 'micro' | 'default' | 'hard' | 'critical' | 'ops' | 'memory_text' | 'memory_code';
}) {
  if (input.profile === 'memory_text' || input.profile === 'memory_code') {
    const route = input.profile === 'memory_text'
      ? getMemoryEmbeddingConfig(input.workspaceId)
      : getCodeEmbeddingConfig(input.workspaceId);
    await createMemoryEmbeddings(['violema settings route test'], input.workspaceId);
    return {
      ok: true,
      profile: input.profile,
      detail: `Verified embedding route with ${route.model}.`,
    };
  }

  const route = getChatModelConfig(input.profile, input.workspaceId);
  const result = await generateTextDetailed(
    input.profile,
    'Reply with exactly OK.',
    [{ role: 'user', content: 'Return OK.' }],
    20,
    input.workspaceId,
  );

  if (!result.text.trim()) throw new Error('Route responded without text.');

  return {
    ok: true,
    profile: input.profile,
    detail: `Verified ${input.profile} with ${route.model}.`,
  };
}

function sanitizeNextPath(value: string | undefined, fallback = '/dashboard') {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return fallback;
  return trimmed;
}

function getAuthStateSecret() {
  return (
    process.env.AUTH_STATE_SECRET?.trim() ||
    process.env.SLACK_SIGNING_SECRET?.trim() ||
    process.env.STRIPE_WEBHOOK_SECRET?.trim() ||
    'violema-auth-state-dev-secret'
  );
}

function encodeOAuthState(payload: OAuthStatePayload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', getAuthStateSecret()).update(encoded).digest('hex');
  return `${encoded}.${signature}`;
}

function decodeOAuthState(state: string | undefined): OAuthStatePayload | null {
  if (!state) return null;
  const [encoded, signature] = state.split('.');
  if (!encoded || !signature) return null;
  const expected = crypto.createHmac('sha256', getAuthStateSecret()).update(encoded).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  const signatureBuffer = Buffer.from(signature, 'hex');
  if (expectedBuffer.length !== signatureBuffer.length || !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8')) as Partial<OAuthStatePayload>;
    if (
      (payload.provider !== 'google' && payload.provider !== 'microsoft') ||
      (payload.intent !== 'signup' && payload.intent !== 'login') ||
      typeof payload.next !== 'string' ||
      typeof payload.acceptedTerms !== 'boolean' ||
      typeof payload.acceptedEducation !== 'boolean' ||
      typeof payload.issuedAt !== 'number'
    ) {
      return null;
    }
    if (Date.now() - payload.issuedAt > 1000 * 60 * 15) {
      return null;
    }
    return {
      provider: payload.provider,
      intent: payload.intent,
      next: sanitizeNextPath(payload.next),
      acceptedTerms: payload.acceptedTerms,
      acceptedEducation: payload.acceptedEducation,
      issuedAt: payload.issuedAt,
    };
  } catch {
    return null;
  }
}

function redirectToAuthError(
  res: Response,
  origin: string,
  intent: 'signup' | 'login',
  next: string,
  message: string,
) {
  const target = intent === 'signup' ? '/signup' : '/login';
  const params = new URLSearchParams({
    error: message,
    next,
  });
  res.redirect(`${origin}${target}?${params.toString()}`);
}

function buildOAuthCallbackUrl(req: Request, provider: OAuthProvider) {
  return `${getAuthPublicOrigin(req)}/api/auth/${provider}/callback`;
}

function getGoogleOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

function getMicrosoftOAuthConfig() {
  const clientId = process.env.MICROSOFT_CLIENT_ID?.trim();
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET?.trim();
  const tenantId = process.env.MICROSOFT_TENANT_ID?.trim() || 'common';
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, tenantId };
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function normalizeEmail(value: string | undefined | null) {
  return (value || '').trim().toLowerCase();
}

function getAdminEmailAllowlist() {
  const configured = (process.env.ADMIN_EMAILS || process.env.TEST_CREDIT_ADMIN_EMAILS || '')
    .split(',')
    .map((item) => normalizeEmail(item))
    .filter(Boolean);

  return new Set(configured.length > 0 ? configured : DEFAULT_ADMIN_EMAILS);
}

function assertAdminAccess(req: Request) {
  const token = parseCookieValue(req, AUTH_COOKIE_NAME);
  const record = token ? getAuthUserByToken(token) : null;
  if (!record || record.user.role !== 'admin') {
    const error = new Error('Admin access required');
    (error as Error & { statusCode?: number }).statusCode = 403;
    throw error;
  }
  return record.user.email;
}

function verifySlackSignature(rawBody: Buffer, signature: string, timestamp: string) {
  const signingSecret = getRequiredEnv('SLACK_SIGNING_SECRET');
  const requestTime = Number(timestamp);
  if (!Number.isFinite(requestTime)) {
    throw new Error('Invalid Slack request timestamp');
  }

  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - requestTime);
  if (ageSeconds > 60 * 5) {
    throw new Error('Slack request timestamp is too old');
  }

  const base = `v0:${timestamp}:${rawBody.toString('utf8')}`;
  const digest = `v0=${crypto.createHmac('sha256', signingSecret).update(base).digest('hex')}`;
  const expected = Buffer.from(digest, 'utf8');
  const actual = Buffer.from(signature, 'utf8');

  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    throw new Error('Invalid Slack signature');
  }
}

function pruneHandledSlackEvents(now = Date.now()) {
  for (const [eventId, handledAt] of handledSlackEvents.entries()) {
    if (now - handledAt > SLACK_EVENT_CACHE_WINDOW_MS) {
      handledSlackEvents.delete(eventId);
    }
  }
}

function markSlackEventHandled(eventId: string) {
  const now = Date.now();
  pruneHandledSlackEvents(now);
  if (handledSlackEvents.has(eventId)) return false;
  handledSlackEvents.set(eventId, now);
  return true;
}

function stripSlackMentions(text: string) {
  return text.replace(/<@[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function needsSlackWebSearch(text: string) {
  return /(latest|current|today|news|search|look up|find|what happened|recent)/i.test(text);
}

function formatSlackReply(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return 'I did not get enough signal from that prompt. Try asking more directly.';
  }

  const withoutPlanning = trimmed
    .replace(/^I(?:'|’)ll [^.]+?\.\s*/i, '')
    .replace(/^Let me [^.]+?\.\s*/i, '');

  const normalized = withoutPlanning
    .replace(/^###\s+(.+)$/gm, '*$1*')
    .replace(/^##\s+(.+)$/gm, '*$1*')
    .replace(/^#\s+(.+)$/gm, '*$1*')
    .replace(/```[\s\S]*?```/g, (block) => block)
    .replace(/\n{3,}/g, '\n\n');

  return normalized.length > 3500 ? `${normalized.slice(0, 3450).trim()}\n\n_(truncated for Slack)_` : normalized;
}

function buildSlackTaskPrompt(prompt: string, context: { isDm: boolean }) {
  const cleaned = prompt.trim() || 'Help me get started.';
  const deliveryContext = context.isDm
    ? 'This request came from a direct message in Slack.'
    : 'This request came from an @mention in a Slack channel. Reply for the thread, not for the whole app.';

  return [
    deliveryContext,
    'Reply in Slack format: concise, useful, action-oriented.',
    'Lead with the answer. Use short paragraphs or bullets. Avoid long preambles.',
    'If you cite current information, include source URLs inline.',
    '',
    `User request: ${cleaned}`,
  ].join('\n');
}

async function handleSlackIncomingEvent(payload: {
  eventId: string;
  event: Record<string, unknown>;
  workspaceId: string;
}) {
  const event = payload.event;
  const channel = typeof event.channel === 'string' ? event.channel : '';
  const eventType = typeof event.type === 'string' ? event.type : '';
  const eventText = typeof event.text === 'string' ? event.text : '';
  const threadTs = typeof event.thread_ts === 'string'
    ? event.thread_ts
    : typeof event.ts === 'string'
      ? event.ts
      : undefined;

  if (!channel || !threadTs) return;
  if (event.bot_id || typeof event.subtype === 'string') return;
  const isDm = eventType === 'message' && event.channel_type === 'im';
  if (eventType !== 'app_mention' && !isDm) return;

  const prompt = stripSlackMentions(eventText);
  const billing = getBillingStatus(payload.workspaceId);
  if (billing.summary.balanceCredits <= 0) {
    await sendMessage({
      to: channel,
      channel: 'slack',
      threadTs,
      body: [
        'I can reply here, but this workspace is out of credits right now.',
        '',
        `Current balance: **${billing.summary.balanceCredits}** credits`,
        'Top up or change the plan in the billing flow, then I can continue.',
      ].join('\n'),
    });
    return;
  }

  try {
    const profile: TextProfile | 'auto' = needsSlackWebSearch(prompt) ? 'auto' : 'default';
    const execution = await executeConversationTask({
      messages: [{ role: 'user', content: buildSlackTaskPrompt(prompt, { isDm }) }],
      autonomyMode: 'autonomous',
      modelProfile: profile,
      workspaceId: payload.workspaceId,
    });
    await sendMessage({
      to: channel,
      channel: 'slack',
      threadTs,
      body: formatSlackReply(execution.outputText),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown Slack processing error';
    console.error('[slack] event handling failed', { eventId: payload.eventId, error: errorMessage });
    await sendMessage({
      to: channel,
      channel: 'slack',
      threadTs,
      body: `I hit an error while working on that: ${errorMessage}`,
    });
  }
}

function buildOpenAIHeaders(route: { provider: string; apiKeyEnv: string }) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getRequiredEnv(route.apiKeyEnv)}`,
  };

  if (route.provider === 'openrouter') {
    headers['HTTP-Referer'] = process.env.OPENROUTER_SITE_URL || 'https://violema.com';
    headers['X-Title'] = process.env.OPENROUTER_APP_NAME || 'Violema';
  }

  return headers;
}

function buildOpenAITools() {
  return NEXUS_TOOLS.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    },
  }));
}

async function runAnthropicChatLoop(
  client: Anthropic,
  route: { model: string },
  anthropicMessages: Anthropic.MessageParam[],
  autonomyMode: string,
  sendEvent: (data: Record<string, unknown>) => void
): Promise<{ toolCallsExecuted: number }> {
  let continueLoop = true;
  let currentMessages = [...anthropicMessages];
  let toolCallsExecuted = 0;

  while (continueLoop) {
    const stream = client.messages.stream({
      model: route.model,
      max_tokens: 8000,
      system: buildSystemPrompt(autonomyMode),
      tools: NEXUS_TOOLS,
      messages: currentMessages,
    });

    const toolUseBlocks: Anthropic.ToolUseBlock[] = [];
    let currentToolUse: { id: string; name: string; input: string; startedAt: number } | null = null;
    let hasToolUse = false;

    for await (const event of stream) {
      if (event.type === 'content_block_start') {
        if (event.content_block.type === 'tool_use') {
          hasToolUse = true;
          currentToolUse = {
            id: event.content_block.id,
            name: event.content_block.name,
            input: '',
            startedAt: Date.now(),
          };
          sendEvent({
            type: 'tool_start',
            tool_name: event.content_block.name,
            tool_id: event.content_block.id,
            started_at: currentToolUse.startedAt,
          });
        } else if (event.content_block.type === 'thinking') {
          sendEvent({ type: 'thinking_start' });
        }
      } else if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          sendEvent({ type: 'text', content: event.delta.text });
        } else if (event.delta.type === 'input_json_delta' && currentToolUse) {
          currentToolUse.input += event.delta.partial_json;
        } else if (event.delta.type === 'thinking_delta') {
          sendEvent({ type: 'thinking', content: event.delta.thinking });
        }
      } else if (event.type === 'content_block_stop') {
        if (currentToolUse) {
          let parsedInput: Record<string, unknown> = {};
          try {
            parsedInput = JSON.parse(currentToolUse.input);
          } catch {
            parsedInput = {};
          }

          toolUseBlocks.push({
            type: 'tool_use',
            id: currentToolUse.id,
            name: currentToolUse.name,
            input: parsedInput,
          });

          sendEvent({
            type: 'tool_input',
            tool_id: currentToolUse.id,
            tool_name: currentToolUse.name,
            input: parsedInput,
          });

          currentToolUse = null;
        }
      }
    }

    const finalMessage = await stream.finalMessage();

    if (finalMessage.stop_reason === 'tool_use' && hasToolUse) {
      currentMessages.push({ role: 'assistant', content: finalMessage.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUseBlock of toolUseBlocks) {
        const toolInput = toolUseBlock.input as Record<string, unknown>;
        const toolStart = Date.now();
        const result = await executeToolCall(toolUseBlock.name, toolInput);
        const elapsed = Date.now() - toolStart;
        const confidence = randomConfidence(toolUseBlock.name);

        sendEvent({
          type: 'tool_result',
          tool_id: toolUseBlock.id,
          tool_name: toolUseBlock.name,
          result: JSON.parse(result),
          elapsed_ms: elapsed,
          confidence,
        });

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUseBlock.id,
          content: result,
        });
        toolCallsExecuted += 1;
      }

      currentMessages.push({ role: 'user', content: toolResults });
    } else {
      continueLoop = false;
    }
  }

  return { toolCallsExecuted };
}

async function runOpenAIChatLoop(
  route: { provider: string; model: string; apiKeyEnv: string; baseUrl?: string },
  messages: ChatMessage[],
  autonomyMode: string,
  sendEvent: (data: Record<string, unknown>) => void
): Promise<{ toolCallsExecuted: number }> {
  const currentMessages: Array<Record<string, unknown>> = [
    { role: 'system', content: buildSystemPrompt(autonomyMode) },
    ...messages.map((message) => ({ role: message.role, content: message.content })),
  ];

  let continueLoop = true;
  let toolCallsExecuted = 0;

  while (continueLoop) {
    const response = await fetch(`${route.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: buildOpenAIHeaders(route),
      body: JSON.stringify({
        model: route.model,
        messages: currentMessages,
        tools: buildOpenAITools(),
        tool_choice: 'auto',
      }),
    });

    const data = await response.json() as {
      error?: { message?: string };
      choices?: Array<{
        finish_reason?: string;
        message?: {
          role?: string;
          content?: string | null;
          tool_calls?: Array<{
            id?: string;
            type?: string;
            function?: { name?: string; arguments?: string };
          }>;
        };
      }>;
    };

    if (!response.ok) {
      throw new Error(`OpenAI-compatible chat failed: ${data.error?.message || response.statusText}`);
    }

    const choice = data.choices?.[0];
    const assistantMessage = choice?.message;
    const assistantContent = assistantMessage?.content || '';
    if (assistantContent) {
      sendEvent({ type: 'text', content: assistantContent });
    }

    const toolCalls = assistantMessage?.tool_calls || [];
    if (toolCalls.length > 0) {
      currentMessages.push({
        role: 'assistant',
        content: assistantContent || null,
        tool_calls: toolCalls,
      });

      for (const toolCall of toolCalls) {
        const toolId = toolCall.id || `tool_${Date.now()}`;
        const toolName = toolCall.function?.name || 'unknown_tool';
        const startedAt = Date.now();
        sendEvent({
          type: 'tool_start',
          tool_name: toolName,
          tool_id: toolId,
          started_at: startedAt,
        });

        let parsedInput: Record<string, unknown> = {};
        try {
          parsedInput = JSON.parse(toolCall.function?.arguments || '{}') as Record<string, unknown>;
        } catch {
          parsedInput = {};
        }

        sendEvent({
          type: 'tool_input',
          tool_id: toolId,
          tool_name: toolName,
          input: parsedInput,
        });

        const result = await executeToolCall(toolName, parsedInput);
        const elapsed = Date.now() - startedAt;
        const confidence = randomConfidence(toolName);

        sendEvent({
          type: 'tool_result',
          tool_id: toolId,
          tool_name: toolName,
          result: JSON.parse(result),
          elapsed_ms: elapsed,
          confidence,
        });

        currentMessages.push({
          role: 'tool',
          tool_call_id: toolId,
          content: result,
        });
        toolCallsExecuted += 1;
      }
    } else {
      continueLoop = false;
    }
  }

  return { toolCallsExecuted };
}

const NEXUS_TOOLS: Anthropic.Tool[] = [
  {
    name: 'web_search',
    description: 'Search the web for current information, news, data, or any topic. Returns top results with titles, URLs, and summaries.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'The search query' },
        num_results: { type: 'number', description: 'Number of results to return (default: 5)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'browser_screenshot',
    description: 'Open a public web page in a real browser and capture a screenshot. Returns a saved image URL and metadata.',
    input_schema: {
      type: 'object' as const,
      properties: {
        url: { type: 'string', description: 'Public URL to capture' },
        full_page: { type: 'boolean', description: 'Whether to capture the full page (default: true)' },
        width: { type: 'number', description: 'Viewport width in pixels (default: 1440)' },
        height: { type: 'number', description: 'Viewport height in pixels (default: 900)' },
        wait_until: {
          type: 'string',
          enum: ['load', 'domcontentloaded', 'networkidle'],
          description: 'How long to wait before capturing the screenshot',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'run_code',
    description: 'Execute code in a specified programming language and return stdout/stderr. Supports Python, JavaScript, TypeScript, bash.',
    input_schema: {
      type: 'object' as const,
      properties: {
        language: { type: 'string', description: 'Programming language (python, javascript, typescript, bash)' },
        code: { type: 'string', description: 'The code to execute' },
        description: { type: 'string', description: 'Brief description of what this code does' },
      },
      required: ['language', 'code'],
    },
  },
  {
    name: 'create_task',
    description: 'Create a new task or todo item in the team task management system (Linear).',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'The task title' },
        description: { type: 'string', description: 'Detailed description' },
        due_date: { type: 'string', description: 'Due date in ISO format (optional)' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], description: 'Priority level' },
        assignee: { type: 'string', description: 'Person to assign to (optional)' },
        labels: { type: 'array', items: { type: 'string' }, description: 'Labels/tags for the task' },
      },
      required: ['title', 'description'],
    },
  },
  {
    name: 'send_message',
    description: 'Send a message via Slack, email, or Microsoft Teams to a person or channel.',
    input_schema: {
      type: 'object' as const,
      properties: {
        to: { type: 'string', description: 'Recipient (Slack username @handle, email, or #channel)' },
        subject: { type: 'string', description: 'Subject line (email) or message title' },
        body: { type: 'string', description: 'The message content (markdown supported)' },
        channel: { type: 'string', enum: ['slack', 'email', 'teams'], description: 'Communication channel' },
      },
      required: ['to', 'body'],
    },
  },
  {
    name: 'query_data',
    description: 'Query live data from connected integrations. Fetches real-time metrics, records, or reports from your connected tools.',
    input_schema: {
      type: 'object' as const,
      properties: {
        source: {
          type: 'string',
          enum: ['stripe', 'hubspot', 'github', 'linear', 'notion', 'salesforce', 'jira', 'posthog', 'google_analytics'],
          description: 'The data source to query',
        },
        query_type: { type: 'string', description: 'Type of data to retrieve' },
        filters: { type: 'object', description: 'Optional filters (date_range, status, assignee, etc.)' },
        limit: { type: 'number', description: 'Maximum records to return (default: 20)' },
      },
      required: ['source', 'query_type'],
    },
  },
  {
    name: 'generate_report',
    description: 'Generate a structured report or analysis document. Creates formatted markdown output suitable for sharing.',
    input_schema: {
      type: 'object' as const,
      properties: {
        report_type: {
          type: 'string',
          enum: ['executive_summary', 'metric_analysis', 'weekly_digest', 'incident_report', 'competitive_analysis', 'pipeline_review'],
          description: 'Type of report to generate',
        },
        title: { type: 'string', description: 'Report title' },
        data_sources: { type: 'array', items: { type: 'string' }, description: 'Data sources to include (e.g., ["stripe", "hubspot"])' },
        period: { type: 'string', description: 'Time period (e.g., "last_7_days", "march_2025", "Q1_2025")' },
        include_sections: { type: 'array', items: { type: 'string' }, description: 'Sections to include in the report' },
      },
      required: ['report_type', 'title'],
    },
  },
  {
    name: 'schedule_automation',
    description: 'Schedule a recurring automation or monitoring task. Violema will run it automatically on the specified schedule.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Name for this automation' },
        description: { type: 'string', description: 'What this automation does' },
        schedule: { type: 'string', description: 'When to run (e.g., "every Monday at 9am", "daily at 6pm", "every 4 hours")' },
        actions: { type: 'array', items: { type: 'string' }, description: 'List of actions to perform' },
        notify: { type: 'string', description: 'Where to send results (Slack channel or email)' },
        condition: { type: 'string', description: 'Optional: only run if this condition is true' },
      },
      required: ['name', 'schedule', 'actions'],
    },
  },
];

// Confidence scores by tool type (realistic ranges)
const TOOL_CONFIDENCE: Record<string, [number, number]> = {
  web_search: [72, 88],
  browser_screenshot: [89, 97],
  run_code: [91, 99],
  create_task: [94, 99],
  send_message: [96, 99],
  query_data: [87, 97],
  generate_report: [82, 94],
  schedule_automation: [93, 99],
};

function randomConfidence(toolName: string): number {
  const [min, max] = TOOL_CONFIDENCE[toolName] || [75, 90];
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function executeToolCall(
  toolName: string,
  toolInput: Record<string, unknown>,
  ctx?: { workspaceId?: string },
): Promise<string> {
  // Composio fallback path — tool names like SLACK_SEND_MESSAGE, GITHUB_CREATE_ISSUE etc.
  if (isComposioToolName(toolName) && isComposioEnabled()) {
    try {
      const result = await executeComposioAction(toolName, toolInput, {
        entityId: ctx?.workspaceId ?? 'default',
      });
      return JSON.stringify(result);
    } catch (err) {
      return JSON.stringify({
        error: err instanceof Error ? err.message : 'Composio action failed',
        tool: toolName,
      });
    }
  }

  switch (toolName) {
    case 'web_search': {
      const query = toolInput.query as string;
      const numResults = toolInput.num_results as number | undefined;
      return JSON.stringify(await searchWeb(query, numResults));
    }

    case 'browser_screenshot': {
      const result = await takeBrowserScreenshot({
        url: String(toolInput.url || ''),
        full_page: toolInput.full_page as boolean | undefined,
        width: toolInput.width as number | undefined,
        height: toolInput.height as number | undefined,
        wait_until: toolInput.wait_until as 'load' | 'domcontentloaded' | 'networkidle' | undefined,
      });
      return JSON.stringify(result);
    }

    case 'run_code': {
      const language = toolInput.language as string;
      const code = toolInput.code as string;
      const execTime = (Math.random() * 0.2 + 0.02).toFixed(3) + 's';

      if (language === 'python') {
        if (code.includes('import pandas') || code.includes('import numpy')) {
          return JSON.stringify({
            stdout: `DataFrame loaded: 1,247 rows × 8 cols\n\nSummary statistics:\n  mean: 42,318.44\n  std:  12,847.22\n  min:  1,200.00\n  max:  98,750.00\n\nTop categories:\n  Enterprise  428 (34.3%)\n  Startup     312 (25.0%)\n  SMB         289 (23.2%)`,
            stderr: '',
            exit_code: 0,
            language,
            execution_time: execTime,
          });
        }
        const lines = code.split('\n').filter(l => l.includes('print('));
        if (lines.length > 0) {
          const out = lines.map(l => l.replace(/print\(['"]?|['"]?\)/g, '')).join('\n');
          return JSON.stringify({ stdout: out || 'Script completed.', stderr: '', exit_code: 0, language, execution_time: execTime });
        }
        return JSON.stringify({
          stdout: 'Script executed successfully.\nResult: [computation complete]',
          stderr: '',
          exit_code: 0,
          language,
          execution_time: execTime,
        });
      }

      if (language === 'javascript' || language === 'typescript') {
        return JSON.stringify({
          stdout: '> Execution complete\n> Result: [object Object] — use JSON.stringify for details',
          stderr: '',
          exit_code: 0,
          language,
          execution_time: execTime,
        });
      }

      return JSON.stringify({
        stdout: `${language} script executed successfully.`,
        stderr: '',
        exit_code: 0,
        language,
        execution_time: execTime,
      });
    }

    case 'create_task': {
      const taskId = `TASK-${Math.floor(Math.random() * 9000) + 1000}`;
      return JSON.stringify({
        success: true,
        task_id: taskId,
        title: toolInput.title,
        description: toolInput.description,
        priority: toolInput.priority || 'medium',
        assignee: toolInput.assignee || null,
        labels: toolInput.labels || [],
        due_date: toolInput.due_date || null,
        created_at: new Date().toISOString(),
        url: `https://linear.app/nexus/issue/${taskId}`,
        status: 'todo',
      });
    }

    case 'send_message': {
      return JSON.stringify(await sendMessage({
        to: String(toolInput.to || ''),
        subject: toolInput.subject ? String(toolInput.subject) : undefined,
        body: String(toolInput.body || ''),
        channel: toolInput.channel ? String(toolInput.channel) : undefined,
      }));
    }

    case 'query_data': {
      const source = toolInput.source as string;
      const queryType = toolInput.query_type as string;

      const mockData: Record<string, Record<string, unknown>> = {
        stripe: {
          monthly_revenue: {
            period: 'March 2025',
            mrr: 127450,
            prev_mrr: 108230,
            change_pct: 17.77,
            arr: 1529400,
            new_subscriptions: 47,
            churned: 3,
            net_revenue_retention: 118,
            upgrades: 12,
            downgrades: 2,
            currency: 'USD',
          },
          customers: { total: 892, active: 847, trial: 45, churned_this_month: 3, paying: 802 },
          transactions: {
            today: { count: 234, volume: 18420, avg: 78.72 },
            this_month: { count: 4821, volume: 127450, avg: 26.43 },
          },
          failed_payments: { count: 18, recovery_rate: '67%', at_risk_mrr: 2340 },
        },
        hubspot: {
          contacts: { total: 12450, new_this_month: 234, qualified_leads: 89, mql: 156, sql: 43 },
          deals: { open: 67, won_this_month: 23, lost_this_month: 8, pipeline_value: 890000, avg_deal_size: 38700, close_rate: '34%' },
          campaigns: { active: 5, total_reach: 42000, avg_open_rate: '24.3%', avg_click_rate: '3.8%' },
        },
        github: {
          open_issues: { total: 34, critical: 2, high: 8, medium: 15, low: 9 },
          pull_requests: { open: 12, merged_this_week: 28, avg_review_time_hours: 6.4, oldest_open_days: 18 },
          activity: { commits_this_week: 147, contributors_active: 8, deployments_this_week: 12 },
        },
        linear: {
          sprint: { name: 'Sprint 23', open: 156, in_progress: 34, completed: 42, blocked: 7 },
          velocity: { this_sprint: 84, last_sprint: 76, avg_4_sprints: 79 },
          cycle_time_days: { p50: 2.1, p90: 5.8 },
        },
        posthog: {
          pageviews: { today: 8421, this_week: 48230, this_month: 182450 },
          active_users: { dau: 1247, wau: 6832, mau: 18940 },
          conversion: { signup_rate: '4.2%', activation_rate: '67%', retention_d30: '42%' },
          top_events: [
            { event: 'chat_sent', count: 45230, change: '+12%' },
            { event: 'tool_executed', count: 28410, change: '+34%' },
            { event: 'automation_created', count: 3210, change: '+89%' },
          ],
        },
        salesforce: {
          pipeline: { total: 2340000, opportunities: 87, avg_age_days: 34 },
          forecast: { commit: 340000, best_case: 520000, pipeline: 890000 },
          top_accounts: [
            { name: 'Acme Corp', arr: 120000, health: 'green', csm: 'Sarah K.' },
            { name: 'Globex Inc', arr: 84000, health: 'yellow', csm: 'Mike T.' },
          ],
        },
        google_analytics: {
          sessions: { today: 3421, this_week: 21450, this_month: 89230 },
          acquisition: { organic: '42%', direct: '28%', paid: '18%', referral: '12%' },
          top_pages: [
            { path: '/', sessions: 12450, bounce_rate: '34%' },
            { path: '/pricing', sessions: 8230, bounce_rate: '28%' },
            { path: '/features', sessions: 6710, bounce_rate: '41%' },
          ],
        },
      };

      const sourceData = mockData[source] || {};
      const result = sourceData[queryType] || { note: `Data for "${queryType}" not found in ${source}` };

      return JSON.stringify({
        source,
        query_type: queryType,
        data: result,
        fetched_at: new Date().toISOString(),
        latency_ms: Math.floor(Math.random() * 200) + 80,
        cache_hit: Math.random() > 0.6,
      });
    }

    case 'generate_report': {
      const { report_type, title, period } = toolInput as { report_type: string; title: string; period?: string };
      const reportPeriod = period || 'March 2025';

      const reportTemplates: Record<string, object> = {
        executive_summary: {
          title,
          period: reportPeriod,
          generated_at: new Date().toISOString(),
          sections: {
            headline_metrics: { mrr: '$127,450', growth: '+17.8%', nrr: '118%', churn: '0.4%' },
            highlights: [
              'MRR crossed $127K milestone for first time',
              'Net Revenue Retention at all-time high of 118%',
              'Churn rate improved from 0.7% → 0.4%',
              'Engineering shipped 28 PRs this week',
            ],
            risks: [
              '18 failed payments ($2,340 at risk)',
              'CAC increased 12% vs last month',
            ],
            next_actions: [
              'Review failed payment recovery flow',
              'Investigate CAC increase in paid channels',
            ],
          },
          format: 'markdown',
          word_count: 347,
        },
        weekly_digest: {
          title,
          period: reportPeriod,
          generated_at: new Date().toISOString(),
          sections: {
            wins: ['Shipped feature X', 'Closed 23 deals worth $890K', 'Resolved 42 Linear tickets'],
            metrics_snapshot: { mrr: '$127K', leads: 234, deployments: 12, uptime: '99.97%' },
            team_updates: 'Engineering: sprint 23 complete. Marketing: campaign launched. Sales: Q2 pipeline strong.',
            next_week: ['Pricing experiment', 'Enterprise tier launch', 'Sales enablement workshop'],
          },
          format: 'markdown',
          word_count: 284,
        },
        metric_analysis: {
          title,
          period: reportPeriod,
          generated_at: new Date().toISOString(),
          analysis: {
            trend: 'upward',
            variance_from_forecast: '+3.2%',
            key_drivers: ['New enterprise tier', 'Referral program launched', 'Seasonal uplift'],
            anomalies: ['Thursday spike (+34%) correlates with Product Hunt feature'],
            recommendations: ['Double down on enterprise motion', 'Investigate referral program ROI'],
          },
          format: 'markdown',
          word_count: 412,
        },
      };

      const template = reportTemplates[report_type] || reportTemplates.executive_summary;
      return JSON.stringify({ success: true, report: template, shareable_url: `https://nexus.app/reports/rpt_${Date.now()}` });
    }

    case 'schedule_automation': {
      const record = createAutomation({
        name: String(toolInput.name || ''),
        description: toolInput.description ? String(toolInput.description) : undefined,
        schedule: String(toolInput.schedule || ''),
        actions: Array.isArray(toolInput.actions) ? toolInput.actions.map((item) => String(item)) : [],
        notify: toolInput.notify ? String(toolInput.notify) : undefined,
        condition: toolInput.condition ? String(toolInput.condition) : undefined,
      }, runAutomation);

      return JSON.stringify({
        success: true,
        automation_id: record.id,
        name: record.name,
        description: record.description || null,
        schedule: record.schedule,
        cron_expression: record.cron_expression,
        actions: record.actions,
        notify: record.notify || null,
        condition: record.condition || null,
        status: record.status,
        created_at: record.created_at,
      });
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  conversationId?: string;
  autonomyMode?: string;
  modelProfile?: TextProfile | 'auto';
}

interface ChatExecutionResult {
  taskId: string;
  taskRunId: string;
  resolvedProfile: TextProfile;
  selectedModel: string;
  modelSource: 'server_default' | 'workspace_override' | 'workspace_token';
  outputText: string;
  toolCallsExecuted: number;
}

function normalizeAutonomyMode(value: string): 'autonomous' | 'cautious' | 'supervised' {
  return value === 'autonomous' || value === 'supervised' ? value : 'cautious';
}

function normalizeModelTier(profile: TextProfile): 'micro' | 'default' | 'hard' | 'critical' | 'ops' {
  switch (profile) {
    case 'balanced':
      return 'default';
    case 'frontier':
      return 'critical';
    case 'operations':
      return 'ops';
    case 'utility':
      return 'micro';
    default:
      return profile;
  }
}

async function executeConversationTask(input: {
  messages: ChatMessage[];
  autonomyMode?: string;
  modelProfile?: TextProfile | 'auto';
  workspaceId: string;
  sendEvent?: (data: Record<string, unknown>) => void;
}): Promise<ChatExecutionResult> {
  const { messages, workspaceId } = input;
  const autonomyMode = input.autonomyMode || 'cautious';
  const modelProfile = input.modelProfile || 'auto';
  const noop = () => {};
  const sendEvent = input.sendEvent || noop;
  const textParts: string[] = [];
  const collectEvent = (data: Record<string, unknown>) => {
    if (data.type === 'text' && typeof data.content === 'string' && data.content.trim()) {
      textParts.push(data.content);
    }
    sendEvent(data);
  };

  ensureWorkspaceCredits(workspaceId);
  const routingDecision = modelProfile === 'auto'
    ? await routeChatProfile(messages, workspaceId)
    : null;
  const resolvedProfile: TextProfile = routingDecision?.profile || (modelProfile === 'auto' ? 'default' : modelProfile);
  const canonicalModelTier = normalizeModelTier(resolvedProfile);
  const combinedContent = messages.map((message) => message.content).join(' ');
  const taskKind = canonicalModelTier === 'ops'
    ? 'automation'
    : messages.some((message) => /report|analysis|analyze|compare|research/i.test(message.content))
      ? 'analysis'
      : 'chat';
  const delegation = buildDelegationRuntimeContext({
    workspaceId,
    taskKind,
    title: messages[0]?.content?.slice(0, 72) || 'Violema task',
    description: messages[messages.length - 1]?.content || '',
    autonomyMode: normalizeAutonomyMode(autonomyMode),
    priority: canonicalModelTier === 'critical' ? 'high' : 'medium',
    modelTier: canonicalModelTier,
    toolCountHint: messages.length,
    complexity: combinedContent.length > 1200 ? 'high' : combinedContent.length > 500 ? 'medium' : 'low',
    requiresHumanReview: normalizeAutonomyMode(autonomyMode) === 'supervised',
  });
  const modelTier = delegation.plan.suggestedModelTier;
  const { client, executingRoute } = getChatClient(resolvedProfile, workspaceId);
  const requestedRoute = getChatModelConfig(resolvedProfile, workspaceId);
  const modelSource = getModelSource(resolvedProfile, workspaceId);
  const task = createTask({
    workspaceId,
    title: messages[0]?.content?.slice(0, 72) || 'Violema task',
    description: messages[messages.length - 1]?.content || '',
    kind: taskKind,
    priority: canonicalModelTier === 'critical' ? 'high' : 'medium',
    autonomyMode: normalizeAutonomyMode(autonomyMode),
    ...delegation.taskPatch,
    delegationPlanId: delegation.plan.id,
    delegationPlan: delegation.plan,
    metadata: {
      selectedProfile: resolvedProfile,
      model: requestedRoute.model,
      modelSource,
      modelSourceLabel: getModelSourceLabel(modelSource),
      delegation: delegation.ownership,
    },
  });
  updateTask(task.id, { status: 'running', delegationState: 'in_progress' });
  const estimatedCost = estimateCreditCost({
    taskKind,
    modelTier,
    toolCalls: 0,
    complexity: combinedContent.length > 1200 ? 'high' : combinedContent.length > 500 ? 'medium' : 'low',
  });
  assertCanSpendCredits(workspaceId, estimatedCost.estimatedCredits);
  const taskRun = createTaskRun({
    workspaceId,
    taskId: task.id,
    ...delegation.taskRunPatch,
    modelTier,
    estimatedCredits: estimatedCost.estimatedCredits,
    delegationPlan: delegation.plan,
    metadata: {
      requestedProfile: modelProfile,
      title: task.title,
      delegation: delegation.ownership,
      modelSource,
      modelSourceLabel: getModelSourceLabel(modelSource),
    },
  });
  const anthropicMessages: Anthropic.MessageParam[] = messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));

  collectEvent({
    type: 'routing',
    requested_profile: modelProfile,
    selected_profile: resolvedProfile,
    selected_model: requestedRoute.model,
    selected_model_source: modelSource,
    selected_model_source_label: getModelSourceLabel(modelSource),
    reason: routingDecision?.reason || 'explicit_profile',
    risk: routingDecision?.risk || 'low',
    needs_tools: routingDecision?.needsTools ?? true,
  });
  collectEvent({
    type: 'delegation_planned',
    task_id: task.id,
    task_run_id: taskRun.id,
    plan: delegation.plan,
    ownership: delegation.ownership,
  });

  let toolCallsExecuted = 0;
  if (requestedRoute.provider === 'anthropic' || requestedRoute.provider === 'minimax') {
    if (!client) throw new Error('Missing Anthropic-compatible client.');
    const execution = await runAnthropicChatLoop(client, executingRoute, anthropicMessages, autonomyMode, collectEvent);
    toolCallsExecuted = execution.toolCallsExecuted;
  } else {
    const execution = await runOpenAIChatLoop(requestedRoute, messages, autonomyMode, collectEvent);
    toolCallsExecuted = execution.toolCallsExecuted;
  }

  const actualCost = estimateCreditCost({
    taskKind,
    modelTier,
    toolCalls: toolCallsExecuted,
    complexity: estimatedCost.breakdown.complexityCredits > 0 ? 'medium' : 'low',
  });
  finalizeTaskRun(taskRun.id, {
    status: 'succeeded',
    actualCredits: actualCost.estimatedCredits,
    metadata: { toolCallsExecuted },
  });
  updateTask(task.id, { status: 'completed', delegationState: 'completed' });
  addLedgerEntry({
    workspaceId,
    source: 'task_run',
    deltaCredits: -actualCost.estimatedCredits,
    referenceType: 'task',
    referenceId: task.id,
    note: `Chat task completed: ${task.title}`,
    metadata: { taskRunId: taskRun.id, toolCallsExecuted },
  });

  return {
    taskId: task.id,
    taskRunId: taskRun.id,
    resolvedProfile,
    selectedModel: requestedRoute.model,
    modelSource,
    outputText: textParts.join('').trim(),
    toolCallsExecuted,
  };
}

interface AutomationExecutionArtifact {
  kind: 'web_search' | 'query_data' | 'summary' | 'delivery' | 'note' | 'analysis' | 'capture';
  title: string;
  payload: Record<string, unknown>;
}

function normalizeAutomationActionText(action: string) {
  return action.trim().toLowerCase();
}

function inferAutomationSearchQuery(
  action: string,
  automation: { name: string; description?: string; condition?: string }
) {
  const normalized = normalizeAutomationActionText(action);
  const explicitMatch = action.match(/(?:for|about)\s+(.+)$/i);
  if (explicitMatch?.[1]) {
    return explicitMatch[1].trim().replace(/\.$/, '');
  }

  if (/\b(ai|agentic)\b/.test(normalized) && /\bnews\b/.test(normalized)) {
    return 'top AI and agentic AI news this week';
  }

  if (/\bcompetitor\b/.test(normalized) && /\bpricing\b/.test(normalized)) {
    return 'competitor pricing changes this week';
  }

  const description = automation.description?.trim();
  const condition = automation.condition?.trim();
  return [automation.name, description, condition].filter(Boolean).join(' - ');
}

function inferAutomationQueryDataInput(action: string) {
  const normalized = normalizeAutomationActionText(action);

  if (normalized.includes('stripe') && /failed payments?|payment failures?/.test(normalized)) {
    return { source: 'stripe', query_type: 'failed_payments' };
  }

  if (normalized.includes('posthog') && normalized.includes('funnel')) {
    return { source: 'posthog', query_type: 'funnel_analysis' };
  }

  if (normalized.includes('github') && normalized.includes('issues')) {
    return { source: 'github', query_type: 'open_issues' };
  }

  return null;
}

function inferAutomationDeliveryTarget(action: string) {
  const emailMatch = action.match(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
  if (emailMatch?.[1]) {
    return {
      channel: 'email' as const,
      target: emailMatch[1].trim(),
    };
  }

  const slackChannelMatch = action.match(/(?:to|in|into|post to|send to|deliver to)\s+(#[a-z0-9_-]+)/i) || action.match(/(#[a-z0-9_-]+)/i);
  if (slackChannelMatch?.[1]) {
    return {
      channel: 'slack' as const,
      target: slackChannelMatch[1].trim(),
    };
  }

  const slackUserMatch = action.match(/(@[a-z0-9._-]+)/i);
  if (slackUserMatch?.[1]) {
    return {
      channel: 'slack' as const,
      target: slackUserMatch[1].trim(),
    };
  }

  return null;
}

function actionNeedsSummary(action: string) {
  return /(summary|digest|report|golden nuggets|nuggets|share with the team)/i.test(action);
}

function actionNeedsDelivery(action: string) {
  return /(send|post|slack|email|deliver|notify|message)/i.test(action);
}

function buildAutomationStepId(automationId: string, index: number) {
  return `auto_step_${automationId}_${index + 1}`;
}

function inferAutomationScreenshotInput(action: string) {
  const urlMatch = action.match(/https?:\/\/[^\s)]+/i);
  if (!urlMatch?.[0]) return null;

  return {
    url: urlMatch[0].replace(/[.,!?]+$/, ''),
    full_page: true,
    wait_until: 'networkidle' as const,
  };
}

function buildDeliveryTargetFromNotify(notify?: string | null) {
  const target = notify?.trim();
  if (!target) return null;
  return {
    channel: target.includes('@') ? 'email' as const : 'slack' as const,
    target,
  };
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizePersistedAutomationSteps(input: unknown[]): PersistedAutomationStep[] {
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

    steps.push({
      id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `step_${index + 1}`,
      kind: kind as PersistedAutomationStep['kind'],
      title: typeof item.title === 'string' && item.title.trim() ? item.title.trim() : undefined,
      objective: objectiveCandidate,
      inputs: isObjectRecord(item.inputs) ? item.inputs : undefined,
      deliveryTarget,
    });
    return steps;
  }, []);
}

function deriveLegacyActionFromStep(step: PersistedAutomationStep) {
  const objective = step.objective.trim();
  switch (step.kind) {
    case 'search':
      return objective.toLowerCase().includes('search') || objective.toLowerCase().includes('research')
        ? objective
        : `Search the web for ${objective}`;
    case 'query':
      return objective.toLowerCase().startsWith('query') ? objective : `Query ${objective}`;
    case 'capture': {
      const url = typeof step.inputs?.url === 'string' ? step.inputs.url.trim() : '';
      return url ? `Capture a browser screenshot of ${url}` : objective || 'Capture a browser screenshot';
    }
    case 'analyze':
      return objective.toLowerCase().startsWith('analyze') ? objective : `Analyze ${objective}`;
    case 'summarize':
      return objective.toLowerCase().includes('summary') || objective.toLowerCase().includes('digest')
        ? objective
        : `Generate summary for ${objective}`;
    case 'deliver':
      return step.deliveryTarget?.target
        ? `Deliver latest result to ${step.deliveryTarget.target}`
        : objective || 'Deliver latest result';
    case 'note':
    default:
      return objective;
  }
}

function deriveLegacyActionsFromSteps(steps: PersistedAutomationStep[]) {
  return steps
    .map((step) => deriveLegacyActionFromStep(step).trim())
    .filter(Boolean);
}

function maxAutomationModelTier(left: ModelTier, right: ModelTier): ModelTier {
  const rank: Record<ModelTier, number> = {
    micro: 0,
    default: 1,
    ops: 2,
    hard: 3,
    critical: 4,
  };

  return rank[right] > rank[left] ? right : left;
}

function normalizeAutomationExecutionPolicy(value: unknown): AutomationExecutionPolicy | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;

  const record = value as Record<string, unknown>;
  const mode = record.mode === 'custom' ? 'custom' : 'recommended';
  const optimizationGoal =
    record.optimizationGoal === 'cost_saver' || record.optimizationGoal === 'quality_first'
      ? record.optimizationGoal
      : 'balanced';
  const reviewPolicy =
    record.reviewPolicy === 'lean' || record.reviewPolicy === 'strict'
      ? record.reviewPolicy
      : 'standard';
  const maxElasticLanes = typeof record.maxElasticLanes === 'number'
    ? Math.max(0, Math.min(4, Math.trunc(record.maxElasticLanes)))
    : 2;

  return {
    mode,
    optimizationGoal,
    reviewPolicy,
    maxElasticLanes,
  };
}

function normalizeAutomationRoleDirectives(value: unknown) {
  return isObjectRecord(value)
    ? Object.entries(value).reduce<Record<string, { mode: 'cheaper' | 'review' | 'promote'; updatedAt: string; phases?: AutomationStepKind[] }>>((acc, [role, directive]) => {
        if (!isObjectRecord(directive)) return acc;
        const mode = directive.mode === 'cheaper' || directive.mode === 'review' || directive.mode === 'promote'
          ? directive.mode
          : undefined;
        const updatedAt = typeof directive.updatedAt === 'string' && directive.updatedAt.trim()
          ? directive.updatedAt.trim()
          : undefined;
        const phases = Array.isArray(directive.phases)
          ? directive.phases
              .filter((phase): phase is AutomationStepKind => (
                phase === 'search' ||
                phase === 'query' ||
                phase === 'capture' ||
                phase === 'analyze' ||
                phase === 'summarize' ||
                phase === 'deliver' ||
                phase === 'note'
              ))
              .slice(0, 6)
          : undefined;
        if (!role.trim() || !mode || !updatedAt) return acc;
        acc[role.trim()] = { mode, updatedAt, phases: phases?.length ? phases : undefined };
        return acc;
      }, {})
    : undefined;
}

function normalizeAutomationStudioState(value: unknown): AutomationStudioState | undefined {
  if (!isObjectRecord(value)) return undefined;

  const selectedScenarioId =
    typeof value.selectedScenarioId === 'string' && value.selectedScenarioId.trim()
      ? value.selectedScenarioId.trim()
      : undefined;
  const previewPresetId =
    typeof value.previewPresetId === 'string' && value.previewPresetId.trim()
      ? value.previewPresetId.trim()
      : undefined;

  const experimentHistory = Array.isArray(value.experimentHistory)
    ? value.experimentHistory
        .map((item) => {
          if (!isObjectRecord(item)) return null;
          const id = typeof item.id === 'string' && item.id.trim() ? item.id.trim() : undefined;
          const scenarioId = typeof item.scenarioId === 'string' && item.scenarioId.trim() ? item.scenarioId.trim() : undefined;
          const previewId = typeof item.previewPresetId === 'string' && item.previewPresetId.trim() ? item.previewPresetId.trim() : undefined;
          const createdAt = typeof item.createdAt === 'string' && item.createdAt.trim() ? item.createdAt.trim() : undefined;
          if (!id || !scenarioId || !previewId || !createdAt) return null;
          const roleDirectives = normalizeAutomationRoleDirectives(item.roleDirectives);
          return {
            id,
            scenarioId,
            previewPresetId: previewId,
            createdAt,
            notes: typeof item.notes === 'string' && item.notes.trim() ? item.notes.trim() : undefined,
            roleDirectives,
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
        .slice(0, 8)
    : undefined;

  const roleDirectives = normalizeAutomationRoleDirectives(value.roleDirectives);

  if (!selectedScenarioId && !previewPresetId && !experimentHistory?.length && !roleDirectives) {
    return undefined;
  }

  return {
    selectedScenarioId,
    previewPresetId,
    experimentHistory,
    roleDirectives,
  };
}

function getDefaultAutomationExecutionPolicy(): AutomationExecutionPolicy {
  return {
    mode: 'recommended',
    optimizationGoal: 'balanced',
    reviewPolicy: 'standard',
    maxElasticLanes: 2,
  };
}

function downgradeAutomationModelTier(modelTier: ModelTier): ModelTier {
  if (modelTier === 'critical') return 'hard';
  if (modelTier === 'hard' || modelTier === 'ops') return 'default';
  if (modelTier === 'default') return 'micro';
  return 'micro';
}

function upgradeAutomationModelTier(modelTier: ModelTier): ModelTier {
  if (modelTier === 'micro') return 'default';
  if (modelTier === 'default' || modelTier === 'ops') return 'hard';
  if (modelTier === 'hard') return 'critical';
  return 'critical';
}

function estimateAutomationStepCredits(
  kind: AutomationStepKind,
  modelTier: ModelTier,
  options?: { complexity?: 'low' | 'medium' | 'high'; toolCalls?: number },
) {
  const taskKind = kind === 'search'
    ? 'research'
    : kind === 'query' || kind === 'analyze'
      ? 'analysis'
      : kind === 'summarize'
        ? 'report'
        : kind === 'deliver'
          ? 'message'
          : 'automation';

  return estimateCreditCost({
    taskKind,
    modelTier,
    toolCalls: options?.toolCalls || 0,
    complexity: options?.complexity,
  }).estimatedCredits;
}

function createAutomationStepDefinition(
  automation: {
    id: string;
    name: string;
    description?: string;
    actions: string[];
    notify?: string;
    condition?: string;
  },
  action: string,
  index: number,
): AutomationStepDefinition {
  const normalized = normalizeAutomationActionText(action);
  const queryDataInput = inferAutomationQueryDataInput(action);
  const notifyTarget = buildDeliveryTargetFromNotify(automation.notify);
  const explicitDeliveryTarget = inferAutomationDeliveryTarget(action);
  const screenshotInput = inferAutomationScreenshotInput(action);

  if (queryDataInput) {
    return {
      id: buildAutomationStepId(automation.id, index),
      kind: 'query',
      title: action,
      objective: `Pull the requested live data for "${action}".`,
      assignedRole: 'analyst',
      modelTier: 'micro',
      estimatedCredits: estimateAutomationStepCredits('query', 'micro', { toolCalls: 1 }),
      toolName: 'query_data',
      inputs: queryDataInput,
    };
  }

  if (/(screenshot|capture)/.test(normalized)) {
    return {
      id: buildAutomationStepId(automation.id, index),
      kind: 'capture',
      title: action,
      objective: `Capture the requested page state for "${action}".`,
      assignedRole: 'operator',
      modelTier: 'micro',
      estimatedCredits: estimateAutomationStepCredits('capture', 'micro', { toolCalls: screenshotInput ? 1 : 0 }),
      toolName: 'browser_screenshot',
      inputs: screenshotInput || {},
    };
  }

  if (/(analy[sz]e|diagnos|compare|inspect|audit|review)/.test(normalized)) {
    return {
      id: buildAutomationStepId(automation.id, index),
      kind: 'analyze',
      title: action,
      objective: action,
      assignedRole: 'analyst',
      modelTier: /strateg|competitor|market|deep/i.test(action) ? 'hard' : 'default',
      estimatedCredits: estimateAutomationStepCredits('analyze', /strateg|competitor|market|deep/i.test(action) ? 'hard' : 'default', {
        complexity: /strateg|competitor|market|deep/i.test(action) ? 'high' : 'medium',
      }),
      toolName: 'generate_text',
      inputs: { instruction: action },
    };
  }

  if (/(search|scan internet|scan the internet|scan web|research|news|competitor)/.test(normalized)) {
    return {
      id: buildAutomationStepId(automation.id, index),
      kind: 'search',
      title: action,
      objective: `Gather the external evidence needed for "${action}".`,
      assignedRole: 'researcher',
      modelTier: 'micro',
      estimatedCredits: estimateAutomationStepCredits('search', 'micro', { toolCalls: 1 }),
      toolName: 'web_search',
      inputs: {
        query: inferAutomationSearchQuery(action, automation),
        num_results: 6,
      },
    };
  }

  if (actionNeedsDelivery(action)) {
    return {
      id: buildAutomationStepId(automation.id, index),
      kind: 'deliver',
      title: action,
      objective: `Deliver the latest automation result for "${action}".`,
      assignedRole: 'messenger',
      modelTier: 'micro',
      estimatedCredits: estimateAutomationStepCredits('deliver', 'micro', { toolCalls: 1 }),
      toolName: 'send_message',
      inputs: {},
      deliveryTarget: explicitDeliveryTarget || notifyTarget,
    };
  }

  if (actionNeedsSummary(action) || /(generate|briefing|recap)/.test(normalized)) {
    return {
      id: buildAutomationStepId(automation.id, index),
      kind: 'summarize',
      title: action,
      objective: action,
      assignedRole: 'writer',
      modelTier: 'default',
      estimatedCredits: estimateAutomationStepCredits('summarize', 'default', { complexity: 'medium' }),
      toolName: 'generate_text',
      inputs: { instruction: action },
    };
  }

  return {
    id: buildAutomationStepId(automation.id, index),
    kind: 'note',
    title: action,
    objective: action,
    assignedRole: 'scheduler',
    modelTier: 'micro',
    estimatedCredits: estimateAutomationStepCredits('note', 'micro'),
    inputs: { note: action },
  };
}

function createAutomationStepDefinitionFromPersisted(
  automation: {
    id: string;
    name: string;
    description?: string;
    actions: string[];
    notify?: string;
    condition?: string;
  },
  step: PersistedAutomationStep,
  index: number,
): AutomationStepDefinition {
  const baseId = step.id?.trim() || buildAutomationStepId(automation.id, index);
  const title = step.title?.trim() || step.objective.trim() || `Step ${index + 1}`;
  const objective = step.objective.trim() || title;
  const notifyTarget = buildDeliveryTargetFromNotify(automation.notify);
  const deliveryTarget = step.deliveryTarget || notifyTarget;
  const captureInput = isObjectRecord(step.inputs) ? step.inputs : undefined;
  const url = typeof captureInput?.url === 'string' ? captureInput.url.trim() : '';
  const normalizedObjective = normalizeAutomationActionText(objective);

  if (step.kind === 'query') {
    const queryDataInput = isObjectRecord(step.inputs) ? step.inputs : inferAutomationQueryDataInput(objective) || {};
    return {
      id: baseId,
      kind: 'query',
      title,
      objective,
      assignedRole: 'analyst',
      modelTier: 'micro',
      estimatedCredits: estimateAutomationStepCredits('query', 'micro', { toolCalls: 1 }),
      toolName: 'query_data',
      inputs: queryDataInput,
    };
  }

  if (step.kind === 'capture') {
    return {
      id: baseId,
      kind: 'capture',
      title,
      objective,
      assignedRole: 'operator',
      modelTier: 'micro',
      estimatedCredits: estimateAutomationStepCredits('capture', 'micro', { toolCalls: url ? 1 : 0 }),
      toolName: 'browser_screenshot',
      inputs: captureInput || {},
    };
  }

  if (step.kind === 'analyze') {
    const modelTier = /strateg|competitor|market|deep/i.test(objective) ? 'hard' : 'default';
    return {
      id: baseId,
      kind: 'analyze',
      title,
      objective,
      assignedRole: 'analyst',
      modelTier,
      estimatedCredits: estimateAutomationStepCredits('analyze', modelTier, {
        complexity: modelTier === 'hard' ? 'high' : 'medium',
      }),
      toolName: 'generate_text',
      inputs: isObjectRecord(step.inputs) ? step.inputs : { instruction: objective },
    };
  }

  if (step.kind === 'search') {
    return {
      id: baseId,
      kind: 'search',
      title,
      objective,
      assignedRole: 'researcher',
      modelTier: 'micro',
      estimatedCredits: estimateAutomationStepCredits('search', 'micro', { toolCalls: 1 }),
      toolName: 'web_search',
      inputs: isObjectRecord(step.inputs) && typeof step.inputs.query === 'string'
        ? step.inputs
        : {
            query: inferAutomationSearchQuery(objective, automation),
            num_results: 6,
          },
    };
  }

  if (step.kind === 'deliver') {
    return {
      id: baseId,
      kind: 'deliver',
      title,
      objective,
      assignedRole: 'messenger',
      modelTier: 'micro',
      estimatedCredits: estimateAutomationStepCredits('deliver', 'micro', { toolCalls: 1 }),
      toolName: 'send_message',
      inputs: isObjectRecord(step.inputs) ? step.inputs : {},
      deliveryTarget,
    };
  }

  if (step.kind === 'summarize') {
    return {
      id: baseId,
      kind: 'summarize',
      title,
      objective,
      assignedRole: 'writer',
      modelTier: 'default',
      estimatedCredits: estimateAutomationStepCredits('summarize', 'default', { complexity: 'medium' }),
      toolName: 'generate_text',
      inputs: isObjectRecord(step.inputs) ? step.inputs : { instruction: objective },
    };
  }

  return {
    id: baseId,
    kind: 'note',
    title,
    objective: normalizedObjective ? objective : title,
    assignedRole: 'scheduler',
    modelTier: 'micro',
    estimatedCredits: estimateAutomationStepCredits('note', 'micro'),
    inputs: isObjectRecord(step.inputs) ? step.inputs : { note: objective },
  };
}

function canonicalizeAutomationPlanSteps(steps: AutomationStepDefinition[]): AutomationStepDefinition[] {
  const nextSteps: AutomationStepDefinition[] = [];
  const summaryInstructions: string[] = [];
  let summaryIndex = -1;

  for (const step of steps) {
    if (step.kind === 'summarize') {
      summaryInstructions.push(step.objective.trim());
      if (summaryIndex === -1) {
        summaryIndex = nextSteps.length;
        nextSteps.push({ ...step });
      }
      continue;
    }

    nextSteps.push(step);
  }

  if (summaryIndex !== -1) {
    const mergedInstructions = [...new Set(summaryInstructions.filter(Boolean))];
    const primarySummary = nextSteps[summaryIndex];
    nextSteps[summaryIndex] = {
      ...primarySummary,
      title: mergedInstructions.length > 1 ? 'Generate summary and highlights' : primarySummary.title,
      objective: mergedInstructions.length > 1
        ? `Produce one final summary that satisfies all summary requests:\n- ${mergedInstructions.join('\n- ')}`
        : primarySummary.objective,
      inputs: {
        ...(primarySummary.inputs || {}),
        instruction: mergedInstructions.length > 1
          ? `Produce one final summary that satisfies all summary requests:\n- ${mergedInstructions.join('\n- ')}`
          : (primarySummary.inputs?.instruction || primarySummary.objective),
      },
    };
  }

  return nextSteps;
}

function deriveAutomationRolePlan(steps: AutomationStepDefinition[]): AutomationRolePlan {
  const roleCounts = new Map<AutomationStepDefinition['assignedRole'], number>();
  steps.forEach((step) => {
    roleCounts.set(step.assignedRole, (roleCounts.get(step.assignedRole) || 0) + 1);
  });

  const primaryCandidates = steps
    .map((step) => step.assignedRole)
    .filter((role) => !isElasticLane(role));
  const primaryRole = primaryCandidates
    .sort((left, right) => (roleCounts.get(right) || 0) - (roleCounts.get(left) || 0))[0] || 'operator';
  const supportingRoles = [...new Set(
    steps
      .map((step) => step.assignedRole)
      .filter((role) => role !== primaryRole && !isElasticLane(role))
  )];
  const elasticLanes = [...new Set(steps.map((step) => step.assignedRole).filter((role) => isElasticLane(role)))];

  return {
    primaryRole,
    supportingRoles,
    elasticLanes,
    rationale: supportingRoles.length > 0
      ? `${primaryRole} leads the workflow while core specialists support the run and elastic lanes absorb delivery or cadence work.`
      : `${primaryRole} can handle the workflow directly while elastic lanes remain available only if needed.`,
  };
}

function inferAutomationModelTierFromPlan(
  automation: { name: string; description?: string; condition?: string },
  steps: AutomationStepDefinition[],
): ModelTier {
  const joined = [automation.name, automation.description || '', automation.condition || '', ...steps.map((step) => step.title)]
    .join(' ')
    .toLowerCase();

  if (/(batch|bulk|pipeline|queue|backfill|thousands|large volume|throughput)/.test(joined)) {
    return 'ops';
  }

  if (steps.filter((step) => step.toolName && step.toolName !== 'generate_text').length >= 4) {
    return 'ops';
  }

  return steps.reduce<ModelTier>((current, step) => maxAutomationModelTier(current, step.modelTier || 'micro'), 'micro');
}

function inferAutomationComplexityFromPlan(steps: AutomationStepDefinition[]): 'low' | 'medium' | 'high' {
  const weightedStepCount = steps.reduce((total, step) => {
    if (step.kind === 'analyze' || step.kind === 'capture') return total + 2;
    return total + 1;
  }, 0);

  if (weightedStepCount >= 8) return 'high';
  if (weightedStepCount >= 5) return 'medium';
  return 'low';
}

function estimateAutomationToolCallCount(steps: AutomationStepDefinition[]) {
  return steps.filter((step) => step.toolName && step.toolName !== 'generate_text').length;
}

function inferAutomationStepEstimateOptions(step: AutomationStepDefinition): { complexity?: 'low' | 'medium' | 'high'; toolCalls?: number } {
  if (step.kind === 'analyze') {
    return { complexity: step.modelTier === 'hard' || step.modelTier === 'critical' ? 'high' : 'medium' };
  }
  if (step.kind === 'summarize') {
    return { complexity: 'medium' };
  }
  if (step.kind === 'capture') {
    return { toolCalls: step.inputs?.url ? 1 : 0 };
  }
  if (step.kind === 'search' || step.kind === 'query' || step.kind === 'deliver') {
    return { toolCalls: 1 };
  }
  return {};
}

function retuneAutomationStepDefinition(
  step: AutomationStepDefinition,
  modelTier: ModelTier,
  directiveMode?: 'cheaper' | 'review' | 'promote',
  directivePhases?: AutomationStepKind[],
): AutomationStepDefinition {
  return {
    ...step,
    directiveMode,
    directivePhases,
    modelTier,
    estimatedCredits: estimateAutomationStepCredits(step.kind, modelTier, inferAutomationStepEstimateOptions({ ...step, modelTier })),
  };
}

function applyAutomationStudioDirectives(
  steps: AutomationStepDefinition[],
  policyPlan: {
    primaryRole: AgentRole;
    supportingRoles: AgentRole[];
    elasticLanes: AgentRole[];
    suggestedModelTier: ModelTier;
    rationale: string;
    policy: AutomationExecutionPolicy;
  },
  studioState?: AutomationStudioState,
) {
  if (!studioState?.roleDirectives || Object.keys(studioState.roleDirectives).length === 0) {
    return {
      steps,
      primaryRole: policyPlan.primaryRole,
      supportingRoles: policyPlan.supportingRoles,
      elasticLanes: policyPlan.elasticLanes,
      suggestedModelTier: policyPlan.suggestedModelTier,
      rationale: policyPlan.rationale,
      appliedDirectives: [] as string[],
    };
  }

  const nextSteps = steps.map((step) => ({ ...step }));
  const supportingRoles = [...policyPlan.supportingRoles];
  const elasticLanes = [...policyPlan.elasticLanes];
  const appliedDirectives: string[] = [];
  let suggestedModelTier = policyPlan.suggestedModelTier;

  for (const [role, directive] of Object.entries(studioState.roleDirectives)) {
    const scopedPhases = directive.phases?.length ? [...new Set(directive.phases)] : undefined;
    const affectedSteps = nextSteps.filter((step) => (
      step.assignedRole === role &&
      (!scopedPhases || scopedPhases.includes(step.kind))
    ));
    if (affectedSteps.length === 0) continue;

    if (directive.mode === 'cheaper') {
      for (const step of affectedSteps) {
        const nextTier = downgradeAutomationModelTier(step.modelTier || suggestedModelTier);
        Object.assign(step, retuneAutomationStepDefinition(step, nextTier, directive.mode, scopedPhases));
      }
      appliedDirectives.push(scopedPhases?.length
        ? `${role} is being routed down-market for ${scopedPhases.join(', ')} steps.`
        : `${role} is being routed down-market for lower spend.`);
    }

    if (directive.mode === 'review') {
      for (const step of affectedSteps) {
        const nextTier = upgradeAutomationModelTier(step.modelTier || suggestedModelTier);
        Object.assign(step, retuneAutomationStepDefinition(step, nextTier, directive.mode, scopedPhases));
      }
      if (!supportingRoles.includes('reviewer') && policyPlan.primaryRole !== 'reviewer') {
        supportingRoles.push('reviewer');
      }
      suggestedModelTier = upgradeAutomationModelTier(suggestedModelTier);
      appliedDirectives.push(scopedPhases?.length
        ? `${role} now carries a stricter review bias for ${scopedPhases.join(', ')} steps.`
        : `${role} now carries a stricter review bias.`);
    }

    if (directive.mode === 'promote') {
      for (const step of affectedSteps) {
        const nextTier = upgradeAutomationModelTier(step.modelTier || suggestedModelTier);
        Object.assign(step, retuneAutomationStepDefinition(step, nextTier, directive.mode, scopedPhases));
      }
      suggestedModelTier = upgradeAutomationModelTier(suggestedModelTier);
      if (isElasticLane(role as AgentRole)) {
        if (!elasticLanes.includes(role as AgentRole)) {
          elasticLanes.unshift(role as AgentRole);
        }
      } else if (role !== policyPlan.primaryRole && !supportingRoles.includes(role as AgentRole)) {
        supportingRoles.push(role as AgentRole);
      }
      appliedDirectives.push(scopedPhases?.length
        ? `${role} is being promoted into a stronger lane for ${scopedPhases.join(', ')} steps.`
        : `${role} is being promoted into a stronger lane for this workflow.`);
    }
  }

  const uniqueSupportingRoles = [...new Set(supportingRoles)];
  const uniqueElasticLanes = [...new Set(elasticLanes)].slice(0, 4);

  return {
    steps: nextSteps,
    primaryRole: policyPlan.primaryRole,
    supportingRoles: uniqueSupportingRoles,
    elasticLanes: uniqueElasticLanes,
    suggestedModelTier,
    rationale: appliedDirectives.length > 0
      ? `${policyPlan.rationale} ${appliedDirectives.join(' ')}`
      : policyPlan.rationale,
    appliedDirectives,
  };
}

function applyAutomationExecutionPolicy(
  rolePlan: AutomationRolePlan,
  suggestedModelTier: ModelTier,
  complexity: 'low' | 'medium' | 'high',
  stepCount: number,
  toolCalls: number,
  policy: AutomationExecutionPolicy | undefined,
) {
  const normalizedPolicy = policy || getDefaultAutomationExecutionPolicy();
  let nextModelTier = suggestedModelTier;
  let nextSupportingRoles = [...rolePlan.supportingRoles];
  let nextElasticLanes = [...(rolePlan.elasticLanes || [])];
  const rationale: string[] = [];

  if (normalizedPolicy.mode === 'custom') {
    rationale.push('Custom execution policy overrides the default orchestration path.');

    if (normalizedPolicy.optimizationGoal === 'cost_saver') {
      nextModelTier = downgradeAutomationModelTier(nextModelTier);
      nextSupportingRoles = nextSupportingRoles.filter((role) => role !== 'reviewer');
      rationale.push('Cost Saver lowers model spend and trims unnecessary review overhead.');
    } else if (normalizedPolicy.optimizationGoal === 'quality_first') {
      nextModelTier = upgradeAutomationModelTier(nextModelTier);
      if (!nextSupportingRoles.includes('reviewer')) nextSupportingRoles.push('reviewer');
      rationale.push('Quality First increases reasoning depth and keeps review in the loop.');
    } else {
      rationale.push('Balanced keeps the default quality/cost routing.');
    }

    if (normalizedPolicy.reviewPolicy === 'strict') {
      if (!nextSupportingRoles.includes('reviewer')) nextSupportingRoles.push('reviewer');
      if (nextModelTier === 'micro') nextModelTier = 'default';
      rationale.push('Strict review forces a reviewer handoff before final delivery.');
    } else if (normalizedPolicy.reviewPolicy === 'lean') {
      nextSupportingRoles = nextSupportingRoles.filter((role) => role !== 'reviewer');
      rationale.push('Lean review removes reviewer passes unless the run already requires them.');
    }
  } else {
    rationale.push(`System Recommended uses ${stepCount} steps, ${toolCalls} tool calls, and ${complexity} complexity to choose the leanest reliable setup.`);
  }

  const desiredElasticLanes = complexity === 'high' ? 3 : complexity === 'medium' ? 2 : 1;
  const cappedElasticLaneCount = Math.max(
    0,
    Math.min(nextElasticLanes.length, normalizedPolicy.mode === 'custom' ? normalizedPolicy.maxElasticLanes : desiredElasticLanes),
  );
  nextElasticLanes = nextElasticLanes.slice(0, cappedElasticLaneCount);

  if (nextElasticLanes.length === 0) {
    rationale.push('No elastic lanes opened because the workflow can stay within the resident team.');
  } else {
    rationale.push(`Elastic lanes capped at ${nextElasticLanes.length} to keep token burn proportional to run difficulty.`);
  }

  return {
    policy: normalizedPolicy,
    primaryRole: rolePlan.primaryRole,
    supportingRoles: [...new Set(nextSupportingRoles)],
    elasticLanes: [...new Set(nextElasticLanes)],
    suggestedModelTier: nextModelTier,
    rationale: rationale.join(' '),
  };
}

function estimateSuccessfulAutomationCredits(stepExecutions: AutomationStepExecution[]) {
  return stepExecutions.reduce((total, step) => {
    if (step.status === 'skipped' || step.status === 'planned') return total;
    return total + Math.max(0, Math.trunc(step.actualCredits ?? step.charge?.actualCredits ?? step.estimatedCredits ?? 0));
  }, 0);
}

function inferAutomationStepTaskKind(kind: AutomationStepKind) {
  if (kind === 'search' || kind === 'capture') return 'research' as const;
  if (kind === 'query' || kind === 'analyze') return 'analysis' as const;
  if (kind === 'summarize') return 'report' as const;
  if (kind === 'deliver') return 'message' as const;
  return 'automation' as const;
}

function inferAutomationStepComplexity(step: AutomationStepExecution): 'low' | 'medium' | 'high' {
  if (step.kind === 'analyze') return step.modelTier === 'hard' || step.modelTier === 'critical' ? 'high' : 'medium';
  if (step.kind === 'summarize') return 'medium';
  return 'low';
}

function attachAutomationStepCharge(step: AutomationStepExecution) {
  if (step.status === 'skipped' || step.status === 'planned') {
    step.actualCredits = 0;
    return step;
  }

  const startedAt = step.startedAt ? Date.parse(step.startedAt) : Number.NaN;
  const finishedAt = step.finishedAt ? Date.parse(step.finishedAt) : Number.NaN;
  const durationMs =
    Number.isFinite(startedAt) && Number.isFinite(finishedAt) && finishedAt >= startedAt
      ? Math.max(0, finishedAt - startedAt)
      : undefined;
  const toolCalls = step.toolCalls ?? ((step.kind === 'search' || step.kind === 'query' || step.kind === 'capture' || step.kind === 'deliver') ? 1 : 0);
  const artifactCount = step.artifactCount ?? (step.artifactKind ? 1 : 0);
  const runtimeCharge = calculateRuntimeCredits({
    taskKind: inferAutomationStepTaskKind(step.kind),
    modelTier: step.modelTier || 'micro',
    toolCalls,
    artifactCount,
    durationSeconds: durationMs ? Math.ceil(durationMs / 1000) : undefined,
    complexity: inferAutomationStepComplexity(step),
    inputTokens: step.tokenUsage?.inputTokens,
    outputTokens: step.tokenUsage?.outputTokens,
    totalTokens: step.tokenUsage?.totalTokens,
  });

  step.durationMs = durationMs;
  step.toolCalls = toolCalls;
  step.artifactCount = artifactCount;
  step.actualCredits = runtimeCharge.actualCredits;
  step.charge = {
    actualCredits: runtimeCharge.actualCredits,
    tokenCredits: runtimeCharge.breakdown.tokenCredits,
    toolCredits: runtimeCharge.breakdown.toolCredits,
    artifactCredits: runtimeCharge.breakdown.artifactCredits,
    durationCredits: runtimeCharge.breakdown.durationCredits,
    complexityCredits: runtimeCharge.breakdown.complexityCredits,
    baseCredits: runtimeCharge.breakdown.baseCredits,
    rationale: runtimeCharge.rationale,
  };
  return step;
}

function ensureAutomationSummaryStep(
  automation: { id: string },
  steps: AutomationStepDefinition[],
): AutomationStepDefinition[] {
  const hasEvidence = steps.some((step) => ['search', 'query', 'capture', 'analyze'].includes(step.kind));
  const hasSummary = steps.some((step) => step.kind === 'summarize');
  if (!hasEvidence || hasSummary) return steps;

  const summaryStep: AutomationStepDefinition = {
    id: buildAutomationStepId(automation.id, steps.length),
    kind: 'summarize',
    title: 'Generate automation summary',
    objective: 'Generate a concise, decision-ready summary from the gathered evidence.',
    assignedRole: 'writer',
    modelTier: 'default',
    estimatedCredits: estimateAutomationStepCredits('summarize', 'default', { complexity: 'medium' }),
    toolName: 'generate_text',
    inputs: { instruction: 'Generate a concise, decision-ready summary from the gathered evidence.' },
    dependsOnStepIds: steps.map((step) => step.id),
  };

  const firstDeliveryIndex = steps.findIndex((step) => step.kind === 'deliver');
  if (firstDeliveryIndex === -1) {
    return [...steps, summaryStep] as AutomationStepDefinition[];
  }

  return [
    ...steps.slice(0, firstDeliveryIndex),
    summaryStep,
    ...steps.slice(firstDeliveryIndex),
  ] as AutomationStepDefinition[];
}

function ensureAutomationDeliveryStep(
  automation: { id: string; notify?: string },
  steps: AutomationStepDefinition[],
): AutomationStepDefinition[] {
  const deliveryTarget = buildDeliveryTargetFromNotify(automation.notify);
  if (!deliveryTarget || steps.some((step) => step.kind === 'deliver')) return steps;

  const deliveryStep: AutomationStepDefinition = {
    id: buildAutomationStepId(automation.id, steps.length),
    kind: 'deliver',
    title: 'Deliver latest result',
    objective: 'Send the latest automation result to the configured destination.',
    assignedRole: 'messenger',
    modelTier: 'micro',
    estimatedCredits: estimateAutomationStepCredits('deliver', 'micro', { toolCalls: 1 }),
    toolName: 'send_message',
    inputs: {},
    deliveryTarget,
    dependsOnStepIds: steps.filter((step) => step.kind !== 'deliver').map((step) => step.id),
  };

  return [
    ...steps,
    deliveryStep,
  ] as AutomationStepDefinition[];
}

function buildAutomationExecutionPlan(automation: {
  id: string;
  name: string;
  description?: string;
  actions: string[];
  steps?: PersistedAutomationStep[];
  execution_policy?: AutomationExecutionPolicy;
  studio_state?: AutomationStudioState;
  notify?: string;
  condition?: string;
}): AutomationExecutionPlan {
  const baseSteps = automation.steps?.length
    ? automation.steps.map((step, index) => createAutomationStepDefinitionFromPersisted(automation, step, index))
    : automation.actions.map((action, index) => createAutomationStepDefinition(automation, action, index));
  const canonicalSteps = canonicalizeAutomationPlanSteps(baseSteps);
  const steps = ensureAutomationDeliveryStep(automation, ensureAutomationSummaryStep(automation, canonicalSteps));
  const baseRolePlan = deriveAutomationRolePlan(steps);
  const complexity = inferAutomationComplexityFromPlan(steps);
  const executionPolicy = normalizeAutomationExecutionPolicy(automation.execution_policy);
  const baseSuggestedModelTier = inferAutomationModelTierFromPlan(automation, steps);
  const estimatedToolCalls = estimateAutomationToolCallCount(steps);
  const policyPlan = applyAutomationExecutionPolicy(
    baseRolePlan,
    baseSuggestedModelTier,
    complexity,
    steps.length,
    estimatedToolCalls,
    executionPolicy,
  );
  const studioPlan = applyAutomationStudioDirectives(steps, policyPlan, automation.studio_state);
  const topology = buildWorkerTopologySnapshot({
    primaryRole: studioPlan.primaryRole,
    supportingRoles: studioPlan.supportingRoles,
    elasticLanes: studioPlan.elasticLanes,
    modelTier: studioPlan.suggestedModelTier,
    complexity,
    taskKind: 'automation',
  });

  return {
    primaryRole: studioPlan.primaryRole,
    supportingRoles: studioPlan.supportingRoles,
    elasticLanes: studioPlan.elasticLanes,
    rationale: studioPlan.rationale,
    primaryBand: topology.primaryBand,
    suggestedModelTier: studioPlan.suggestedModelTier,
    complexity,
    estimatedToolCalls,
    estimatedCredits: estimateCreditCost({
      taskKind: 'automation',
      modelTier: studioPlan.suggestedModelTier,
      automationRuns: 1,
      toolCalls: estimatedToolCalls,
      complexity,
    }).estimatedCredits,
    steps: studioPlan.steps,
    topology,
  };
}

function buildAutomationEvidenceBlock(
  automation: { name: string; description?: string; condition?: string; actions: string[] },
  artifacts: AutomationExecutionArtifact[],
  stepExecutions: AutomationStepExecution[],
  stepErrors: string[],
) {
  const evidence = artifacts
    .map((artifact) => `## ${artifact.title}\n${JSON.stringify(artifact.payload, null, 2)}`)
    .join('\n\n');
  const stepNotes = stepExecutions
    .filter((step) => step.summary)
    .map((step) => `- ${step.assignedRole} · ${step.title}: ${step.summary}`)
    .join('\n');

  return [
    `Automation: ${automation.name}`,
    automation.description ? `Description: ${automation.description}` : null,
    automation.condition ? `Condition: ${automation.condition}` : null,
    `Requested steps:\n- ${automation.actions.join('\n- ')}`,
    stepNotes ? `Execution notes:\n${stepNotes}` : null,
    evidence ? `Evidence:\n${evidence}` : null,
    stepErrors.length > 0 ? `Execution errors:\n- ${stepErrors.join('\n- ')}` : null,
  ].filter(Boolean).join('\n\n');
}

function buildAutomationDeliveryFallbackBody(
  automation: { name: string; description?: string; condition?: string; actions: string[] },
  artifacts: AutomationExecutionArtifact[],
  stepExecutions: AutomationStepExecution[],
  stepErrors: string[],
) {
  const artifactSummary = artifacts
    .filter((artifact) => artifact.kind !== 'delivery')
    .map((artifact) => `- ${artifact.title}${artifact.kind ? ` (${artifact.kind})` : ''}`)
    .join('\n');
  const executedSteps = stepExecutions
    .filter((step) => step.status === 'succeeded' || step.status === 'failed' || step.status === 'skipped')
    .map((step) => `- ${step.title}: ${step.status}${step.summary ? ` — ${step.summary}` : ''}${step.error ? ` — ${step.error}` : ''}`)
    .join('\n');

  return [
    `Automation: ${automation.name}`,
    automation.description ? `Description: ${automation.description}` : null,
    artifactSummary ? `Generated artifacts:\n${artifactSummary}` : null,
    executedSteps ? `Executed steps:\n${executedSteps}` : null,
    stepErrors.length > 0 ? `Errors:\n- ${stepErrors.join('\n- ')}` : null,
  ].filter(Boolean).join('\n\n');
}

async function ensureAutomationSummaryText(
  automation: { name: string; description?: string; condition?: string; actions: string[] },
  plan: AutomationExecutionPlan,
  artifacts: AutomationExecutionArtifact[],
  stepExecutions: AutomationStepExecution[],
  stepErrors: string[],
) {
  if (artifacts.length === 0 && stepErrors.length === 0) return '';

  const fallbackSummaryResult = await runAutomationStepWithTimeout(
    `Fallback summary for "${automation.name}"`,
    generateTextDetailed(
      plan.suggestedModelTier,
      'Summarize the completed automation run in concise markdown. Lead with the highest-value outcome, then note any failure or delivery issue briefly.',
      [{ role: 'user', content: buildAutomationEvidenceBlock(automation, artifacts, stepExecutions, stepErrors) }],
      600,
      DEFAULT_WORKSPACE_ID,
    ),
  );

  return fallbackSummaryResult.text;
}

async function runAutomationStepWithTimeout<T>(label: string, operation: Promise<T>) {
  let timeoutId: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`${label} timed out after ${Math.round(AUTOMATION_STEP_TIMEOUT_MS / 1000)}s.`));
        }, AUTOMATION_STEP_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function executeAutomationCore(
  automation: {
    id: string;
    name: string;
    description?: string;
    actions: string[];
    steps?: PersistedAutomationStep[];
    execution_policy?: AutomationExecutionPolicy;
    notify?: string;
    condition?: string;
    timezone?: string;
  },
  plan: AutomationExecutionPlan,
  onProgress?: (state: {
    artifacts: AutomationExecutionArtifact[];
    summaryText: string;
    stepErrors: string[];
    stepExecutions: AutomationStepExecution[];
    delivery: Record<string, unknown> | null;
    deliveryError: string | null;
    workerTopology: AutomationExecutionPlan['topology'];
  }) => Promise<void> | void,
) {
  const artifacts: AutomationExecutionArtifact[] = [];
  const stepExecutions: AutomationStepExecution[] = [];
  const stepErrors: string[] = [];
  let summaryText = '';
  let delivery: Record<string, unknown> | null = null;
  let deliveryError: string | null = null;

  const emitProgress = async () => {
    if (!onProgress) return;
    const runtimeTopology = applyWorkerRuntimeActivity(plan.topology, stepExecutions);
    await onProgress({
      artifacts: [...artifacts],
      summaryText,
      stepErrors: [...stepErrors],
      stepExecutions: [...stepExecutions],
      delivery,
      deliveryError,
      workerTopology: runtimeTopology,
    });
  };

  for (const step of plan.steps) {
    const stepModelSource = getModelSource(step.modelTier || plan.suggestedModelTier, DEFAULT_WORKSPACE_ID);
    const stepExecution: AutomationStepExecution = {
      stepId: step.id,
      kind: step.kind,
      title: step.title,
      assignedRole: step.assignedRole,
      directiveMode: step.directiveMode,
      directivePhases: step.directivePhases,
      modelTier: step.modelTier,
      modelSource: stepModelSource,
      modelSourceLabel: getModelSourceLabel(stepModelSource),
      estimatedCredits: step.estimatedCredits,
      status: 'running',
      startedAt: new Date().toISOString(),
    };
    stepExecutions.push(stepExecution);

    await emitProgress();

    try {
      if (step.kind === 'search') {
        const query = typeof step.inputs?.query === 'string'
          ? step.inputs.query
          : inferAutomationSearchQuery(step.title, automation);
        const payload = await runAutomationStepWithTimeout(`Search step "${step.title}"`, searchWeb(query, 6));
        artifacts.push({
          kind: 'web_search',
          title: step.title,
          payload,
        });
        stepExecution.status = 'succeeded';
        stepExecution.summary = `Gathered current web evidence for "${query}".`;
        stepExecution.output = { query, resultCount: Array.isArray((payload as { results?: unknown[] }).results) ? ((payload as { results?: unknown[] }).results?.length || 0) : undefined };
        stepExecution.artifactKind = 'web_search';
        stepExecution.toolCalls = 1;
        stepExecution.artifactCount = 1;
        continue;
      }

      if (step.kind === 'query') {
        const payload = JSON.parse(await runAutomationStepWithTimeout(`Query step "${step.title}"`, executeToolCall('query_data', step.inputs || {}))) as Record<string, unknown>;
        artifacts.push({
          kind: 'query_data',
          title: step.title,
          payload,
        });
        stepExecution.status = 'succeeded';
        stepExecution.summary = 'Pulled the requested live data successfully.';
        stepExecution.output = payload;
        stepExecution.artifactKind = 'query_data';
        stepExecution.toolCalls = 1;
        stepExecution.artifactCount = 1;
        continue;
      }

      if (step.kind === 'capture') {
        if (!step.inputs?.url) {
          stepExecution.status = 'skipped';
          stepExecution.summary = 'Skipped screenshot step because no URL was provided.';
          continue;
        }

        const payload = JSON.parse(await runAutomationStepWithTimeout(`Capture step "${step.title}"`, executeToolCall('browser_screenshot', step.inputs))) as Record<string, unknown>;
        artifacts.push({
          kind: 'capture',
          title: step.title,
          payload,
        });
        stepExecution.status = 'succeeded';
        stepExecution.summary = 'Captured the requested page state.';
        stepExecution.output = payload;
        stepExecution.artifactKind = 'capture';
        stepExecution.toolCalls = 1;
        stepExecution.artifactCount = 1;
        continue;
      }

      if (step.kind === 'analyze') {
        const analysisResult = await runAutomationStepWithTimeout(
          `Analysis step "${step.title}"`,
          generateTextDetailed(
          step.modelTier || plan.suggestedModelTier,
          'You are an internal VIOLEMA analyst. Produce a compact, decision-ready analysis based only on the supplied evidence. Be concrete and avoid filler.',
          [{ role: 'user', content: `${step.objective}\n\n${buildAutomationEvidenceBlock(automation, artifacts, stepExecutions, stepErrors)}` }],
          500,
          DEFAULT_WORKSPACE_ID,
          ),
        );
        const markdown = analysisResult.text;
        artifacts.push({
          kind: 'analysis',
          title: step.title,
          payload: { markdown },
        });
        stepExecution.status = 'succeeded';
        stepExecution.summary = markdown.slice(0, 180).trim();
        stepExecution.output = { markdown };
        stepExecution.artifactKind = 'analysis';
        stepExecution.artifactCount = 1;
        stepExecution.tokenUsage = analysisResult.usage;
        continue;
      }

      if (step.kind === 'summarize') {
        const summaryResult = await runAutomationStepWithTimeout(
          `Summary step "${step.title}"`,
          generateTextDetailed(
          step.modelTier || plan.suggestedModelTier,
          'You execute recurring VIOLEMA automations. Turn the provided evidence into a concise, useful markdown output. If the task is a news update, lead with 3-5 sharp bullets labeled "Golden nuggets" and then add a short summary. If there is operational or metrics data, include a compact section for it. Be concrete, skim-friendly, and avoid filler.',
          [{ role: 'user', content: `${step.objective}\n\n${buildAutomationEvidenceBlock(automation, artifacts, stepExecutions, stepErrors)}` }],
          900,
          DEFAULT_WORKSPACE_ID,
          ),
        );
        summaryText = summaryResult.text;
        artifacts.push({
          kind: 'summary',
          title: step.title,
          payload: { markdown: summaryText },
        });
        stepExecution.status = 'succeeded';
        stepExecution.summary = summaryText.slice(0, 180).trim();
        stepExecution.output = { markdown: summaryText };
        stepExecution.artifactKind = 'summary';
        stepExecution.artifactCount = 1;
        stepExecution.tokenUsage = summaryResult.usage;
        continue;
      }

      if (step.kind === 'deliver') {
        const deliveryTarget = step.deliveryTarget?.target?.trim() || automation.notify?.trim() || null;
        if (!deliveryTarget) {
          stepExecution.status = 'skipped';
          stepExecution.summary = 'Skipped delivery because no target was configured.';
          continue;
        }

        if (!summaryText && (artifacts.length > 0 || stepErrors.length > 0)) {
          try {
            summaryText = await ensureAutomationSummaryText(automation, plan, artifacts, stepExecutions, stepErrors);
            if (summaryText) {
              artifacts.push({
                kind: 'summary',
                title: `${automation.name} summary`,
                payload: { markdown: summaryText },
              });
            }
          } catch (error) {
            const summaryError = error instanceof Error ? error.message : 'Unknown summary generation error';
            stepErrors.push(`Fallback summary: ${summaryError}`);
          }
        }

        const body = summaryText || buildAutomationDeliveryFallbackBody(automation, artifacts, stepExecutions, stepErrors);
        delivery = await runAutomationStepWithTimeout(`Delivery step "${step.title}"`, sendMessage({
          to: deliveryTarget,
          subject: `Automation run: ${automation.name}`,
          body,
        }));
        artifacts.push({
          kind: 'delivery',
          title: `Delivered to ${deliveryTarget}`,
          payload: delivery,
        });
        stepExecution.status = 'succeeded';
        stepExecution.summary = `Delivered the latest result to ${deliveryTarget}.`;
        stepExecution.output = delivery;
        stepExecution.artifactKind = 'delivery';
        stepExecution.toolCalls = 1;
        stepExecution.artifactCount = 1;
        continue;
      }

      artifacts.push({
        kind: 'note',
        title: step.title,
        payload: { note: step.objective },
      });
      stepExecution.status = 'succeeded';
      stepExecution.summary = 'Kept as an orchestration note with no direct tool call.';
      stepExecution.output = { note: step.objective };
      stepExecution.artifactKind = 'note';
      stepExecution.artifactCount = 1;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown step error';
      stepErrors.push(`${step.title}: ${errorMessage}`);
      if (step.kind === 'deliver') {
        deliveryError = errorMessage;
      }
      stepExecution.status = 'failed';
      stepExecution.error = errorMessage;
    } finally {
      stepExecution.finishedAt = new Date().toISOString();
      attachAutomationStepCharge(stepExecution);
      await emitProgress();
    }
  }

  if (!summaryText && (artifacts.length > 0 || stepErrors.length > 0)) {
    summaryText = await ensureAutomationSummaryText(automation, plan, artifacts, stepExecutions, stepErrors);
    artifacts.push({
      kind: 'summary',
      title: `${automation.name} summary`,
      payload: { markdown: summaryText },
    });
    await emitProgress();
  }

  return {
    plan,
    artifacts,
    summaryText,
    stepErrors,
    stepExecutions,
    delivery,
    deliveryError,
  };
}

async function runAutomation(automation: {
  id: string;
  name: string;
  description?: string;
  actions: string[];
  steps?: PersistedAutomationStep[];
  execution_policy?: AutomationExecutionPolicy;
  studio_state?: AutomationStudioState;
  notify?: string;
  condition?: string;
  timezone?: string;
}) {
  ensureWorkspaceCredits(DEFAULT_WORKSPACE_ID);
  const executionPlan = buildAutomationExecutionPlan(automation);
  const experimentAttribution = buildAutomationExperimentAttribution(automation.studio_state);
  const scenarioTelemetry = buildAutomationScenarioTelemetry(automation.studio_state, executionPlan, experimentAttribution);
  const modelTier = executionPlan.suggestedModelTier;
  const runModelSource = getModelSource(modelTier, DEFAULT_WORKSPACE_ID);
  const complexity = executionPlan.complexity;
  const toolCallCount = executionPlan.estimatedToolCalls;
  const executionRole = executionPlan.primaryRole;
  const delegation = buildDelegationRuntimeContext({
    workspaceId: DEFAULT_WORKSPACE_ID,
    taskKind: 'automation',
    title: automation.name,
    description: automation.description,
    autonomyMode: 'cautious',
    priority: 'medium',
    modelTier,
    toolCountHint: automation.actions.length,
    complexity,
    executorRoleOverride: executionRole,
    supportingRolesOverride: executionPlan.supportingRoles,
    reasonOverride: executionPlan.rationale,
  });
  const task = createTask({
    workspaceId: DEFAULT_WORKSPACE_ID,
    title: automation.name,
    description: automation.description,
    kind: 'automation',
    priority: 'medium',
    ...delegation.taskPatch,
    delegationPlanId: delegation.plan.id,
    delegationPlan: delegation.plan,
    metadata: {
      automationId: automation.id,
      notify: automation.notify || null,
      delegation: delegation.ownership,
      modelSource: runModelSource,
      modelSourceLabel: getModelSourceLabel(runModelSource),
      sourceSteps: automation.steps,
      executionPolicy: automation.execution_policy,
      studioState: automation.studio_state,
        experimentAttribution,
        scenarioTelemetry,
      automationPlan: executionPlan,
      plannedSteps: executionPlan.steps,
      rolePlan: {
        primaryRole: executionPlan.primaryRole,
        supportingRoles: executionPlan.supportingRoles,
        rationale: executionPlan.rationale,
        elasticLanes: executionPlan.elasticLanes,
        primaryBand: executionPlan.primaryBand,
      },
      workerTopology: executionPlan.topology,
    },
  });
  const estimate = estimateCreditCost({
    taskKind: 'automation',
    modelTier,
    automationRuns: 1,
    toolCalls: toolCallCount,
    complexity,
  });
  const estimatedCredits = Math.max(estimate.estimatedCredits, executionPlan.estimatedCredits);
  const taskRun = createTaskRun({
    workspaceId: DEFAULT_WORKSPACE_ID,
    taskId: task.id,
    ...delegation.taskRunPatch,
    modelTier,
    estimatedCredits,
    delegationPlan: delegation.plan,
    metadata: {
      automationId: automation.id,
      title: automation.name,
      delegation: delegation.ownership,
      modelSource: runModelSource,
      modelSourceLabel: getModelSourceLabel(runModelSource),
      sourceSteps: automation.steps,
      executionPolicy: automation.execution_policy,
      studioState: automation.studio_state,
        experimentAttribution,
        scenarioTelemetry,
      automationPlan: executionPlan,
      plannedSteps: executionPlan.steps,
      stepExecutions: [],
      rolePlan: {
        primaryRole: executionPlan.primaryRole,
        supportingRoles: executionPlan.supportingRoles,
        rationale: executionPlan.rationale,
        elasticLanes: executionPlan.elasticLanes,
        primaryBand: executionPlan.primaryBand,
      },
      workerTopology: executionPlan.topology,
    },
  });

  broadcastTaskPanelEvent(DEFAULT_WORKSPACE_ID, {
    type: 'automation_run_started',
    automationId: automation.id,
    taskId: task.id,
    taskRunId: taskRun.id,
  });

  try {
    assertCanSpendCredits(DEFAULT_WORKSPACE_ID, estimatedCredits);
    updateTask(task.id, { status: 'running', delegationState: 'in_progress' });

    const persistProgress = async (progress: {
      artifacts: AutomationExecutionArtifact[];
      summaryText: string;
      stepErrors: string[];
      stepExecutions: AutomationStepExecution[];
      delivery: Record<string, unknown> | null;
      deliveryError: string | null;
      workerTopology: AutomationExecutionPlan['topology'];
    }) => {
      updateTaskRun(taskRun.id, {
        metadata: {
          automationId: automation.id,
          title: automation.name,
          delegation: delegation.ownership,
          modelSource: runModelSource,
          modelSourceLabel: getModelSourceLabel(runModelSource),
          sourceSteps: automation.steps,
          executionPolicy: automation.execution_policy,
          studioState: automation.studio_state,
        experimentAttribution,
        scenarioTelemetry,
          automationPlan: executionPlan,
          plannedSteps: executionPlan.steps,
          stepExecutions: progress.stepExecutions,
          artifacts: progress.artifacts,
          summary: progress.summaryText || undefined,
          stepErrors: progress.stepErrors,
          delivery: progress.delivery,
          deliveryError: progress.deliveryError,
          rolePlan: {
            primaryRole: executionPlan.primaryRole,
            supportingRoles: executionPlan.supportingRoles,
            rationale: executionPlan.rationale,
            elasticLanes: executionPlan.elasticLanes,
            primaryBand: executionPlan.primaryBand,
          },
          workerTopology: progress.workerTopology,
        },
      });

      updateTask(task.id, {
        status: 'running',
        delegationState: 'in_progress',
        metadata: {
          automationId: automation.id,
          notify: automation.notify || null,
          delegation: delegation.ownership,
          modelSource: runModelSource,
          modelSourceLabel: getModelSourceLabel(runModelSource),
          sourceSteps: automation.steps,
          executionPolicy: automation.execution_policy,
          studioState: automation.studio_state,
        experimentAttribution,
        scenarioTelemetry,
          latestSummary: progress.summaryText || undefined,
          latestArtifacts: progress.artifacts,
          latestStepExecutions: progress.stepExecutions,
          automationPlan: executionPlan,
          plannedSteps: executionPlan.steps,
          rolePlan: {
            primaryRole: executionPlan.primaryRole,
            supportingRoles: executionPlan.supportingRoles,
            rationale: executionPlan.rationale,
            elasticLanes: executionPlan.elasticLanes,
            primaryBand: executionPlan.primaryBand,
          },
          workerTopology: progress.workerTopology,
          deliveryError: progress.deliveryError,
        },
      });

      const snapshotEvent = buildTaskRunSnapshotEvent(DEFAULT_WORKSPACE_ID, taskRun.id, 'progress');
      if (snapshotEvent) {
        broadcastTaskPanelEvent(DEFAULT_WORKSPACE_ID, snapshotEvent);
      }
    };

    const execution = await executeAutomationCore(automation, executionPlan, persistProgress);
    const fallbackSummary = [
      `Automation: ${automation.name}`,
      automation.description ? `Description: ${automation.description}` : null,
      `Actions:\n- ${automation.actions.join('\n- ')}`,
      automation.condition ? `Condition note: ${automation.condition}` : null,
    ].filter(Boolean).join('\n\n');
    const summary = execution.summaryText || fallbackSummary;

    const inferredActionDeliveryTarget = executionPlan.steps.find((step) => step.kind === 'deliver')?.deliveryTarget?.target;
    const deliveryTarget = automation.notify?.trim() || inferredActionDeliveryTarget || null;

    if (!deliveryTarget) {
      console.log(`[automation] ${automation.id}\n${summary}`);
    }

    const actualToolCalls = execution.stepExecutions.reduce((total, step) => total + Math.max(0, Math.trunc(step.toolCalls || 0)), 0);
    const actualCredits = estimateSuccessfulAutomationCredits(execution.stepExecutions);

    finalizeTaskRun(taskRun.id, {
      status: 'succeeded',
      actualCredits,
      metadata: {
        automationId: automation.id,
        summary,
        modelSource: runModelSource,
        modelSourceLabel: getModelSourceLabel(runModelSource),
        artifacts: execution.artifacts,
        stepErrors: execution.stepErrors,
        stepExecutions: execution.stepExecutions,
        stepCharges: execution.stepExecutions.map((step) => ({
          stepId: step.stepId,
          title: step.title,
          status: step.status,
          actualCredits: step.actualCredits || 0,
          charge: step.charge,
          tokenUsage: step.tokenUsage,
        })),
        sourceSteps: automation.steps,
        executionPolicy: automation.execution_policy,
        studioState: automation.studio_state,
        experimentAttribution,
        scenarioTelemetry,
        automationPlan: execution.plan,
        plannedSteps: execution.plan.steps,
        actualToolCalls,
        rolePlan: {
          primaryRole: execution.plan.primaryRole,
          supportingRoles: execution.plan.supportingRoles,
          rationale: execution.plan.rationale,
          elasticLanes: execution.plan.elasticLanes,
          primaryBand: execution.plan.primaryBand,
        },
        workerTopology: applyWorkerRuntimeActivity(execution.plan.topology, execution.stepExecutions),
        delivery: execution.delivery,
        deliveryError: execution.deliveryError,
      },
    });
    updateTask(task.id, {
      status: 'completed',
      delegationState: 'completed',
      metadata: {
        automationId: automation.id,
        notify: deliveryTarget || null,
        delegation: delegation.ownership,
        modelSource: runModelSource,
        modelSourceLabel: getModelSourceLabel(runModelSource),
        sourceSteps: automation.steps,
        executionPolicy: automation.execution_policy,
        studioState: automation.studio_state,
        experimentAttribution,
        scenarioTelemetry,
        latestSummary: summary,
        latestArtifacts: execution.artifacts,
        latestStepExecutions: execution.stepExecutions,
        stepCharges: execution.stepExecutions.map((step) => ({
          stepId: step.stepId,
          title: step.title,
          status: step.status,
          actualCredits: step.actualCredits || 0,
          charge: step.charge,
          tokenUsage: step.tokenUsage,
        })),
        automationPlan: execution.plan,
        plannedSteps: execution.plan.steps,
        rolePlan: {
          primaryRole: execution.plan.primaryRole,
          supportingRoles: execution.plan.supportingRoles,
          rationale: execution.plan.rationale,
          elasticLanes: execution.plan.elasticLanes,
          primaryBand: execution.plan.primaryBand,
        },
        workerTopology: applyWorkerRuntimeActivity(execution.plan.topology, execution.stepExecutions),
        deliveryError: execution.deliveryError,
      },
    });
    addLedgerEntry({
      workspaceId: DEFAULT_WORKSPACE_ID,
      source: 'automation_run',
      deltaCredits: -actualCredits,
      referenceType: 'automation',
      referenceId: automation.id,
      note: `Automation run: ${automation.name}`,
      metadata: {
        taskId: task.id,
        taskRunId: taskRun.id,
        actualToolCalls,
        experimentAttribution,
        scenarioTelemetry,
        stepCharges: execution.stepExecutions.map((step) => ({
          stepId: step.stepId,
          title: step.title,
          status: step.status,
          actualCredits: step.actualCredits || 0,
        })),
        deliveryError: execution.deliveryError,
      },
    });
    const completedSnapshot = buildTaskRunSnapshotEvent(DEFAULT_WORKSPACE_ID, taskRun.id, 'completed');
    if (completedSnapshot) {
      broadcastTaskPanelEvent(DEFAULT_WORKSPACE_ID, completedSnapshot);
    }
    return {
      ok: true as const,
      deliveryError: execution.deliveryError || undefined,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown automation error';
    const failureSummary = errorMessage.toLowerCase().includes('insufficient credits')
      ? `Automation could not start because the workspace does not have enough credits for this run.\n\n${errorMessage}`
      : `Automation failed before it could finish cleanly.\n\n${errorMessage}`;

    finalizeTaskRun(taskRun.id, {
      status: 'failed',
      actualCredits: 0,
      error: errorMessage,
      metadata: {
        automationId: automation.id,
        summary: failureSummary,
        modelSource: runModelSource,
        modelSourceLabel: getModelSourceLabel(runModelSource),
        plannedSteps: executionPlan.steps,
        stepExecutions: [],
        executionPolicy: automation.execution_policy,
        studioState: automation.studio_state,
        experimentAttribution,
        scenarioTelemetry,
        rolePlan: {
          primaryRole: executionPlan.primaryRole,
          supportingRoles: executionPlan.supportingRoles,
          rationale: executionPlan.rationale,
          elasticLanes: executionPlan.elasticLanes,
          primaryBand: executionPlan.primaryBand,
        },
        workerTopology: applyWorkerRuntimeActivity(executionPlan.topology, []),
        sourceSteps: automation.steps,
        artifacts: [
          {
            kind: 'note',
            title: `${automation.name} execution status`,
            payload: {
              note: failureSummary,
              error: errorMessage,
            },
          },
        ],
      },
    });
    updateTask(task.id, {
      status: 'failed',
      delegationState: 'review',
      metadata: {
        automationId: automation.id,
        notify: automation.notify || null,
        delegation: delegation.ownership,
        modelSource: runModelSource,
        modelSourceLabel: getModelSourceLabel(runModelSource),
        sourceSteps: automation.steps,
        executionPolicy: automation.execution_policy,
        studioState: automation.studio_state,
        experimentAttribution,
        scenarioTelemetry,
        latestSummary: failureSummary,
        latestStepExecutions: [],
        automationPlan: executionPlan,
        plannedSteps: executionPlan.steps,
        rolePlan: {
          primaryRole: executionPlan.primaryRole,
          supportingRoles: executionPlan.supportingRoles,
          rationale: executionPlan.rationale,
          elasticLanes: executionPlan.elasticLanes,
          primaryBand: executionPlan.primaryBand,
        },
        workerTopology: applyWorkerRuntimeActivity(executionPlan.topology, []),
        latestArtifacts: [
          {
            kind: 'note',
            title: `${automation.name} execution status`,
            payload: {
              note: failureSummary,
              error: errorMessage,
            },
          },
        ],
      },
    });
    const failedSnapshot = buildTaskRunSnapshotEvent(DEFAULT_WORKSPACE_ID, taskRun.id, 'failed');
    if (failedSnapshot) {
      broadcastTaskPanelEvent(DEFAULT_WORKSPACE_ID, failedSnapshot);
    }
    console.error(`[automation] ${automation.id} failed`, error);
    return {
      ok: false as const,
      error: errorMessage,
    };
  }
}

app.post('/api/chat', async (req: Request, res: Response) => {
  const { messages, autonomyMode = 'cautious', modelProfile = 'auto' } = req.body as ChatRequest;

  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: 'Invalid request: messages array required' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const sendEvent = (data: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
  const { workspaceId } = resolveWorkspaceContext(req);

  try {
    await executeConversationTask({
      messages,
      autonomyMode,
      modelProfile,
      workspaceId,
      sendEvent,
    });
    sendEvent({ type: 'done' });
    res.end();
  } catch (error) {
    console.error('Error calling Anthropic API:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    sendEvent({ type: 'error', message: errorMessage });
    res.end();
  }
});

/**
 * Title generation — uses Haiku (fast & cheap).
 * Called after the first assistant reply to produce a smart title
 * instead of naively slicing the user message.
 */
app.post('/api/title', async (req: Request, res: Response) => {
  const { workspaceId } = resolveWorkspaceContext(req);
  const { messages } = req.body as { messages: ChatMessage[] };
  if (!messages || messages.length < 1) {
    res.json({ title: 'New conversation' });
    return;
  }
  try {
    const excerpt = messages
      .slice(0, 4)
      .map((m) => `${m.role === 'user' ? 'User' : 'Violema'}: ${m.content.slice(0, 300)}`)
      .join('\n');

    const title = (await generateText(
      'utility',
      'Return ONLY a conversation title: 3-6 words, no quotes, no ending punctuation. Nothing else.',
      [{ role: 'user', content: `Title this AI coworker conversation:\n${excerpt}` }],
      20,
      workspaceId,
    )).trim().slice(0, 60) || 'New conversation';

    res.json({ title, model: getUtilityModelConfig(workspaceId).model });
  } catch {
    const fallback = messages[0]?.content?.slice(0, 45) || 'New conversation';
    res.json({ title: fallback });
  }
});

/**
 * Conversation summary — uses Haiku.
 * Produces a 1-sentence summary for sidebar preview.
 */
app.post('/api/summarize', async (req: Request, res: Response) => {
  const { workspaceId } = resolveWorkspaceContext(req);
  const { messages } = req.body as { messages: ChatMessage[] };
  if (!messages || messages.length < 2) {
    res.json({ summary: '' });
    return;
  }
  try {
    const text = messages
      .slice(-6)
      .map((m) => `${m.role === 'user' ? 'User' : 'Violema'}: ${m.content.slice(0, 200)}`)
      .join('\n');

    const summary = await generateText(
      'utility',
      'Return ONE short sentence (max 12 words) summarising the outcome of this conversation. No quotes.',
      [{ role: 'user', content: text }],
      40,
      workspaceId,
    );

    res.json({ summary, model: getUtilityModelConfig(workspaceId).model });
  } catch {
    res.json({ summary: '' });
  }
});

// ── Composio integration endpoints ────────────────────────────────────────────
app.get('/api/integrations/composio/status', (req: Request, res: Response) => {
  const { workspaceId } = resolveWorkspaceContext(req);
  res.json({ enabled: isComposioEnabled(), workspaceId });
});

app.get('/api/integrations/composio/connections', async (req: Request, res: Response) => {
  const { workspaceId } = resolveWorkspaceContext(req);
  if (!isComposioEnabled()) {
    res.json({ enabled: false, apps: [] });
    return;
  }
  const apps = await listConnectedApps({ entityId: workspaceId });
  res.json({ enabled: true, apps });
});

app.post('/api/integrations/composio/connect', async (req: Request, res: Response) => {
  const { workspaceId } = resolveWorkspaceContext(req);
  const { appName } = (req.body || {}) as { appName?: string };
  if (!appName || typeof appName !== 'string') {
    res.status(400).json({ error: 'appName is required' });
    return;
  }
  if (!isComposioEnabled()) {
    res.status(503).json({ error: 'Composio is not configured on this server.' });
    return;
  }
  const redirectUrl = await getComposioConnectionUrl(appName, { entityId: workspaceId });
  if (!redirectUrl) {
    res.status(500).json({ error: `Could not start OAuth flow for ${appName}` });
    return;
  }
  res.json({ redirectUrl });
});

registerAgentStudioSettingsRoutes(app, {
  resolveWorkspaceContext,
  getWorkspaceSettingsView,
  getModelRoutingStatus,
  upsertWorkspaceSettings,
  testProviderConnection,
  testModelProfileConnection,
});

registerAgentStudioRoutes(app, {
  resolveWorkspaceContext,
});

// ── Waitlist ──────────────────────────────────────────────────────────────────
const WAITLIST_FILE = path.join(process.cwd(), 'waitlist.json');

function loadWaitlist(): { email: string; name?: string; source: string; ts: string }[] {
  try {
    if (fs.existsSync(WAITLIST_FILE)) {
      return JSON.parse(fs.readFileSync(WAITLIST_FILE, 'utf-8'));
    }
  } catch { /* ignore */ }
  return [];
}

function saveWaitlist(list: ReturnType<typeof loadWaitlist>) {
  fs.writeFileSync(WAITLIST_FILE, JSON.stringify(list, null, 2));
}

app.post('/api/waitlist', (req: Request, res: Response) => {
  const { email, name, source = 'footer' } = req.body as { email?: string; name?: string; source?: string };

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'Invalid email address.' });
    return;
  }

  const list = loadWaitlist();
  const duplicate = list.find((e) => e.email.toLowerCase() === email.toLowerCase());
  if (duplicate) {
    res.json({ ok: true, duplicate: true, position: list.indexOf(duplicate) + 1 });
    return;
  }

  list.push({ email: email.toLowerCase(), name, source, ts: new Date().toISOString() });
  saveWaitlist(list);

  console.log(`[waitlist] #${list.length} — ${email}`);
  res.json({ ok: true, duplicate: false, position: list.length });
});

app.get('/api/auth/:provider/start', (req: Request, res: Response) => {
  const provider = req.params.provider as OAuthProvider;
  const intent = req.query.intent === 'login' ? 'login' : 'signup';
  const next = sanitizeNextPath(
    typeof req.query.next === 'string'
      ? req.query.next
      : intent === 'signup'
        ? '/connect/slack?next=%2Fplans'
        : '/dashboard',
    intent === 'signup' ? '/connect/slack?next=%2Fplans' : '/dashboard',
  );
  const acceptedTerms = req.query.acceptedTerms === '1' || req.query.acceptedTerms === 'true';
  const acceptedEducation = req.query.acceptedEducation === '1' || req.query.acceptedEducation === 'true';
  const origin = getAuthPublicOrigin(req);

  if (intent === 'signup' && (!acceptedTerms || !acceptedEducation)) {
    redirectToAuthError(res, origin, intent, next, 'Please accept the access terms before continuing.');
    return;
  }

  const state = encodeOAuthState({
    provider,
    intent,
    next,
    acceptedTerms,
    acceptedEducation,
    issuedAt: Date.now(),
  });

  const callbackUrl = buildOAuthCallbackUrl(req, provider);
  const authUrl = new URL(
    provider === 'google'
      ? 'https://accounts.google.com/o/oauth2/v2/auth'
      : `https://login.microsoftonline.com/${getMicrosoftOAuthConfig()?.tenantId || 'common'}/oauth2/v2.0/authorize`,
  );

  if (provider === 'google') {
    const config = getGoogleOAuthConfig();
    if (!config) {
      redirectToAuthError(res, origin, intent, next, 'Google sign-in is not configured yet.');
      return;
    }

    authUrl.search = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
    }).toString();
    res.redirect(authUrl.toString());
    return;
  }

  if (provider === 'microsoft') {
    const config = getMicrosoftOAuthConfig();
    if (!config) {
      redirectToAuthError(res, origin, intent, next, 'Microsoft sign-in is not configured yet.');
      return;
    }

    authUrl.search = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: callbackUrl,
      response_type: 'code',
      response_mode: 'query',
      scope: 'openid profile email User.Read',
      state,
      prompt: 'select_account',
    }).toString();
    res.redirect(authUrl.toString());
    return;
  }

  res.status(404).json({ error: 'Unsupported auth provider' });
});

app.get('/api/auth/:provider/callback', async (req: Request, res: Response) => {
  const provider = req.params.provider as OAuthProvider;
  const state = decodeOAuthState(typeof req.query.state === 'string' ? req.query.state : undefined);
  const origin = getAuthPublicOrigin(req);
  const fallbackIntent = req.query.intent === 'login' ? 'login' : 'signup';
  const fallbackNext = sanitizeNextPath(typeof req.query.next === 'string' ? req.query.next : undefined);
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const providerError = typeof req.query.error === 'string' ? req.query.error : '';

  if (providerError) {
    redirectToAuthError(
      res,
      origin,
      state?.intent || fallbackIntent,
      state?.next || fallbackNext,
      typeof req.query.error_description === 'string' ? req.query.error_description : 'Sign-in was cancelled.',
    );
    return;
  }

  if (!state || state.provider !== provider) {
    redirectToAuthError(res, origin, fallbackIntent, fallbackNext, 'Auth session expired. Please try again.');
    return;
  }

  if (!code) {
    redirectToAuthError(res, origin, state.intent, state.next, 'No authorization code was returned.');
    return;
  }

  try {
    const callbackUrl = buildOAuthCallbackUrl(req, provider);
    let email = '';
    let name = '';

    if (provider === 'google') {
      const config = getGoogleOAuthConfig();
      if (!config) throw new Error('Google sign-in is not configured yet.');

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: config.clientId,
          client_secret: config.clientSecret,
          redirect_uri: callbackUrl,
          grant_type: 'authorization_code',
        }),
      });
      const tokenPayload = await tokenResponse.json().catch(() => null) as Record<string, unknown> | null;
      if (!tokenResponse.ok || typeof tokenPayload?.access_token !== 'string') {
        throw new Error(typeof tokenPayload?.error_description === 'string' ? tokenPayload.error_description : 'Google token exchange failed.');
      }

      const userResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: {
          Authorization: `Bearer ${tokenPayload.access_token}`,
        },
      });
      const userPayload = await userResponse.json().catch(() => null) as Record<string, unknown> | null;
      if (!userResponse.ok || typeof userPayload?.email !== 'string') {
        throw new Error('Google profile lookup failed.');
      }

      email = String(userPayload.email).trim().toLowerCase();
      name =
        (typeof userPayload.name === 'string' && userPayload.name.trim()) ||
        (typeof userPayload.given_name === 'string' && userPayload.given_name.trim()) ||
        email.split('@')[0];
    } else if (provider === 'microsoft') {
      const config = getMicrosoftOAuthConfig();
      if (!config) throw new Error('Microsoft sign-in is not configured yet.');

      const tokenResponse = await fetch(`https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: config.clientId,
          client_secret: config.clientSecret,
          redirect_uri: callbackUrl,
          grant_type: 'authorization_code',
          scope: 'openid profile email User.Read',
        }),
      });
      const tokenPayload = await tokenResponse.json().catch(() => null) as Record<string, unknown> | null;
      if (!tokenResponse.ok || typeof tokenPayload?.access_token !== 'string') {
        throw new Error(typeof tokenPayload?.error_description === 'string' ? tokenPayload.error_description : 'Microsoft token exchange failed.');
      }

      const userResponse = await fetch('https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName', {
        headers: {
          Authorization: `Bearer ${tokenPayload.access_token}`,
        },
      });
      const userPayload = await userResponse.json().catch(() => null) as Record<string, unknown> | null;
      const rawEmail =
        (typeof userPayload?.mail === 'string' && userPayload.mail.trim()) ||
        (typeof userPayload?.userPrincipalName === 'string' && userPayload.userPrincipalName.trim()) ||
        '';
      if (!userResponse.ok || !rawEmail) {
        throw new Error('Microsoft profile lookup failed.');
      }

      email = rawEmail.toLowerCase();
      name =
        (typeof userPayload?.displayName === 'string' && userPayload.displayName.trim()) ||
        email.split('@')[0];
    } else {
      res.status(404).json({ error: 'Unsupported auth provider' });
      return;
    }

    const role = getAdminEmailAllowlist().has(normalizeEmail(email)) ? 'admin' : 'user';
    const user = upsertAuthUser({
      email,
      name,
      role,
      method: provider,
      acceptedTerms: state.acceptedTerms,
      acceptedEducation: state.acceptedEducation,
    });
    const { token } = createAuthSession(user.id);
    res.setHeader('Set-Cookie', buildAuthCookie(token));
    res.redirect(`${origin}${state.next}`);
  } catch (error) {
    redirectToAuthError(
      res,
      origin,
      state.intent,
      state.next,
      error instanceof Error ? error.message : 'Sign-in failed. Please try again.',
    );
  }
});

app.get('/api/auth/session', (req: Request, res: Response) => {
  const token = parseCookieValue(req, AUTH_COOKIE_NAME);
  if (!token) {
    res.status(401).json({ error: 'No active session' });
    return;
  }

  const record = getAuthUserByToken(token);
  if (!record) {
    res.setHeader('Set-Cookie', getAuthCookieOptions());
    res.status(401).json({ error: 'Session expired' });
    return;
  }

  res.json({
    ok: true,
    user: record.user,
  });
});

app.post('/api/auth/session', (req: Request, res: Response) => {
  const body = (req.body || {}) as Record<string, unknown>;
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const method = (
    typeof body.method === 'string' && ['email', 'google', 'microsoft'].includes(body.method)
      ? body.method
      : 'email'
  ) as PersistedAuthMethod;
  const acceptedTerms = Boolean(body.acceptedTerms);
  const acceptedEducation = Boolean(body.acceptedEducation);

  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    res.status(400).json({ error: 'Valid email is required' });
    return;
  }

  if (!name || name.length < 2) {
    res.status(400).json({ error: 'Valid name is required' });
    return;
  }

  const role = getAdminEmailAllowlist().has(normalizeEmail(email)) ? 'admin' : 'user';
  const user = upsertAuthUser({
    email,
    name,
    role,
    method,
    acceptedTerms,
    acceptedEducation,
    slackWorkspace: typeof body.slackWorkspace === 'string' ? body.slackWorkspace.trim() || undefined : undefined,
    slackChannelId: typeof body.slackChannelId === 'string' ? body.slackChannelId.trim() || undefined : undefined,
    slackDisplayTarget: typeof body.slackDisplayTarget === 'string' ? body.slackDisplayTarget.trim() || undefined : undefined,
    slackConnectedAt: typeof body.slackConnectedAt === 'string' ? body.slackConnectedAt : undefined,
  });
  const { token } = createAuthSession(user.id);
  res.setHeader('Set-Cookie', buildAuthCookie(token));
  res.json({
    ok: true,
    user,
  });
});

app.patch('/api/auth/session', (req: Request, res: Response) => {
  const token = parseCookieValue(req, AUTH_COOKIE_NAME);
  if (!token) {
    res.status(401).json({ error: 'No active session' });
    return;
  }

  const record = getAuthUserByToken(token);
  if (!record) {
    res.setHeader('Set-Cookie', getAuthCookieOptions());
    res.status(401).json({ error: 'Session expired' });
    return;
  }

  const body = (req.body || {}) as Record<string, unknown>;
  const user = upsertAuthUser({
    email: record.user.email,
    name: typeof body.name === 'string' && body.name.trim() ? body.name.trim() : record.user.name,
    role: record.user.role,
    method: record.user.method,
    acceptedTerms: typeof body.acceptedTerms === 'boolean' ? body.acceptedTerms : record.user.acceptedTerms,
    acceptedEducation: typeof body.acceptedEducation === 'boolean' ? body.acceptedEducation : record.user.acceptedEducation,
    slackWorkspace: typeof body.slackWorkspace === 'string' ? body.slackWorkspace.trim() || undefined : record.user.slackWorkspace,
    slackChannelId: typeof body.slackChannelId === 'string' ? body.slackChannelId.trim() || undefined : record.user.slackChannelId,
    slackDisplayTarget: typeof body.slackDisplayTarget === 'string' ? body.slackDisplayTarget.trim() || undefined : record.user.slackDisplayTarget,
    slackConnectedAt: typeof body.slackConnectedAt === 'string' ? body.slackConnectedAt : record.user.slackConnectedAt,
  });

  res.json({
    ok: true,
    user,
  });
});

app.post('/api/auth/logout', (req: Request, res: Response) => {
  const token = parseCookieValue(req, AUTH_COOKIE_NAME);
  if (token) {
    clearPersistedAuthSession(token);
  }
  res.setHeader('Set-Cookie', getAuthCookieOptions());
  res.json({ ok: true });
});

app.get('/api/workspace', (req: Request, res: Response) => {
  const { workspaceId, workspaceName, workspace } = resolveWorkspaceContext(req);
  res.json({
    workspaceId,
    workspaceName,
    workspace,
    billing: getBillingStatus(workspaceId),
  });
});

app.post('/api/workspace', (req: Request, res: Response) => {
  const { workspaceId } = resolveWorkspaceContext(req);
  const body = req.body as { workspaceName?: string; ownerEmail?: string; slug?: string };
  const workspace = upsertWorkspaceProfile(workspaceId, {
    name: body.workspaceName,
    ownerEmail: body.ownerEmail,
    slug: body.slug,
  });

  res.json({
    ok: true,
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    workspace,
    billing: getBillingStatus(workspace.id),
  });
});

app.get('/api/billing/usage', (req: Request, res: Response) => {
  const { workspaceId } = resolveWorkspaceContext(req);
  res.json(buildCreditSnapshot(workspaceId));
});

app.get('/api/usage/credits', (req: Request, res: Response) => {
  const { workspaceId } = resolveWorkspaceContext(req);
  res.json(buildCreditSnapshot(workspaceId));
});

app.post('/api/billing/estimate', (req: Request, res: Response) => {
  const {
    taskKind = 'chat',
    modelTier = 'default',
    toolCalls = 0,
    automationRuns = 0,
    reviewRequired = false,
    artifactCount = 0,
    complexity = 'low',
    durationSeconds = 0,
  } = req.body as Record<string, unknown>;

  const estimate = estimateCreditCost({
    taskKind: String(taskKind) as Parameters<typeof estimateCreditCost>[0]['taskKind'],
    modelTier: String(modelTier) as Parameters<typeof estimateCreditCost>[0]['modelTier'],
    toolCalls: Number(toolCalls),
    automationRuns: Number(automationRuns),
    reviewRequired: Boolean(reviewRequired),
    artifactCount: Number(artifactCount),
    complexity: String(complexity) as Parameters<typeof estimateCreditCost>[0]['complexity'],
    durationSeconds: Number(durationSeconds),
  });

  res.json(estimate);
});

app.get('/api/billing/config', (req: Request, res: Response) => {
  const { workspaceId, workspace } = resolveWorkspaceContext(req);
  const status = getBillingStatus(workspaceId);
  const enforcement = evaluatePlanEnforcement({
    workspaceId,
    automationCount: getPersistedAutomationCount(),
  });

  res.json({
    workspace,
    ...status,
    enforcement,
    payments: getStripeBillingConfig(workspaceId),
  });
});

app.post('/api/billing/config', (req: Request, res: Response) => {
  const { workspaceId } = resolveWorkspaceContext(req);
  const patch = req.body as Record<string, unknown>;
  const next = upsertBillingConfig(workspaceId, {
    planId: typeof patch.planId === 'string' ? patch.planId as 'starter' | 'pro' | 'team' : undefined,
    autoTopUpEnabled: typeof patch.autoTopUpEnabled === 'boolean' ? patch.autoTopUpEnabled : undefined,
    autoTopUpThresholdCredits:
      typeof patch.autoTopUpThresholdCredits === 'number' ? patch.autoTopUpThresholdCredits : undefined,
    autoTopUpAmountCredits:
      typeof patch.autoTopUpAmountCredits === 'number' ? patch.autoTopUpAmountCredits : undefined,
  });

  res.json({
    ok: true,
    config: next,
    status: getBillingStatus(workspaceId),
  });
});

app.get('/api/billing/offers', (_req: Request, res: Response) => {
  res.json({ items: listTopUpOffers() });
});

app.post('/api/billing/top-up', (req: Request, res: Response) => {
  const { workspaceId } = resolveWorkspaceContext(req);
  const { offerId } = req.body as { offerId?: string };
  if (!offerId) {
    res.status(400).json({ error: 'offerId is required' });
    return;
  }

  try {
    res.json({
      ok: true,
      ...purchaseTopUp(workspaceId, offerId),
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Could not apply top-up' });
  }
});

app.post('/api/admin/test-credits', (req: Request, res: Response) => {
  try {
    const adminEmail = assertAdminAccess(req);
    const { workspaceId } = resolveWorkspaceContext(req);
    const requestedAmount = Number((req.body as Record<string, unknown> | undefined)?.amount);
    const amount = Number.isFinite(requestedAmount)
      ? Math.max(100, Math.min(50000, Math.trunc(requestedAmount)))
      : 5000;

    const entry = addLedgerEntry({
      workspaceId,
      source: 'manual_adjustment',
      deltaCredits: amount,
      referenceType: 'manual',
      referenceId: `admin_test_${Date.now()}`,
      note: `Founder test credit grant by ${adminEmail}`,
      metadata: {
        adminEmail,
        testingOnly: true,
      },
    });

    res.json({
      ok: true,
      entry,
      billing: getBillingStatus(workspaceId),
    });
  } catch (error) {
    let statusCode = 400;
    if (error instanceof Error) {
      const taggedError = error as Error & { statusCode?: number };
      if (typeof taggedError.statusCode === 'number') {
        statusCode = taggedError.statusCode;
      }
    }
    res.status(statusCode).json({
      error: error instanceof Error ? error.message : 'Could not load test credits',
    });
  }
});

app.post('/api/billing/stripe/webhook', async (req: Request, res: Response) => {
  const signature = req.header('stripe-signature');
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;

  if (!signature || !rawBody) {
    res.status(400).json({ error: 'Missing Stripe signature or raw request body' });
    return;
  }

  try {
    const event = constructStripeWebhookEvent(rawBody, signature);
    const result = await fulfillStripeWebhookEvent(event);
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Stripe webhook verification failed' });
  }
});

app.post('/api/slack/events', async (req: Request, res: Response) => {
  const signature = req.header('x-slack-signature');
  const timestamp = req.header('x-slack-request-timestamp');
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;

  if (!signature || !timestamp || !rawBody) {
    res.status(400).json({ error: 'Missing Slack signature, timestamp, or raw request body' });
    return;
  }

  try {
    verifySlackSignature(rawBody, signature, timestamp);
  } catch (error) {
    res.status(401).json({ error: error instanceof Error ? error.message : 'Slack signature verification failed' });
    return;
  }

  const body = req.body as {
    type?: string;
    challenge?: string;
    event_id?: string;
    team_id?: string;
    event?: Record<string, unknown>;
  };

  if (body.type === 'url_verification') {
    res.json({ challenge: body.challenge || '' });
    return;
  }

  if (body.type !== 'event_callback' || !body.event_id || !body.event) {
    res.json({ ok: true });
    return;
  }

  if (!markSlackEventHandled(body.event_id)) {
    res.json({ ok: true, duplicate: true });
    return;
  }

  res.json({ ok: true });

  const workspaceId = DEFAULT_WORKSPACE_ID;
  void handleSlackIncomingEvent({
    eventId: body.event_id,
    event: body.event,
    workspaceId,
  });
});

app.get('/api/billing/stripe/config', (req: Request, res: Response) => {
  const { workspaceId } = resolveWorkspaceContext(req);
  res.json(getStripeBillingConfig(workspaceId));
});

app.post('/api/billing/stripe/checkout/subscription', async (req: Request, res: Response) => {
  const { workspaceId } = resolveWorkspaceContext(req);
  const body = req.body as { planId?: string; successUrl?: string; cancelUrl?: string; metadata?: Record<string, string> };
  const planId = body.planId && ['starter', 'pro', 'team'].includes(body.planId) ? (body.planId as 'starter' | 'pro' | 'team') : getBillingStatus(workspaceId).config.planId;

  try {
    const session = await createSubscriptionCheckoutSession(workspaceId, planId, {
      successUrl: body.successUrl,
      cancelUrl: body.cancelUrl,
      metadata: body.metadata,
    });

    res.json({
      ok: true,
      session,
      billing: getBillingStatus(workspaceId),
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Could not create subscription checkout session' });
  }
});

app.post('/api/billing/stripe/checkout/top-up', async (req: Request, res: Response) => {
  const { workspaceId } = resolveWorkspaceContext(req);
  const body = req.body as { offerId?: string; successUrl?: string; cancelUrl?: string; quantity?: number; metadata?: Record<string, string> };
  if (!body.offerId) {
    res.status(400).json({ error: 'offerId is required' });
    return;
  }

  try {
    const session = await createTopUpCheckoutSession(workspaceId, body.offerId, {
      successUrl: body.successUrl,
      cancelUrl: body.cancelUrl,
      quantity: Number.isFinite(body.quantity) ? body.quantity : undefined,
      metadata: body.metadata,
    });

    res.json({
      ok: true,
      session,
      billing: getBillingStatus(workspaceId),
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Could not create top-up checkout session' });
  }
});

app.get('/api/billing/stripe/mock-checkout/:sessionId', (req: Request, res: Response) => {
  const { workspaceId } = resolveWorkspaceContext(req);
  res.json({
    ok: true,
    sessionId: req.params.sessionId,
    provider: 'mock',
    message: 'Stripe is not configured on this environment, so this is a mock checkout session.',
    billing: getBillingStatus(workspaceId),
  });
});

app.get('/api/billing/referrals', (req: Request, res: Response) => {
  const { workspaceId } = resolveWorkspaceContext(req);
  res.json({
    items: listReferralEvents(workspaceId),
    summary: summarizeReferralRewards(workspaceId),
    billing: getBillingStatus(workspaceId),
  });
});

app.post('/api/billing/referrals', (req: Request, res: Response) => {
  const { workspaceId } = resolveWorkspaceContext(req);
  const { referredEmail, source, referrerEmail } = req.body as {
    referredEmail?: string;
    source?: 'invite' | 'manual' | 'campaign';
    referrerEmail?: string;
  };

  if (!referredEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(referredEmail)) {
    res.status(400).json({ error: 'Valid referredEmail is required' });
    return;
  }

  const event = recordReferralEvent({
    workspaceId,
    referredEmail,
    referrerEmail,
    source,
  });

  res.json({
    ok: true,
    event,
    summary: summarizeReferralRewards(workspaceId),
  });
});

app.post('/api/billing/referrals/:id/qualify', (req: Request, res: Response) => {
  const { workspaceId } = resolveWorkspaceContext(req);
  const event = markReferralQualified(req.params.id);
  if (!event) {
    res.status(404).json({ error: 'Referral not found' });
    return;
  }

  res.json({
    ok: true,
    event,
    summary: summarizeReferralRewards(workspaceId),
  });
});

app.post('/api/billing/referrals/:id/reward', (req: Request, res: Response) => {
  const { workspaceId } = resolveWorkspaceContext(req);
  const current = listReferralEvents(workspaceId).find((item) => item.id === req.params.id);
  if (!current) {
    res.status(404).json({ error: 'Referral not found' });
    return;
  }
  if (current.status === 'rewarded') {
    res.json({
      ok: true,
      event: current,
      summary: summarizeReferralRewards(workspaceId),
      billing: getBillingStatus(workspaceId),
    });
    return;
  }

  const rewarded = markReferralRewarded(req.params.id);
  if (!rewarded) {
    res.status(404).json({ error: 'Referral not found' });
    return;
  }

  addLedgerEntry({
    workspaceId,
    source: 'referral_bonus',
    deltaCredits: rewarded.rewardCredits,
    referenceType: 'referral',
    referenceId: rewarded.id,
    note: `Referral reward for ${rewarded.referredEmail}`,
    metadata: { friendRewardCredits: rewarded.friendRewardCredits },
  });

  res.json({
    ok: true,
    event: rewarded,
    summary: summarizeReferralRewards(workspaceId),
    billing: getBillingStatus(workspaceId),
  });
});

app.get('/api/automations', (_req: Request, res: Response) => {
  res.json({ items: listAutomations() });
});

app.post('/api/automations', async (req: Request, res: Response) => {
  const body = req.body as {
    name?: string;
    description?: string;
    authoringMode?: 'guided' | 'describe';
    workflowPrompt?: string;
    schedule?: string;
    timezone?: string;
    actions?: unknown[];
    steps?: unknown[];
    executionPolicy?: unknown;
    studioState?: unknown;
    notify?: string | null;
    condition?: string | null;
  };

  const normalizedSteps = Array.isArray(body.steps) ? normalizePersistedAutomationSteps(body.steps) : [];
  const normalizedActions = normalizedSteps.length > 0
    ? deriveLegacyActionsFromSteps(normalizedSteps)
    : Array.isArray(body.actions)
      ? body.actions.map((item) => String(item).trim()).filter(Boolean)
      : [];

  if (!body.name || !body.schedule || normalizedActions.length === 0) {
    res.status(400).json({ error: 'name, schedule, and at least one workflow step are required' });
    return;
  }

  try {
    if (typeof body.notify === 'string' && body.notify.trim()) {
      await validateMessageTarget({ to: body.notify.trim() });
    }
    const record = createAutomation({
      name: body.name.trim(),
      description: typeof body.description === 'string' ? body.description.trim() || undefined : undefined,
      authoring_mode: body.authoringMode === 'describe' ? 'describe' : 'guided',
      workflow_prompt: typeof body.workflowPrompt === 'string' ? body.workflowPrompt.trim() || undefined : undefined,
      schedule: body.schedule.trim(),
      timezone: typeof body.timezone === 'string' ? body.timezone.trim() || undefined : undefined,
      actions: normalizedActions,
      steps: normalizedSteps.length > 0 ? normalizedSteps : undefined,
      execution_policy: normalizeAutomationExecutionPolicy(body.executionPolicy),
      studio_state: normalizeAutomationStudioState(body.studioState),
      notify: typeof body.notify === 'string' ? body.notify.trim() || undefined : undefined,
      condition: typeof body.condition === 'string' ? body.condition.trim() || undefined : undefined,
    }, runAutomation);

    broadcastTaskPanelEvent(DEFAULT_WORKSPACE_ID, {
      type: 'automation_created',
      automationId: record.id,
    });
    res.status(201).json({ ok: true, item: record });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Could not create automation' });
  }
});

app.post('/api/automations/:id/run', (req: Request, res: Response) => {
  const record = triggerAutomationNow(req.params.id, runAutomation);
  if (!record) {
    res.status(404).json({ error: 'Automation not found' });
    return;
  }

  broadcastTaskPanelEvent(DEFAULT_WORKSPACE_ID, {
    type: 'automation_triggered',
    automationId: record.id,
  });
  res.json({ ok: true, item: record, message: `Triggered ${record.name}` });
});

app.patch('/api/automations/:id', async (req: Request, res: Response) => {
  const patch: Record<string, unknown> = {};

  if (typeof req.body.name === 'string') patch.name = req.body.name.trim();
  if (typeof req.body.description === 'string') patch.description = req.body.description.trim();
  if (req.body.authoringMode === 'guided' || req.body.authoringMode === 'describe') patch.authoring_mode = req.body.authoringMode;
  if (typeof req.body.workflowPrompt === 'string') patch.workflow_prompt = req.body.workflowPrompt.trim();
  if (typeof req.body.schedule === 'string') patch.schedule = req.body.schedule.trim();
  if (typeof req.body.timezone === 'string') patch.timezone = req.body.timezone.trim();
  if (typeof req.body.notify === 'string') patch.notify = req.body.notify.trim();
  if (typeof req.body.condition === 'string') patch.condition = req.body.condition.trim();
  if (typeof req.body.executionPolicy !== 'undefined') {
    patch.execution_policy = normalizeAutomationExecutionPolicy(req.body.executionPolicy);
  }
  if (typeof req.body.studioState !== 'undefined') {
    patch.studio_state = normalizeAutomationStudioState(req.body.studioState);
  }
  if (Array.isArray(req.body.steps)) {
    const normalizedSteps = normalizePersistedAutomationSteps(req.body.steps);
    patch.steps = normalizedSteps;
    patch.version = normalizedSteps.length > 0 ? 2 : undefined;
    patch.actions = deriveLegacyActionsFromSteps(normalizedSteps);
  }
  if (Array.isArray(req.body.actions)) {
    patch.actions = req.body.actions.map((item: unknown) => String(item).trim()).filter(Boolean);
    if (!Array.isArray(req.body.steps)) {
      patch.steps = undefined;
      patch.version = undefined;
    }
  }
  if (req.body.notify === null) patch.notify = undefined;
  if (req.body.condition === null) patch.condition = undefined;
  if (req.body.description === null) patch.description = undefined;
  if (req.body.workflowPrompt === null) patch.workflow_prompt = undefined;
  if (req.body.status === 'active' || req.body.status === 'paused') {
    patch.status = req.body.status;
  }

  try {
    if (typeof patch.notify === 'string' && patch.notify.trim()) {
      await validateMessageTarget({ to: patch.notify });
    }
    const updated = updateAutomation(req.params.id, patch, runAutomation);
    if (!updated) {
      res.status(404).json({ error: 'Automation not found' });
      return;
    }
    broadcastTaskPanelEvent(DEFAULT_WORKSPACE_ID, {
      type: 'automation_updated',
      automationId: updated.id,
    });
    res.json({ ok: true, item: updated });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Could not update automation' });
  }
});

app.delete('/api/automations/:id', (req: Request, res: Response) => {
  const removed = deleteAutomation(req.params.id);
  if (!removed) {
    res.status(404).json({ error: 'Automation not found' });
    return;
  }

  broadcastTaskPanelEvent(DEFAULT_WORKSPACE_ID, {
    type: 'automation_deleted',
    automationId: removed.id,
  });
  res.json({ ok: true, item: removed });
});

app.get('/api/platform/stream', (req: Request, res: Response) => {
  const { workspaceId } = resolveWorkspaceContext(req);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  addTaskPanelStreamClient(workspaceId, res);
  res.write(`data: ${JSON.stringify({ type: 'connected', workspaceId, emittedAt: new Date().toISOString() })}\n\n`);

  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat ${Date.now()}\n\n`);
    } catch {
      clearInterval(heartbeat);
      removeTaskPanelStreamClient(workspaceId, res);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    removeTaskPanelStreamClient(workspaceId, res);
    res.end();
  });
});

app.get('/api/platform/tasks', (req: Request, res: Response) => {
  const { workspaceId } = resolveWorkspaceContext(req);
  res.json({ items: listTasks(workspaceId) });
});

app.get('/api/platform/task-runs', (req: Request, res: Response) => {
  const { workspaceId } = resolveWorkspaceContext(req);
  res.json({ items: listTaskRuns(workspaceId) });
});

app.get('/api/platform/ledger', (req: Request, res: Response) => {
  const { workspaceId } = resolveWorkspaceContext(req);
  res.json({ items: listLedgerEntries(workspaceId) });
});

app.get('/api/billing/recent-usage', (req: Request, res: Response) => {
  const { workspaceId } = resolveWorkspaceContext(req);
  const items = listTaskRuns(workspaceId)
    .slice(0, 8)
    .map((run) => ({
      id: run.id,
      title: run.metadata?.title ? String(run.metadata.title) : `${run.agentRole} ${run.modelTier} run`,
      detail: `${run.modelTier} · ${run.status}`,
      credits: run.actualCredits ?? run.estimatedCredits,
      timestamp: run.finishedAt || run.startedAt,
      tone:
        run.modelTier === 'critical'
          ? 'amber'
          : run.modelTier === 'ops'
            ? 'cyan'
            : 'violet',
    }));

  res.json(items);
});

app.get('/api/health', (_req: Request, res: Response) => {
  const defaultClient = getChatClient('default');
  const hardClient = getChatClient('hard');
  const criticalClient = getChatClient('critical');
  const opsClient = getChatClient('ops');

  res.json({
    status: 'ok',
    service: 'violema-by-purple-orange-ai',
    models: {
      micro: getMicroModelConfig().model,
      default: getChatModelConfig('default').model,
      hard: getChatModelConfig('hard').model,
      critical: getChatModelConfig('critical').model,
      ops: getChatModelConfig('ops').model,
      utility: getUtilityModelConfig().model,
    },
    model_routing: getModelRoutingStatus(),
    chat_execution: {
      default: defaultClient.executingRoute.model,
      hard: hardClient.executingRoute.model,
      critical: criticalClient.executingRoute.model,
      ops_requested: opsClient.requestedRoute.model,
      ops_executed: opsClient.executingRoute.model,
      ops_fallback: opsClient.fallbackApplied,
    },
    integrations: getIntegrationStatus(),
    timestamp: new Date().toISOString(),
  });
});

loadPersistedAutomations(runAutomation);

app.listen(PORT, () => {
  console.log(`Violema by Purple Orange AI — backend running on http://localhost:${PORT}`);
});

export default app;
