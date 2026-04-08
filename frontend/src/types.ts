export type AutonomyMode = 'autonomous' | 'cautious' | 'supervised';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
  thinking?: string;
  isStreaming?: boolean;
  isThinking?: boolean;
  reaction?: 'positive' | 'negative' | null;
  modelTier?: string;
  modelName?: string;
  modelSource?: string;
  routingReason?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  input?: Record<string, unknown>;
  result?: Record<string, unknown>;
  status: 'running' | 'complete' | 'error';
  startedAt?: number;
  elapsedMs?: number;
  confidence?: number;
}

export interface Conversation {
  id: string;
  title: string;
  lastMessage?: string;
  timestamp: Date;
  messages: Message[];
  pinned?: boolean;
  archived?: boolean;
  tags?: string[];
}

export interface SSEEvent {
  type: 'text' | 'tool_start' | 'tool_input' | 'tool_result' | 'thinking_start' | 'thinking' | 'done' | 'error' | 'routing';
  content?: string;
  tool_name?: string;
  tool_id?: string;
  input?: Record<string, unknown>;
  result?: Record<string, unknown>;
  message?: string;
  started_at?: number;
  elapsed_ms?: number;
  confidence?: number;
  selected_profile?: string;
  selected_model?: string;
  selected_model_source?: string;
  selected_model_source_label?: string;
  reason?: string;
}
