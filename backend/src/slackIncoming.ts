import type { MessageParam } from '@anthropic-ai/sdk/resources/messages/messages';
import type { TextGenerationResult, TextProfile } from './models';

export type SlackTextGenerator = (
  profile: TextProfile,
  system: string,
  messages: MessageParam[],
  maxTokens: number,
  workspaceId?: string,
) => Promise<TextGenerationResult>;

const SLACK_REPLY_MAX_TOKENS = 900;

const SLACK_REPLY_SYSTEM_PROMPT = [
  'You are Violema replying inside Slack.',
  'Answer directly and concisely. Be useful, practical, and calm.',
  'Do not claim that you used tools, delivered messages, searched the web, read private systems, or completed an action unless the prompt includes that evidence.',
  'If the request requires current external research, private data, or an automation run, explain the next useful step instead of inventing results.',
].join(' ');

export function stripSlackMentions(text: string) {
  return text.replace(/<@[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function needsSlackHigherReasoning(text: string) {
  return /(latest|current|today|news|search|look up|find|what happened|recent|analyze|compare|strategy|pricing)/i.test(text);
}

export function resolveSlackReplyProfile(prompt: string): TextProfile {
  return needsSlackHigherReasoning(prompt) ? 'hard' : 'default';
}

export function formatSlackReply(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return 'I did not get enough signal from that prompt. Try asking more directly.';
  }

  const withoutPlanning = trimmed
    .replace(/^I(?:'|')ll [^.]+?\.\s*/i, '')
    .replace(/^Let me [^.]+?\.\s*/i, '');

  const normalized = withoutPlanning
    .replace(/^###\s+(.+)$/gm, '*$1*')
    .replace(/^##\s+(.+)$/gm, '*$1*')
    .replace(/^#\s+(.+)$/gm, '*$1*')
    .replace(/```[\s\S]*?```/g, (block) => block)
    .replace(/\n{3,}/g, '\n\n');

  if (normalized.length <= 3500) return normalized;
  const cutAt = normalized.lastIndexOf('\n\n', 3450);
  const truncated = cutAt > 800 ? normalized.slice(0, cutAt) : normalized.slice(0, 3450).trim();
  return `${truncated}\n\n_(truncated - ask me to continue if needed)_`;
}

export function buildSlackTaskPrompt(prompt: string, context: { isDm: boolean }) {
  const cleaned = stripSlackMentions(prompt).trim() || 'Help me get started.';
  const deliveryContext = context.isDm
    ? 'This request came from a direct message in Slack.'
    : 'This request came from an @mention in a Slack channel. Reply in-thread, not for the whole app.';

  return [
    deliveryContext,
    'Reply in Slack format: concise, useful, action-oriented.',
    'Lead directly with the answer. Use plain text paragraphs or short bullet lists.',
    'Do NOT use # headers or --- dividers. Use *bold* sparingly for key terms only.',
    'Keep it under 3 short paragraphs or 6 bullets total.',
    'Do not use delivery tools or choose Slack targets. The server will post this response to the original thread.',
    'If the user asks for current information you cannot verify from the prompt, say what is needed instead of guessing.',
    '',
    `User request: ${cleaned}`,
  ].join('\n');
}

export async function buildSlackIncomingReply(input: {
  prompt: string;
  isDm: boolean;
  workspaceId: string;
  generateTextDetailed: SlackTextGenerator;
}) {
  const cleanedPrompt = stripSlackMentions(input.prompt);
  const profile = resolveSlackReplyProfile(cleanedPrompt);
  const result = await input.generateTextDetailed(
    profile,
    SLACK_REPLY_SYSTEM_PROMPT,
    [{ role: 'user', content: buildSlackTaskPrompt(cleanedPrompt, { isDm: input.isDm }) }],
    SLACK_REPLY_MAX_TOKENS,
    input.workspaceId,
  );

  return {
    body: formatSlackReply(result.text),
    profile,
    usage: result.usage,
  };
}
