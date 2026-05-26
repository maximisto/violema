import type { Express, Request } from 'express';
import {
  getIntegrationFields,
  INTEGRATION_PROVIDERS,
  isIntegrationProvider,
  type IntegrationProvider,
} from '../integrationRegistry';

type Provider = 'anthropic' | 'openai' | 'openrouter' | 'mistral' | 'minimax';
type Profile = 'micro' | 'default' | 'hard' | 'critical' | 'ops' | 'memory_text' | 'memory_code';
type ReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

const ALLOWED_INTEGRATIONS = new Set<IntegrationProvider>(INTEGRATION_PROVIDERS);
const ALLOWED_INTEGRATION_FIELDS = Object.fromEntries(
  INTEGRATION_PROVIDERS.map((provider) => [provider, new Set(getIntegrationFields(provider))]),
) as Record<IntegrationProvider, Set<string>>;

interface WorkspaceContext {
  workspaceId: string;
}

interface SettingsRoutesDeps {
  resolveWorkspaceContext(req: Request): WorkspaceContext;
  getWorkspaceSettingsView(workspaceId: string): unknown;
  getModelRoutingStatus(workspaceId: string): unknown;
  upsertWorkspaceSettings(input: {
    workspaceId: string;
    providerTokens?: Record<string, string | null>;
    integrationCredentials?: Record<string, Record<string, string> | null>;
    modelOverrides?: Record<string, { provider?: string; model?: string; baseUrl?: string; reasoningEffort?: ReasoningEffort } | null>;
    agentStudio?: {
      autoGraduationProfiles?: Record<string, string> | null;
      autoRollbackEnabled?: boolean | null;
      autoRollbackWeaknessThreshold?: number | null;
      autoRollbackMomentumThreshold?: number | null;
    };
  }): unknown;
  testProviderConnection(input: { workspaceId: string; provider: Provider; tokenOverride?: string }): Promise<unknown>;
  testIntegrationConnection(input: { workspaceId: string; provider: IntegrationProvider; credentials?: Record<string, string> }): Promise<unknown>;
  testModelProfileConnection(input: { workspaceId: string; profile: Profile }): Promise<unknown>;
}

