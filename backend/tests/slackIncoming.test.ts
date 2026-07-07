import assert from 'node:assert/strict';
import test from 'node:test';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages/messages';
import type { TextProfile, TextGenerationResult } from '../src/models';
import {
  buildSlackIncomingReply,
  resolveSlackReplyProfile,
  stripSlackMentions,
} from '../src/slackIncoming';

test('stripSlackMentions removes Slack user mention tokens', () => {
  assert.equal(stripSlackMentions('<@U123ABC> can you help?'), 'can you help?');
});

test('resolveSlackReplyProfile never returns autonomous routing for current-info asks', () => {
  assert.equal(resolveSlackReplyProfile('search latest competitor pricing today'), 'hard');
});

test('buildSlackIncomingReply uses text generation only for Slack replies', async () => {
  const calls: Array<{
    profile: TextProfile;
    system: string;
    messages: MessageParam[];
    maxTokens: number;
    workspaceId?: string;
  }> = [];

  const result = await buildSlackIncomingReply({
    prompt: '<@U123ABC> send a message to @mention',
    isDm: false,
    workspaceId: 'purpleorangehq',
    generateTextDetailed: async (
      profile: TextProfile,
      system: string,
      messages: MessageParam[],
      maxTokens: number,
      workspaceId?: string,
    ): Promise<TextGenerationResult> => {
      calls.push({ profile, system, messages, maxTokens, workspaceId });
      return { text: 'Ready from Slack.' };
    },
  });

  assert.equal(result.body, 'Ready from Slack.');
  assert.equal(result.profile, 'default');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].workspaceId, 'purpleorangehq');
  assert.match(calls[0].system, /You are Violema replying inside Slack/);
  assert.match(String(calls[0].messages[0].content), /Reply in Slack format/);
  assert.doesNotMatch(String(calls[0].messages[0].content), /<@U123ABC>/);
});
