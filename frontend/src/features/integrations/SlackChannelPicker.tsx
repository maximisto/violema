import { useEffect, useState } from 'react';
import Hash from 'lucide-react/dist/esm/icons/hash.js';
import Lock from 'lucide-react/dist/esm/icons/lock.js';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2.js';
import Pencil from 'lucide-react/dist/esm/icons/pencil.js';
import { fetchSlackChannels, type SlackChannel, type SlackChannelsResult } from './connectionActions';

/**
 * A real Slack destination picker, wrapped around the free-text input it
 * replaces.
 *
 * Typing a channel name blind is how a mission gets configured to deliver
 * somewhere Violema was never invited — the run then fails at delivery, after
 * the work is already done. When the server can list channels this shows
 * membership up front ("Violema is in this channel" vs "invite required"), so
 * the failure is visible before the first run instead of after it.
 *
 * FEATURE-DETECTED. `/api/integrations/slack/channels` does not exist on every
 * deployment. A 404 — or any unreadable answer — falls straight back to
 * `children`, today's text input, so this is safe to ship ahead of the endpoint.
 */

export const SLACK_PICKER_FALLBACK_NOTE =
  'Channel list unavailable — type the channel name or ID instead.';

function normalizeChannelValue(value: string): string {
  return value.trim().replace(/^#/, '').toLowerCase();
}

function isSelected(channel: SlackChannel, value: string): boolean {
  const normalized = normalizeChannelValue(value);
  if (!normalized) return false;
  return normalized === channel.name.toLowerCase() || normalized === channel.id.toLowerCase();
}

export function SlackChannelPicker({
  value,
  onChange,
  active,
  children,
}: {
  value: string;
  onChange: (next: string) => void;
  /** False for email/no-delivery destinations: the picker stays out of the way. */
  active: boolean;
  /** The text input this picker replaces, and falls back to. */
  children: React.ReactNode;
}) {
  const [result, setResult] = useState<SlackChannelsResult | null>(null);
  const [manual, setManual] = useState(false);

  useEffect(() => {
    if (!active) return undefined;
    const controller = new AbortController();
    let live = true;
    void fetchSlackChannels(controller.signal).then((next) => {
      if (live) setResult(next);
    });
    return () => {
      live = false;
      controller.abort();
    };
  }, [active]);

  if (!active) return <>{children}</>;

  if (result === null) {
    return (
      <>
        {children}
        <p className="mt-2 inline-flex items-center gap-1.5 px-1 text-xs text-slate-500">
          <Loader2 className="h-3 w-3 animate-spin" />
          Looking for channels Violema can post to…
        </p>
      </>
    );
  }

  // Every non-ready answer is the same product decision: never block the
  // operator behind a directory we could not read.
  if (result.kind !== 'ready' || result.channels.length === 0) {
    return (
      <>
        {children}
        <p className="mt-2 px-1 text-xs leading-5 text-slate-500">{SLACK_PICKER_FALLBACK_NOTE}</p>
      </>
    );
  }

  if (manual) {
    return (
      <>
        {children}
        <button
          type="button"
          onClick={() => setManual(false)}
          className="mt-2 inline-flex items-center gap-1.5 px-1 text-xs font-semibold text-cyan-200 transition-colors hover:text-cyan-100"
        >
          Pick from your channels instead
        </button>
      </>
    );
  }

  return (
    <div className="mt-2">
      <div className="panel-scroll max-h-52 overflow-y-auto rounded-2xl border border-navy-700/70 bg-navy-950/45 p-1.5">
        {result.channels.map((channel) => {
          const selected = isSelected(channel, value);
          return (
            <button
              key={channel.id}
              type="button"
              onClick={() => onChange(`#${channel.name}`)}
              aria-pressed={selected}
              className={`flex w-full items-center justify-between gap-3 rounded-xl px-2.5 py-2 text-left transition-colors ${
                selected
                  ? 'bg-cyan-500/14 text-cyan-50'
                  : 'text-slate-300 hover:bg-white/[0.04] hover:text-white'
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                {channel.isPrivate ? (
                  <Lock className="h-3.5 w-3.5 flex-shrink-0 text-slate-500" aria-hidden="true" />
                ) : (
                  <Hash className="h-3.5 w-3.5 flex-shrink-0 text-slate-500" aria-hidden="true" />
                )}
                <span className="truncate text-sm font-medium">{channel.name}</span>
              </span>
              <span
                className={`flex-shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                  channel.isMember
                    ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100'
                    : 'border-amber-300/25 bg-amber-300/10 text-amber-100'
                }`}
              >
                {channel.isMember ? 'Violema is in this channel' : 'Invite required'}
              </span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => setManual(true)}
        className="mt-2 inline-flex items-center gap-1.5 px-1 text-xs font-semibold text-slate-400 transition-colors hover:text-slate-200"
      >
        <Pencil className="h-3 w-3" aria-hidden="true" />
        Type a channel name or ID
      </button>
    </div>
  );
}

export default SlackChannelPicker;
