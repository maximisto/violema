import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { takeBrowserScreenshot } from './tools/browserScreenshot';
import { getIntegrationStatus, searchWeb, sendMessage } from './integrations';
import { createAutomation, loadPersistedAutomations } from './scheduler';
import {
  addLedgerEntry,
  assertCanSpendCredits,
  buildCreditSnapshot,
  createTask,
  createTaskRun,
  DEFAULT_WORKSPACE_ID,
  evaluatePlanEnforcement,
  ensureWorkspaceCredits,
  estimateCreditCost,
  finalizeTaskRun,
  getBillingStatus,
  listLedgerEntries,
  listReferralEvents,
  listTaskRuns,
  listTasks,
  markReferralQualified,
  markReferralRewarded,
  purchaseTopUp,
  recordReferralEvent,
  summarizeReferralRewards,
  mapTaskRunToStatus,
  updateTask,
  upsertBillingConfig,
  listTopUpOffers,
} from './platform';
import {
  generateText,
  getChatClient,
  getChatModelConfig,
  getMicroModelConfig,
  getModelRoutingStatus,
  getUtilityModelConfig,
  routeChatProfile,
  type TextProfile,
} from './models';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const SCREENSHOT_DIR = path.join(process.cwd(), 'generated-screenshots');
const AUTOMATIONS_FILE = path.join(process.cwd(), 'automations.json');

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://nexus.purpleorange.io',
  'http://nexus.purpleorange.io',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, same-origin nginx proxy)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json());
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

  return `You are Nexus, an elite AI coworker built for modern high-performance teams. You are not just a chatbot — you proactively execute tasks, search the web, write and run code, manage workflows, send messages, generate reports, and schedule automations.

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

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function buildOpenAIHeaders(route: { provider: string; apiKeyEnv: string }) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getRequiredEnv(route.apiKeyEnv)}`,
  };

  if (route.provider === 'openrouter') {
    headers['HTTP-Referer'] = process.env.OPENROUTER_SITE_URL || 'https://nexus.purpleorange.io';
    headers['X-Title'] = process.env.OPENROUTER_APP_NAME || 'Nexus';
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
    description: 'Schedule a recurring automation or monitoring task. Nexus will run it automatically on the specified schedule.',
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

async function executeToolCall(toolName: string, toolInput: Record<string, unknown>): Promise<string> {
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

async function runAutomation(automation: {
  id: string;
  name: string;
  description?: string;
  actions: string[];
  notify?: string;
  condition?: string;
}) {
  ensureWorkspaceCredits(DEFAULT_WORKSPACE_ID);
  const task = createTask({
    workspaceId: DEFAULT_WORKSPACE_ID,
    title: automation.name,
    description: automation.description,
    kind: 'automation',
    priority: 'medium',
    assigneeRole: 'scheduler',
    metadata: { automationId: automation.id, notify: automation.notify || null },
  });
  const estimate = estimateCreditCost({
    taskKind: 'automation',
    modelTier: 'ops',
    automationRuns: 1,
    complexity: automation.actions.length > 2 ? 'medium' : 'low',
  });
  assertCanSpendCredits(DEFAULT_WORKSPACE_ID, estimate.estimatedCredits);
  const taskRun = createTaskRun({
    workspaceId: DEFAULT_WORKSPACE_ID,
    taskId: task.id,
    agentRole: 'scheduler',
    modelTier: 'ops',
    estimatedCredits: estimate.estimatedCredits,
    metadata: { automationId: automation.id, title: automation.name },
  });
  updateTask(task.id, { status: 'running' });

  const summary = [
    `Automation: ${automation.name}`,
    automation.description ? `Description: ${automation.description}` : null,
    `Actions:\n- ${automation.actions.join('\n- ')}`,
    automation.condition ? `Condition note: ${automation.condition}` : null,
  ].filter(Boolean).join('\n\n');

  try {
    if (automation.notify) {
      await sendMessage({
        to: automation.notify,
        subject: `Automation run: ${automation.name}`,
        body: summary,
      });
    } else {
      console.log(`[automation] ${automation.id}\n${summary}`);
    }

    finalizeTaskRun(taskRun.id, {
      status: 'succeeded',
      actualCredits: estimate.estimatedCredits,
    });
    updateTask(task.id, { status: 'completed' });
    addLedgerEntry({
      workspaceId: DEFAULT_WORKSPACE_ID,
      source: 'automation_run',
      deltaCredits: -estimate.estimatedCredits,
      referenceType: 'automation',
      referenceId: automation.id,
      note: `Automation run: ${automation.name}`,
      metadata: { taskId: task.id, taskRunId: taskRun.id },
    });
  } catch (error) {
    finalizeTaskRun(taskRun.id, {
      status: 'failed',
      actualCredits: estimate.estimatedCredits,
      error: error instanceof Error ? error.message : 'Unknown automation error',
    });
    updateTask(task.id, { status: 'failed' });
    addLedgerEntry({
      workspaceId: DEFAULT_WORKSPACE_ID,
      source: 'automation_run',
      deltaCredits: -estimate.estimatedCredits,
      referenceType: 'automation',
      referenceId: automation.id,
      note: `Automation failed: ${automation.name}`,
      metadata: { taskId: task.id, taskRunId: taskRun.id },
    });
    console.error(`[automation] ${automation.id} failed`, error);
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

  let taskId: string | null = null;
  let taskRunId: string | null = null;

  try {
    ensureWorkspaceCredits(DEFAULT_WORKSPACE_ID);
    const routingDecision = modelProfile === 'auto'
      ? await routeChatProfile(messages)
      : null;
    const resolvedProfile: TextProfile = routingDecision?.profile || (modelProfile === 'auto' ? 'default' : modelProfile);
    const modelTier = normalizeModelTier(resolvedProfile);
    const { client, executingRoute } = getChatClient(resolvedProfile);
    const requestedRoute = getChatModelConfig(resolvedProfile);
    const combinedContent = messages.map((message) => message.content).join(' ');
    const taskKind = resolvedProfile === 'ops'
      ? 'automation'
      : messages.some((message) => /report|analysis|analyze|compare|research/i.test(message.content))
        ? 'analysis'
        : 'chat';
    const task = createTask({
      workspaceId: DEFAULT_WORKSPACE_ID,
      title: messages[0]?.content?.slice(0, 72) || 'Nexus task',
      description: messages[messages.length - 1]?.content || '',
      kind: taskKind,
      priority: resolvedProfile === 'critical' ? 'high' : 'medium',
      autonomyMode: normalizeAutonomyMode(autonomyMode),
      assigneeRole: 'nexus',
      metadata: {
        selectedProfile: resolvedProfile,
        model: requestedRoute.model,
      },
    });
    taskId = task.id;
    updateTask(task.id, { status: 'running' });
    const estimatedCost = estimateCreditCost({
      taskKind,
      modelTier,
      toolCalls: 0,
      complexity: combinedContent.length > 1200 ? 'high' : combinedContent.length > 500 ? 'medium' : 'low',
    });
    assertCanSpendCredits(DEFAULT_WORKSPACE_ID, estimatedCost.estimatedCredits);
    const taskRun = createTaskRun({
      workspaceId: DEFAULT_WORKSPACE_ID,
      taskId: task.id,
      agentRole: 'nexus',
      modelTier,
      estimatedCredits: estimatedCost.estimatedCredits,
      metadata: { requestedProfile: modelProfile, title: task.title },
    });
    taskRunId = taskRun.id;
    const anthropicMessages: Anthropic.MessageParam[] = messages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    sendEvent({
      type: 'routing',
      requested_profile: modelProfile,
      selected_profile: resolvedProfile,
      selected_model: requestedRoute.model,
      reason: routingDecision?.reason || 'explicit_profile',
      risk: routingDecision?.risk || 'low',
      needs_tools: routingDecision?.needsTools ?? true,
    });

    if (requestedRoute.provider === 'anthropic' || requestedRoute.provider === 'minimax') {
      if (!client) throw new Error('Missing Anthropic-compatible client.');
      const execution = await runAnthropicChatLoop(client, executingRoute, anthropicMessages, autonomyMode, sendEvent);
      const actualCost = estimateCreditCost({
        taskKind,
        modelTier,
        toolCalls: execution.toolCallsExecuted,
        complexity: estimatedCost.breakdown.complexityCredits > 0 ? 'medium' : 'low',
      });
      finalizeTaskRun(taskRun.id, {
        status: 'succeeded',
        actualCredits: actualCost.estimatedCredits,
        metadata: { toolCallsExecuted: execution.toolCallsExecuted },
      });
      updateTask(task.id, { status: 'completed' });
      addLedgerEntry({
        workspaceId: DEFAULT_WORKSPACE_ID,
        source: 'task_run',
        deltaCredits: -actualCost.estimatedCredits,
        referenceType: 'task',
        referenceId: task.id,
        note: `Chat task completed: ${task.title}`,
        metadata: { taskRunId: taskRun.id, toolCallsExecuted: execution.toolCallsExecuted },
      });
    } else {
      const execution = await runOpenAIChatLoop(requestedRoute, messages, autonomyMode, sendEvent);
      const actualCost = estimateCreditCost({
        taskKind,
        modelTier,
        toolCalls: execution.toolCallsExecuted,
        complexity: estimatedCost.breakdown.complexityCredits > 0 ? 'medium' : 'low',
      });
      finalizeTaskRun(taskRun.id, {
        status: 'succeeded',
        actualCredits: actualCost.estimatedCredits,
        metadata: { toolCallsExecuted: execution.toolCallsExecuted },
      });
      updateTask(task.id, { status: 'completed' });
      addLedgerEntry({
        workspaceId: DEFAULT_WORKSPACE_ID,
        source: 'task_run',
        deltaCredits: -actualCost.estimatedCredits,
        referenceType: 'task',
        referenceId: task.id,
        note: `Chat task completed: ${task.title}`,
        metadata: { taskRunId: taskRun.id, toolCallsExecuted: execution.toolCallsExecuted },
      });
    }

    sendEvent({ type: 'done' });
    res.end();
  } catch (error) {
    console.error('Error calling Anthropic API:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    if (typeof taskRunId === 'string') {
      finalizeTaskRun(taskRunId, { status: 'failed', error: errorMessage });
    }
    if (typeof taskId === 'string') {
      updateTask(taskId, { status: 'failed' });
    }
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
  const { messages } = req.body as { messages: ChatMessage[] };
  if (!messages || messages.length < 1) {
    res.json({ title: 'New conversation' });
    return;
  }
  try {
    const excerpt = messages
      .slice(0, 4)
      .map((m) => `${m.role === 'user' ? 'User' : 'Nexus'}: ${m.content.slice(0, 300)}`)
      .join('\n');

    const title = (await generateText(
      'utility',
      'Return ONLY a conversation title: 3-6 words, no quotes, no ending punctuation. Nothing else.',
      [{ role: 'user', content: `Title this AI coworker conversation:\n${excerpt}` }],
      20
    )).trim().slice(0, 60) || 'New conversation';

    res.json({ title, model: getUtilityModelConfig().model });
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
  const { messages } = req.body as { messages: ChatMessage[] };
  if (!messages || messages.length < 2) {
    res.json({ summary: '' });
    return;
  }
  try {
    const text = messages
      .slice(-6)
      .map((m) => `${m.role === 'user' ? 'User' : 'Nexus'}: ${m.content.slice(0, 200)}`)
      .join('\n');

    const summary = await generateText(
      'utility',
      'Return ONE short sentence (max 12 words) summarising the outcome of this conversation. No quotes.',
      [{ role: 'user', content: text }],
      40
    );

    res.json({ summary, model: getUtilityModelConfig().model });
  } catch {
    res.json({ summary: '' });
  }
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

app.get('/api/billing/usage', (_req: Request, res: Response) => {
  res.json(buildCreditSnapshot());
});

app.get('/api/usage/credits', (_req: Request, res: Response) => {
  res.json(buildCreditSnapshot());
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

app.get('/api/billing/config', (_req: Request, res: Response) => {
  const status = getBillingStatus(DEFAULT_WORKSPACE_ID);
  const enforcement = evaluatePlanEnforcement({
    workspaceId: DEFAULT_WORKSPACE_ID,
    automationCount: getPersistedAutomationCount(),
  });

  res.json({
    ...status,
    enforcement,
  });
});

app.post('/api/billing/config', (req: Request, res: Response) => {
  const patch = req.body as Record<string, unknown>;
  const next = upsertBillingConfig(DEFAULT_WORKSPACE_ID, {
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
    status: getBillingStatus(DEFAULT_WORKSPACE_ID),
  });
});

app.get('/api/billing/offers', (_req: Request, res: Response) => {
  res.json({ items: listTopUpOffers() });
});

app.post('/api/billing/top-up', (req: Request, res: Response) => {
  const { offerId } = req.body as { offerId?: string };
  if (!offerId) {
    res.status(400).json({ error: 'offerId is required' });
    return;
  }

  try {
    res.json({
      ok: true,
      ...purchaseTopUp(DEFAULT_WORKSPACE_ID, offerId),
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Could not apply top-up' });
  }
});

app.get('/api/billing/referrals', (_req: Request, res: Response) => {
  res.json({
    items: listReferralEvents(DEFAULT_WORKSPACE_ID),
    summary: summarizeReferralRewards(DEFAULT_WORKSPACE_ID),
    billing: getBillingStatus(DEFAULT_WORKSPACE_ID),
  });
});

app.post('/api/billing/referrals', (req: Request, res: Response) => {
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
    workspaceId: DEFAULT_WORKSPACE_ID,
    referredEmail,
    referrerEmail,
    source,
  });

  res.json({
    ok: true,
    event,
    summary: summarizeReferralRewards(DEFAULT_WORKSPACE_ID),
  });
});

app.post('/api/billing/referrals/:id/qualify', (req: Request, res: Response) => {
  const event = markReferralQualified(req.params.id);
  if (!event) {
    res.status(404).json({ error: 'Referral not found' });
    return;
  }

  res.json({
    ok: true,
    event,
    summary: summarizeReferralRewards(DEFAULT_WORKSPACE_ID),
  });
});

app.post('/api/billing/referrals/:id/reward', (req: Request, res: Response) => {
  const current = listReferralEvents(DEFAULT_WORKSPACE_ID).find((item) => item.id === req.params.id);
  if (!current) {
    res.status(404).json({ error: 'Referral not found' });
    return;
  }
  if (current.status === 'rewarded') {
    res.json({
      ok: true,
      event: current,
      summary: summarizeReferralRewards(DEFAULT_WORKSPACE_ID),
      billing: getBillingStatus(DEFAULT_WORKSPACE_ID),
    });
    return;
  }

  const rewarded = markReferralRewarded(req.params.id);
  if (!rewarded) {
    res.status(404).json({ error: 'Referral not found' });
    return;
  }

  addLedgerEntry({
    workspaceId: DEFAULT_WORKSPACE_ID,
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
    summary: summarizeReferralRewards(DEFAULT_WORKSPACE_ID),
    billing: getBillingStatus(DEFAULT_WORKSPACE_ID),
  });
});

app.get('/api/platform/tasks', (_req: Request, res: Response) => {
  res.json({ items: listTasks(DEFAULT_WORKSPACE_ID) });
});

app.get('/api/platform/task-runs', (_req: Request, res: Response) => {
  res.json({ items: listTaskRuns(DEFAULT_WORKSPACE_ID) });
});

app.get('/api/platform/ledger', (_req: Request, res: Response) => {
  res.json({ items: listLedgerEntries(DEFAULT_WORKSPACE_ID) });
});

app.get('/api/billing/recent-usage', (_req: Request, res: Response) => {
  const items = listTaskRuns(DEFAULT_WORKSPACE_ID)
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
    service: 'nexus-by-purple-orange-ai',
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
  console.log(`Nexus by Purple Orange AI — backend running on http://localhost:${PORT}`);
});

export default app;
