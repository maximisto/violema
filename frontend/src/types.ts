export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
  isStreaming?: boolean;
}

export interface ToolCall {
  id: string;
  name: string;
  input?: Record<string, unknown>;
  result?: Record<string, unknown>;
  status: 'running' | 'complete' | 'error';
}

export interface Conversation {
  id: string;
  title: string;
  lastMessage?: string;
  timestamp: Date;
  messages: Message[];
}

export interface SSEEvent {
  type: 'text' | 'tool_start' | 'tool_input' | 'tool_result' | 'thinking_start' | 'thinking' | 'done' | 'error';
  content?: string;
  tool_name?: string;
  tool_id?: string;
  input?: Record<string, unknown>;
  result?: Record<string, unknown>;
  message?: string;
}
