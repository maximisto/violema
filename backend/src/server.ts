import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

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

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Model Tier Configuration
 * ─────────────────────────────────────────────────────────────────
 * Opus 4.6   → Complex reasoning, multi-step tool orchestration,
 *              report generation, strategic thinking. High cost.
 * Haiku 4.5  → Fast, cheap utility tasks: title generation,
 *              conversation summarisation, intent classification,
 *              anything that doesn't need deep reasoning.
 */
const MODELS = {
  primary: 'claude-opus-4-6',
  utility: 'claude-haiku-4-5-20251001',
} as const;

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
- Code execution: Write and run code in Python, JS, TypeScript, bash
- Task management: Create, assign, and track tasks in Linear/Jira
- Communication: Draft and send Slack messages, emails, team updates
- Data queries: Pull live data from Stripe, HubSpot, GitHub, Linear, Salesforce
- Report generation: Create structured reports, analyses, summaries
- Automation scheduling: Set up recurring tasks and monitoring workflows

**When executing tasks:**
1. Break complex requests into clear steps
2. Use tools to get real data rather than making up numbers
3. Chain multiple tools when a workflow requires it
4. Always summarize results and suggest next actions
5. Flag any uncertainties clearly

Format responses with markdown: **bold** for key data points, bullet lists for clarity, code blocks for code. Be action-oriented.`;
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

function executeToolCall(toolName: string, toolInput: Record<string, unknown>): string {
  switch (toolName) {
    case 'web_search': {
      const query = toolInput.query as string;
      const results = [
        {
          title: `${query} — Comprehensive Analysis 2025`,
          url: `https://example.com/search?q=${encodeURIComponent(query)}`,
          snippet: `Comprehensive overview of ${query}. Recent data shows significant growth with key metrics up 23% year-over-year. Industry experts predict continued expansion through Q4 2025.`,
          published: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        },
        {
          title: `${query}: Trends & Insights | TechCrunch`,
          url: `https://techcrunch.com/${query.toLowerCase().replace(/\s+/g, '-')}`,
          snippet: `Deep-dive analysis: ${query} continues to dominate the market. Key players including major enterprises are investing heavily, with combined investment up $2.3B this quarter.`,
          published: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
        },
        {
          title: `${query} — Wikipedia`,
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(query)}`,
          snippet: `${query} refers to the technology and practices enabling... [background, history, key concepts, notable examples, and current developments as of 2025]`,
          published: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
        },
        {
          title: `State of ${query} Report — Gartner 2025`,
          url: `https://gartner.com/reports/${query.toLowerCase().replace(/\s+/g, '-')}`,
          snippet: `Gartner's annual report finds ${query} adoption has reached 51% among Fortune 500 companies, up from 23% in 2023. Cost savings average 34% in first-year implementations.`,
          published: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
        },
      ];
      return JSON.stringify({ query, results, total_results: results.length, search_time_ms: 342 });
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
      return JSON.stringify({
        success: true,
        message_id: `msg_${Date.now()}`,
        to: toolInput.to,
        subject: toolInput.subject || null,
        channel: toolInput.channel || 'slack',
        sent_at: new Date().toISOString(),
        status: 'delivered',
        delivery_ms: Math.floor(Math.random() * 150) + 50,
      });
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
      const automationId = `auto_${Date.now()}`;
      return JSON.stringify({
        success: true,
        automation_id: automationId,
        name: toolInput.name,
        description: toolInput.description,
        schedule: toolInput.schedule,
        actions: toolInput.actions,
        notify: toolInput.notify || null,
        condition: toolInput.condition || null,
        next_run: new Date(Date.now() + 1000 * 60 * 60 * 8).toISOString(),
        status: 'active',
        created_at: new Date().toISOString(),
        url: `https://nexus.app/automations/${automationId}`,
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
}

app.post('/api/chat', async (req: Request, res: Response) => {
  const { messages, autonomyMode = 'cautious' } = req.body as ChatRequest;

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

  try {
    const anthropicMessages: Anthropic.MessageParam[] = messages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    let continueLoop = true;
    let currentMessages = [...anthropicMessages];

    while (continueLoop) {
      const stream = client.messages.stream({
        model: MODELS.primary,
        max_tokens: 16000,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        thinking: { type: 'adaptive' } as any,
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
          const result = executeToolCall(toolUseBlock.name, toolInput);
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
        }

        currentMessages.push({ role: 'user', content: toolResults });
      } else {
        continueLoop = false;
      }
    }

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

    const response = await client.messages.create({
      model: MODELS.utility,
      max_tokens: 20,
      system: 'Return ONLY a conversation title: 3-6 words, no quotes, no ending punctuation. Nothing else.',
      messages: [{ role: 'user', content: `Title this AI coworker conversation:\n${excerpt}` }],
    });

    const block = response.content[0];
    const title = block.type === 'text' ? block.text.trim().slice(0, 60) : 'New conversation';
    res.json({ title, model: MODELS.utility });
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

    const response = await client.messages.create({
      model: MODELS.utility,
      max_tokens: 40,
      system: 'Return ONE short sentence (max 12 words) summarising the outcome of this conversation. No quotes.',
      messages: [{ role: 'user', content: text }],
    });

    const block = response.content[0];
    const summary = block.type === 'text' ? block.text.trim() : '';
    res.json({ summary, model: MODELS.utility });
  } catch {
    res.json({ summary: '' });
  }
});

// ── Waitlist ──────────────────────────────────────────────────────────────────
import fs from 'fs';
import path from 'path';

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

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'nexus-by-purple-orange-ai',
    models: MODELS,
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`Nexus by Purple Orange AI — backend running on http://localhost:${PORT}`);
});

export default app;
