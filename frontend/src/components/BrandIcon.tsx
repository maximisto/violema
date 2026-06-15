import CalendarDays from 'lucide-react/dist/esm/icons/calendar-days.js';
import Chrome from 'lucide-react/dist/esm/icons/chrome.js';
import Monitor from 'lucide-react/dist/esm/icons/monitor.js';
import Mail from 'lucide-react/dist/esm/icons/mail.js';
import MessageSquare from 'lucide-react/dist/esm/icons/message-square.js';
import Plug from 'lucide-react/dist/esm/icons/plug.js';
import Search from 'lucide-react/dist/esm/icons/search.js';
import UsersRound from 'lucide-react/dist/esm/icons/users-round.js';
import Workflow from 'lucide-react/dist/esm/icons/workflow.js';
import { resolveIntegrationLogo, type IntegrationAppIcon } from '../content/integrationLogos';

const appIconById: Record<IntegrationAppIcon, typeof Mail> = {
  browser: Chrome,
  calendar: CalendarDays,
  mail: Mail,
  mcp: Plug,
  message: MessageSquare,
  search: Search,
  team: UsersRound,
  web: Monitor,
  workflow: Workflow,
};

/**
 * Renders a real, monochrome app/brand glyph for a connected system.
 * Falls back to a Lucide icon for generic channels and an initial for
 * Violema's own surface, so every node gets a square icon (never raw text).
 */
export default function BrandIcon({ name, className = 'h-5 w-5' }: { name: string; className?: string }) {
  const logo = resolveIntegrationLogo(name);

  if (logo.kind === 'brand') {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
        <path d={logo.path} />
      </svg>
    );
  }

  if (logo.kind === 'app') {
    const Icon = appIconById[logo.icon];
    return <Icon className={className} aria-hidden="true" />;
  }

  return (
    <span className={`${className} inline-flex items-center justify-center text-[0.7rem] font-black tracking-[-0.05em]`} aria-hidden="true">
      {logo.label}
    </span>
  );
}
