import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
}));
app.use(express.json());

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const NEXUS_SYSTEM_PROMPT = `You are Nexus, an elite AI coworker built for modern teams. You are not just a chatbot — you proactively execute tasks, search the web for real-time information, write and run code, manage workflows, send messages, and get things done autonomously.

Your personality:
- Professional, efficient, and results-oriented
- Proactive: you anticipate next steps and suggest actions
- Concise but thorough: you show your work without being verbose
- You speak like a senior operator who gets things done

Your capabilities:
- Web research: You can search the web for current information, news, data
- Code execution: You can write and run code in multiple languages
- Task management: You create and track tasks, todos, and projects
- Communication: You can draft and send messages, emails, Slack messages
- Data analysis: You pull data from connected tools (Stripe, HubSpot, etc.)
- Workflow automation: You chain multiple actions together

When executing tasks:
1. Break them into clear steps
2. Use the available tools to accomplish each step
3. Summarize what you did and the results
4. Suggest follow-up actions

Always be action-oriented. When someone asks you to do something, do it — don't just explain how to do it.

Format your responses with clear structure using markdown. Use **bold** for important items, bullet points for lists, and code blocks for code.`;

const NEXUS_TOOLS: Anthropic.Tool[] = [
  {
    name: 'web_search',
    description: 'Search the web for current information, news, data, or any topic. Use this when you need up-to-date information.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'The search query to look up',
        },
        num_results: {
          type: 'number',
          description: 'Number of results to return (default: 5)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'run_code',
    description: 'Execute code in a specified programming language and return the output. Supports Python, JavaScript, TypeScript, and more.',
    input_schema: {
      type: 'object' as const,
      properties: {
        language: {
          type: 'string',
          description: 'Programming language (python, javascript, typescript, bash)',
        },
        code: {
          type: 'string',
          description: 'The code to execute',
        },
      },
      required: ['language', 'code'],
    },
  },
  {
    name: 'create_task',
    description: 'Create a new task or todo item in the task management system.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: {
          type: 'string',
          description: 'The task title',
        },
        description: {
          type: 'string',
          description: 'Detailed description of the task',
        },
        due_date: {
          type: 'string',
          description: 'Due date in ISO format (optional)',
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'urgent'],
          description: 'Task priority level',
        },
        assignee: {
          type: 'string',
          description: 'Person to assign the task to (optional)',
        },
      },
      required: ['title', 'description'],
    },
  },
  {
    name: 'send_message',
    description: 'Send a message via Slack, email, or other connected communication channels.',
    input_schema: {
      type: 'object' as const,
      properties: {
        to: {
          type: 'string',
          description: 'Recipient (Slack username, email address, or channel)',
        },
        subject: {
          type: 'string',
          description: 'Subject line (for email) or message title',
        },
        body: {
          type: 'string',
          description: 'The message content',
        },
        channel: {
          type: 'string',
          enum: ['slack', 'email', 'teams'],
          description: 'Communication channel to use',
        },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  {
    name: 'query_data',
    description: 'Query data from connected integrations like Stripe, HubSpot, GitHub, Linear, etc.',
    input_schema: {
      type: 'object' as const,
      properties: {
        source: {
          type: 'string',
          enum: ['stripe', 'hubspot', 'github', 'linear', 'notion', 'salesforce', 'jira'],
          description: 'The data source to query',
        },
        query_type: {
          type: 'string',
          description: 'Type of data to retrieve (e.g., "monthly_revenue", "open_issues", "contacts")',
        },
        filters: {
          type: 'object',
          description: 'Optional filters to apply to the query',
        },
      },
      required: ['source', 'query_type'],
    },
  },
];

// Simulated tool execution
function executeToolCall(toolName: string, toolInput: Record<string, unknown>): string {
  switch (toolName) {
    case 'web_search': {
      const query = toolInput.query as string;
      const results = [
        {
          title: `${query} - Latest Updates 2025`,
          url: `https://example.com/search?q=${encodeURIComponent(query)}`,
          snippet: `Comprehensive overview of ${query}. Recent data shows significant growth with key metrics up 23% year-over-year. Industry experts predict continued expansion through Q4 2025.`,
        },
        {
          title: `${query} Analysis & Trends | TechCrunch`,
          url: `https://techcrunch.com/${query.toLowerCase().replace(/\s+/g, '-')}`,
          snippet: `Deep dive analysis: ${query} continues to dominate the market with new developments. Key players including major enterprises are investing heavily in this space.`,
        },
        {
          title: `${query} - Wikipedia`,
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(query)}`,
          snippet: `${query} refers to the practice and technology of... [comprehensive background information and historical context]`,
        },
      ];
      return JSON.stringify({ results, query, total_results: 3 });
    }

    case 'run_code': {
      const language = toolInput.language as string;
      const code = toolInput.code as string;

      // Simulate code execution based on the code content
      if (language === 'python') {
        if (code.includes('print')) {
          const outputs = code.match(/print\((.*?)\)/g) || [];
          const simulatedOutput = outputs.map(p => {
            const content = p.replace('print(', '').replace(/\)$/, '').replace(/['"]/g, '');
            return content;
          }).join('\n');
          return JSON.stringify({
            stdout: simulatedOutput || 'Code executed successfully',
            stderr: '',
            exit_code: 0,
            execution_time: '0.043s',
          });
        }
        return JSON.stringify({
          stdout: 'Script executed successfully\nResult: [data processed]',
          stderr: '',
          exit_code: 0,
          execution_time: '0.127s',
        });
      } else if (language === 'javascript' || language === 'typescript') {
        return JSON.stringify({
          stdout: 'Executed successfully\n> undefined',
          stderr: '',
          exit_code: 0,
          execution_time: '0.089s',
        });
      }
      return JSON.stringify({
        stdout: `${language} code executed successfully`,
        stderr: '',
        exit_code: 0,
        execution_time: '0.05s',
      });
    }

    case 'create_task': {
      const taskId = `TASK-${Math.floor(Math.random() * 9000) + 1000}`;
      return JSON.stringify({
        success: true,
        task_id: taskId,
        title: toolInput.title,
        description: toolInput.description,
        due_date: toolInput.due_date || null,
        priority: toolInput.priority || 'medium',
        assignee: toolInput.assignee || null,
        created_at: new Date().toISOString(),
        url: `https://app.linear.app/nexus/task/${taskId}`,
      });
    }

    case 'send_message': {
      return JSON.stringify({
        success: true,
        message_id: `msg_${Date.now()}`,
        to: toolInput.to,
        subject: toolInput.subject,
        channel: toolInput.channel || 'slack',
        sent_at: new Date().toISOString(),
        status: 'delivered',
      });
    }

    case 'query_data': {
      const source = toolInput.source as string;
      const queryType = toolInput.query_type as string;

      const mockData: Record<string, Record<string, unknown>> = {
        stripe: {
          monthly_revenue: {
            current_month: { mrr: 127450, currency: 'USD', month: 'March 2025' },
            previous_month: { mrr: 108230, currency: 'USD', month: 'February 2025' },
            change: '+17.77%',
            arr: 1529400,
            new_subscriptions: 47,
            churn: 3,
            net_revenue_retention: '118%',
          },
          customers: { total: 892, active: 847, trial: 45, churned_this_month: 3 },
        },
        hubspot: {
          contacts: { total: 12450, new_this_month: 234, qualified_leads: 89 },
          deals: { open: 67, won_this_month: 23, pipeline_value: 890000 },
        },
        github: {
          open_issues: { count: 34, critical: 2, high: 8, medium: 15, low: 9 },
          pull_requests: { open: 12, merged_this_week: 28 },
        },
        linear: {
          open_issues: { count: 156, in_progress: 34, todo: 89, backlog: 33 },
          completed_this_sprint: 42,
        },
      };

      const sourceData = mockData[source] || {};
      const result = sourceData[queryType] || { message: `No data found for ${queryType} in ${source}` };

      return JSON.stringify({
        source,
        query_type: queryType,
        data: result,
        fetched_at: new Date().toISOString(),
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
}

app.post('/api/chat', async (req: Request, res: Response) => {
  const { messages } = req.body as ChatRequest;

  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: 'Invalid request: messages array required' });
    return;
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const sendEvent = (data: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // Convert messages to Anthropic format
    const anthropicMessages: Anthropic.MessageParam[] = messages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    let continueLoop = true;
    let currentMessages = [...anthropicMessages];

    while (continueLoop) {
      const stream = client.messages.stream({
        model: 'claude-opus-4-6',
        max_tokens: 16000,
        thinking: {
          type: 'enabled',
          budget_tokens: 10000,
        },
        system: NEXUS_SYSTEM_PROMPT,
        tools: NEXUS_TOOLS,
        messages: currentMessages,
      });

      const toolUseBlocks: Anthropic.ToolUseBlock[] = [];
      let currentToolUse: { id: string; name: string; input: string } | null = null;
      let hasToolUse = false;

      for await (const event of stream) {
        if (event.type === 'content_block_start') {
          if (event.content_block.type === 'tool_use') {
            hasToolUse = true;
            currentToolUse = {
              id: event.content_block.id,
              name: event.content_block.name,
              input: '',
            };
            sendEvent({
              type: 'tool_start',
              tool_name: event.content_block.name,
              tool_id: event.content_block.id,
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
        } else if (event.type === 'message_stop') {
          // handled below
        }
      }

      const finalMessage = await stream.finalMessage();

      if (finalMessage.stop_reason === 'tool_use' && hasToolUse) {
        // Add assistant message with tool use blocks
        currentMessages.push({
          role: 'assistant',
          content: finalMessage.content,
        });

        // Execute tools and collect results
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const toolUseBlock of toolUseBlocks) {
          const toolInput = toolUseBlock.input as Record<string, unknown>;
          const result = executeToolCall(toolUseBlock.name, toolInput);

          sendEvent({
            type: 'tool_result',
            tool_id: toolUseBlock.id,
            tool_name: toolUseBlock.name,
            result: JSON.parse(result),
          });

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUseBlock.id,
            content: result,
          });
        }

        // Add tool results to messages
        currentMessages.push({
          role: 'user',
          content: toolResults,
        });
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

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'nexus-backend', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Nexus backend running on http://localhost:${PORT}`);
});

export default app;
