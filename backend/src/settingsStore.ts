import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

type Provider = 'anthropic' | 'openai' | 'openrouter' | 'mistral' | 'minimax';
export type IntegrationProvider = 'github' | 'linear' | 'notion' | 'stripe' | 'hubspot' | 'airtable' | 'figma' | 'vercel';
type TextProfile = 'micro' | 'default' | 'hard' | 'critical' | 'ops';
type EmbeddingProfile = 'memory_text' | 'memory_code';

interface EncryptedSecret {
  iv: string;
  tag: string;
  value: string;
}

export interface WorkspaceModelOverride {
  provider?: Provider;
  model?: string;
  baseUrl?: string;
  reasoningEffort?: 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
}

export interface WorkspaceAgentStudioSettings {
  autoGraduationProfiles?: Record<string, string>;
  autoRollbackEnabled?: boolean;
  autoRollbackWeaknessThreshold?: number;
  autoRollbackMomentumThreshold?: number;
}

export interface WorkspaceSettingsRecord {
  workspaceId: string;
  updatedAt: string;
  providerTokens?: Partial<Record<Provider, EncryptedSecret>>;
  integrationCredentials?: Partial<Record<IntegrationProvider, Record<string, EncryptedSecret>>>;
  modelOverrides?: Partial<Record<TextProfile | EmbeddingProfile, WorkspaceModelOverride>>;
  agentStudio?: WorkspaceAgentStudioSettings;
}

export interface WorkspaceSettingsView {
  workspaceId: string;
  updatedAt?: string;
  providers: Record<Provider, {
    configured: boolean;
    maskedToken?: string;
    workspaceConfigured: boolean;
    serverConfigured: boolean;
    activeSource: 'workspace_token' | 'server_token' | 'none';
    activeSourceLabel: string;
  }>;
  integrations: Record<IntegrationProvider, {
    configured: boolean;
    workspaceConfigured: boolean;
    serverConfigured: boolean;
    activeSource: 'workspace_credentials' | 'server_credentials' | 'none';
    activeSourceLabel: string;
    fields: Record<string, {
      configured: boolean;
      workspaceConfigured: boolean;
      serverConfigured: boolean;
      maskedValue?: string;
    }>;
  }>;
  modelOverrides: Partial<Record<TextProfile | EmbeddingProfile, WorkspaceModelOverride>>;
  agentStudio?: WorkspaceAgentStudioSettings;
}

const SETTINGS_FILE = path.join(process.cwd(), 'workspace-settings.json');
const PROVIDERS: Provider[] = ['anthropic', 'openai', 'openrouter', 'mistral', 'minimax'];
const INTEGRATION_PROVIDERS: IntegrationProvider[] = ['github', 'linear', 'notion', 'stripe', 'hubspot', 'airtable', 'figma', 'vercel'];
const PROVIDER_ENV_KEYS: Record<Provider, string[]> = {
  anthropic: ['ANTHROPIC_API_KEY'],
  openai: ['OPENAI_API_KEY'],
  openrouter: ['OPENROUTER_API_KEY'],
  mistral: ['MISTRAL_API_KEY'],
  minimax: ['MINIMAX_API_KEY', 'ANTHROPIC_API_KEY'],
};
const INTEGRATION_FIELDS: Record<IntegrationProvider, string[]> = {
  github: ['token'],
  linear: ['apiKey'],
  notion: ['token'],
  stripe: ['secretKey'],
  hubspot: ['token'],
  airtable: ['token'],
  figma: ['token'],
  vercel: ['token'],
};
const INTEGRATION_ENV_KEYS: Record<IntegrationProvider, Record<string, string[]>> = {
  github: { token: ['GITHUB_TOKEN'] },
  linear: { apiKey: ['LINEAR_API_KEY'] },
  notion: { token: ['NOTION_API_KEY', 'NOTION_TOKEN'] },
  stripe: { secretKey: ['STRIPE_SECRET_KEY'] },
  hubspot: { token: ['HUBSPOT_ACCESS_TOKEN', 'HUBSPOT_PRIVATE_APP_TOKEN'] },
  airtable: { token: ['AIRTABLE_ACCESS_TOKEN', 'AIRTABLE_API_KEY'] },
  figma: { token: ['FIGMA_ACCESS_TOKEN'] },
  vercel: { token: ['VERCEL_TOKEN'] },
};

function readStore(): WorkspaceSettingsRecord[] {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return [];
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')) as WorkspaceSettingsRecord[];
  } catch {
    return [];
  }
}

function writeStore(records: WorkspaceSettingsRecord[]) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(records, null, 2));
}

function getSettingsSecret() {
  const secret =
    process.env.WORKSPACE_SETTINGS_SECRET?.trim() ||
    process.env.AUTH_STATE_SECRET?.trim() ||
    process.env.SLACK_SIGNING_SECRET?.trim();

  if (!secret) throw new Error('Missing WORKSPACE_SETTINGS_SECRET');
  return crypto.createHash('sha256').update(secret).digest();
}