export function registerAgentStudioSettingsRoutes(app: Express, deps: SettingsRoutesDeps) {
  app.get('/api/settings', (req, res) => {
    const { workspaceId } = deps.resolveWorkspaceContext(req);
    res.json({
      workspaceId,
      settings: deps.getWorkspaceSettingsView(workspaceId),
      modelRouting: deps.getModelRoutingStatus(workspaceId),
    });
  });

  app.patch('/api/settings', (req, res) => {
    const { workspaceId } = deps.resolveWorkspaceContext(req);
    const body = (req.body || {}) as {
      providerTokens?: Record<string, string | null>;
      integrationCredentials?: Record<string, Record<string, string | null> | null>;
      modelOverrides?: Record<string, { provider?: string; model?: string; baseUrl?: string; reasoningEffort?: string } | null>;
      agentStudio?: {
        autoGraduationProfiles?: Record<string, string | null> | null;
        autoRollbackEnabled?: boolean | null;
        autoRollbackWeaknessThreshold?: number | null;
        autoRollbackMomentumThreshold?: number | null;
      };
    };

    const allowedProviders = new Set<Provider>(['anthropic', 'openai', 'openrouter', 'mistral', 'minimax']);
    const allowedProfiles = new Set<Profile>(['micro', 'default', 'hard', 'critical', 'ops', 'memory_text', 'memory_code']);
    const allowedReasoning = new Set<ReasoningEffort>(['none', 'minimal', 'low', 'medium', 'high', 'xhigh']);

    const providerTokens = body.providerTokens
      ? Object.fromEntries(
          Object.entries(body.providerTokens)
            .filter(([provider]) => allowedProviders.has(provider as Provider))
            .map(([provider, token]) => [provider, typeof token === 'string' ? token.trim() : null]),
        )
      : undefined;

    const integrationCredentials = body.integrationCredentials
      ? Object.fromEntries(
          Object.entries(body.integrationCredentials)
            .filter(([provider]) => isIntegrationProvider(provider))
            .map(([provider, credentials]) => {
              if (!credentials) return [provider, null];
              const providerKey = provider as IntegrationProvider;
              return [provider, Object.fromEntries(
                Object.entries(credentials)
                  .filter(([field]) => ALLOWED_INTEGRATION_FIELDS[providerKey].has(field))
                  .map(([field, value]) => [field, typeof value === 'string' ? value.trim() : '']),
              )];
            }),
        )
      : undefined;

    const modelOverrides = body.modelOverrides
      ? Object.fromEntries(
          Object.entries(body.modelOverrides)
            .filter(([profile]) => allowedProfiles.has(profile as Profile))
            .map(([profile, override]) => {
              if (!override) return [profile, null];
              const provider = typeof override.provider === 'string' && allowedProviders.has(override.provider as Provider)
                ? override.provider as Provider
                : undefined;
              const reasoningEffort = typeof override.reasoningEffort === 'string' && allowedReasoning.has(override.reasoningEffort as ReasoningEffort)
                ? override.reasoningEffort as ReasoningEffort
                : undefined;
              return [profile, {
                provider,
                model: typeof override.model === 'string' ? override.model.trim() : undefined,
                baseUrl: typeof override.baseUrl === 'string' ? override.baseUrl.trim() : undefined,
                reasoningEffort,
              }];
            }),
        )
      : undefined;

    const agentStudio = body.agentStudio
      ? {
          autoGraduationProfiles: body.agentStudio.autoGraduationProfiles
            ? Object.fromEntries(
                Object.entries(body.agentStudio.autoGraduationProfiles)
                  .filter(([archetypeId, profileId]) => typeof archetypeId === 'string' && typeof profileId === 'string' && profileId.trim().length > 0)
                  .map(([archetypeId, profileId]) => [archetypeId, profileId!.trim()]),
              )
            : body.agentStudio.autoGraduationProfiles === null
              ? null
              : undefined,
          autoRollbackEnabled: body.agentStudio.autoRollbackEnabled === true ? true : body.agentStudio.autoRollbackEnabled === null ? null : undefined,
          autoRollbackWeaknessThreshold: typeof body.agentStudio.autoRollbackWeaknessThreshold === 'number'
            ? body.agentStudio.autoRollbackWeaknessThreshold
            : body.agentStudio.autoRollbackWeaknessThreshold === null
              ? null
              : undefined,
          autoRollbackMomentumThreshold: typeof body.agentStudio.autoRollbackMomentumThreshold === 'number'
            ? body.agentStudio.autoRollbackMomentumThreshold
            : body.agentStudio.autoRollbackMomentumThreshold === null
              ? null
              : undefined,
        }
      : undefined;

    const settings = deps.upsertWorkspaceSettings({
      workspaceId,
      providerTokens,
      integrationCredentials,
      modelOverrides,
      agentStudio,
    });

    res.json({
      workspaceId,
      settings,
      modelRouting: deps.getModelRoutingStatus(workspaceId),
    });
  });

  app.post('/api/settings/test-provider', async (req, res) => {
    const { workspaceId } = deps.resolveWorkspaceContext(req);
    const body = (req.body || {}) as { provider?: string; token?: string };
    const provider = body.provider as Provider | undefined;
    if (provider !== 'anthropic' && provider !== 'openai' && provider !== 'openrouter' && provider !== 'mistral' && provider !== 'minimax') {
      res.status(400).json({ error: 'Unsupported provider' });
      return;
    }

    try {
      const result = await deps.testProviderConnection({
        workspaceId,
        provider,
        tokenOverride: typeof body.token === 'string' ? body.token : undefined,
      });
      res.json(result);
    } catch (error) {
      res.status(400).json({
        ok: false,
        provider,
        detail: error instanceof Error ? error.message : 'Provider test failed',
      });
    }
  });

  app.post('/api/settings/test-integration', async (req, res) => {
    const { workspaceId } = deps.resolveWorkspaceContext(req);
    const body = (req.body || {}) as { provider?: string; credentials?: Record<string, string> };
    const provider = body.provider as IntegrationProvider | undefined;
    if (!provider || !ALLOWED_INTEGRATIONS.has(provider)) {
      res.status(400).json({ error: 'Unsupported integration provider' });
      return;
    }

    try {
      const result = await deps.testIntegrationConnection({
        workspaceId,
        provider,
        credentials: body.credentials,
      });
      res.json(result);
    } catch (error) {
      res.status(400).json({
        ok: false,
        provider,
        detail: error instanceof Error ? error.message : 'Integration test failed.',
      });
    }
  });

  app.post('/api/settings/test-profile', async (req, res) => {
    const { workspaceId } = deps.resolveWorkspaceContext(req);
    const body = (req.body || {}) as { profile?: string };
    const profile = body.profile as Profile | undefined;
    if (
      profile !== 'micro' &&
      profile !== 'default' &&
      profile !== 'hard' &&
      profile !== 'critical' &&
      profile !== 'ops' &&
      profile !== 'memory_text' &&
      profile !== 'memory_code'
    ) {
      res.status(400).json({ error: 'Unsupported profile' });
      return;
    }

    try {
      const result = await deps.testModelProfileConnection({ workspaceId, profile });
      res.json(result);
    } catch (error) {
      res.status(400).json({
        ok: false,
        profile,
        detail: error instanceof Error ? error.message : 'Profile test failed.',
      });
    }
  });
}