function encryptSecret(value: string): EncryptedSecret {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getSettingsSecret(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return {
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    value: encrypted.toString('base64'),
  };
}

function decryptSecret(secret: EncryptedSecret): string {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getSettingsSecret(),
    Buffer.from(secret.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(secret.tag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(secret.value, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

function maskToken(token?: string) {
  if (!token) return undefined;
  if (token.length <= 8) return `${token.slice(0, 2)}••••`;
  return `${token.slice(0, 4)}••••${token.slice(-4)}`;
}

function getServerIntegrationCredential(provider: IntegrationProvider, field: string) {
  const envKeys = INTEGRATION_ENV_KEYS[provider]?.[field] || [];
  for (const key of envKeys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

export function getWorkspaceSettings(workspaceId: string): WorkspaceSettingsRecord | null {
  return readStore().find((record) => record.workspaceId === workspaceId) || null;
}

export function getWorkspaceSettingsView(workspaceId: string): WorkspaceSettingsView {
  const record = getWorkspaceSettings(workspaceId);
  return {
    workspaceId,
    updatedAt: record?.updatedAt,
    providers: Object.fromEntries(
      PROVIDERS.map((provider) => {
        const token = record?.providerTokens?.[provider];
        const decrypted = token ? decryptSecret(token) : undefined;
        const workspaceConfigured = Boolean(token);
        const serverConfigured = PROVIDER_ENV_KEYS[provider].some((key) => Boolean(process.env[key]?.trim()));
        const activeSource = workspaceConfigured ? 'workspace_token' : serverConfigured ? 'server_token' : 'none';
        return [provider, {
          configured: workspaceConfigured,
          maskedToken: maskToken(decrypted),
          workspaceConfigured,
          serverConfigured,
          activeSource,
          activeSourceLabel:
            activeSource === 'workspace_token'
              ? 'Workspace token'
              : activeSource === 'server_token'
                ? 'Server token'
                : 'Not configured',
        }];
      }),
    ) as WorkspaceSettingsView['providers'],
    integrations: Object.fromEntries(
      INTEGRATION_PROVIDERS.map((provider) => {
        const storedFields = record?.integrationCredentials?.[provider] || {};
        const fields = Object.fromEntries(
          INTEGRATION_FIELDS[provider].map((field) => {
            const encrypted = storedFields[field];
            const decrypted = encrypted ? decryptSecret(encrypted) : undefined;
            const workspaceConfigured = Boolean(encrypted);
            const serverConfigured = Boolean(getServerIntegrationCredential(provider, field));
            return [field, {
              configured: workspaceConfigured || serverConfigured,
              workspaceConfigured,
              serverConfigured,
              maskedValue: maskToken(decrypted),
            }];
          }),
        ) as WorkspaceSettingsView['integrations'][IntegrationProvider]['fields'];
        const workspaceConfigured = Object.values(fields).some((field) => field.workspaceConfigured);
        const serverConfigured = Object.values(fields).some((field) => field.serverConfigured);
        const activeSource = workspaceConfigured ? 'workspace_credentials' : serverConfigured ? 'server_credentials' : 'none';
        return [provider, {
          configured: workspaceConfigured || serverConfigured,
          workspaceConfigured,
          serverConfigured,
          activeSource,
          activeSourceLabel:
            activeSource === 'workspace_credentials'
              ? 'Workspace credentials'
              : activeSource === 'server_credentials'
                ? 'Server credentials'
                : 'Not configured',
          fields,
        }];
      }),
    ) as WorkspaceSettingsView['integrations'],
    modelOverrides: record?.modelOverrides || {},
    agentStudio: record?.agentStudio || {},
  };
}

export function getWorkspaceProviderToken(workspaceId: string, provider: Provider): string | undefined {
  const encrypted = getWorkspaceSettings(workspaceId)?.providerTokens?.[provider];
  if (!encrypted) return undefined;
  try {
    return decryptSecret(encrypted);
  } catch {
    return undefined;
  }
}

export function getWorkspaceIntegrationCredential(
  workspaceId: string,
  provider: IntegrationProvider,
  field: string,
): string | undefined {
  if (!INTEGRATION_FIELDS[provider]?.includes(field)) return undefined;
  const encrypted = getWorkspaceSettings(workspaceId)?.integrationCredentials?.[provider]?.[field];
  if (!encrypted) return undefined;
  try {
    return decryptSecret(encrypted);
  } catch {
    return undefined;
  }
}

export function getIntegrationCredential(
  workspaceId: string,
  provider: IntegrationProvider,
  field: string,
): string | undefined {
  return getWorkspaceIntegrationCredential(workspaceId, provider, field) || getServerIntegrationCredential(provider, field);
}

export function upsertWorkspaceSettings(input: {
  workspaceId: string;
  providerTokens?: Partial<Record<Provider, string | null>>;
  integrationCredentials?: Partial<Record<IntegrationProvider, Record<string, string> | null>>;
  modelOverrides?: Partial<Record<TextProfile | EmbeddingProfile, WorkspaceModelOverride | null>>;
  agentStudio?: {
    autoGraduationProfiles?: Record<string, string> | null;
    autoRollbackEnabled?: boolean | null;
    autoRollbackWeaknessThreshold?: number | null;
    autoRollbackMomentumThreshold?: number | null;
  };
}): WorkspaceSettingsView {
  const records = readStore();
  const existing = records.find((record) => record.workspaceId === input.workspaceId);
  const next: WorkspaceSettingsRecord = existing
    ? { ...existing }
    : {
        workspaceId: input.workspaceId,
        updatedAt: new Date().toISOString(),
        providerTokens: {},
        integrationCredentials: {},
        modelOverrides: {},
      };

  if (input.providerTokens) {
    const providerTokens = { ...(next.providerTokens || {}) };
    for (const provider of PROVIDERS) {
      if (!(provider in input.providerTokens)) continue;
      const token = input.providerTokens[provider];
      if (!token) {
        delete providerTokens[provider];
      } else {
        providerTokens[provider] = encryptSecret(token.trim());
      }
    }
    next.providerTokens = providerTokens;
  }

  if (input.integrationCredentials) {
    const integrationCredentials = { ...(next.integrationCredentials || {}) };
    for (const provider of INTEGRATION_PROVIDERS) {
      if (!(provider in input.integrationCredentials)) continue;
      const credentials = input.integrationCredentials[provider];
      if (!credentials) {
        delete integrationCredentials[provider];
        continue;
      }
      const allowedFields = INTEGRATION_FIELDS[provider];
      const existingFields = { ...(integrationCredentials[provider] || {}) };
      for (const field of allowedFields) {
        if (!(field in credentials)) continue;
        const value = credentials[field]?.trim();
        if (!value) {
          delete existingFields[field];
        } else {
          existingFields[field] = encryptSecret(value);
        }
      }
      if (Object.keys(existingFields).length > 0) {
        integrationCredentials[provider] = existingFields;
      } else {
        delete integrationCredentials[provider];
      }
    }
    next.integrationCredentials = integrationCredentials;
  }

  if (input.modelOverrides) {
    const modelOverrides = { ...(next.modelOverrides || {}) };
    for (const [profile, override] of Object.entries(input.modelOverrides)) {
      if (!override) {
        delete modelOverrides[profile as TextProfile | EmbeddingProfile];
        continue;
      }
      modelOverrides[profile as TextProfile | EmbeddingProfile] = {
        provider: override.provider,
        model: override.model?.trim() || undefined,
        baseUrl: override.baseUrl?.trim() || undefined,
        reasoningEffort: override.reasoningEffort,
      };
    }
    next.modelOverrides = modelOverrides;
  }

  if (input.agentStudio) {
    const current = { ...(next.agentStudio || {}) };
    if ('autoGraduationProfiles' in input.agentStudio) {
      const incoming = input.agentStudio.autoGraduationProfiles;
      current.autoGraduationProfiles = incoming
        ? Object.entries(incoming).reduce<Record<string, string>>((acc, [archetypeId, profileId]) => {
            if (!archetypeId || !profileId) return acc;
            acc[archetypeId] = profileId;
            return acc;
          }, {})
        : undefined;
    }
    if ('autoRollbackEnabled' in input.agentStudio) {
      current.autoRollbackEnabled = input.agentStudio.autoRollbackEnabled === true ? true : undefined;
    }
    if ('autoRollbackWeaknessThreshold' in input.agentStudio) {
      current.autoRollbackWeaknessThreshold =
        typeof input.agentStudio.autoRollbackWeaknessThreshold === 'number'
          ? Math.max(4, Math.min(30, Math.round(input.agentStudio.autoRollbackWeaknessThreshold)))
          : undefined;
    }
    if ('autoRollbackMomentumThreshold' in input.agentStudio) {
      current.autoRollbackMomentumThreshold =
        typeof input.agentStudio.autoRollbackMomentumThreshold === 'number'
          ? Math.max(2, Math.min(20, Math.round(input.agentStudio.autoRollbackMomentumThreshold)))
          : undefined;
    }
    next.agentStudio = current;
  }

  next.updatedAt = new Date().toISOString();

  const index = records.findIndex((record) => record.workspaceId === input.workspaceId);
  if (index >= 0) records[index] = next;
  else records.push(next);
  writeStore(records);
  return getWorkspaceSettingsView(input.workspaceId);
}
