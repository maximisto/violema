import type { ReactNode } from 'react';
import { AdvancedPanel } from '../components/AdvancedPanel';
import { RoomSection } from '../components/RoomSection';

interface ReplayRoomProps {
  children: ReactNode;
  advanced?: ReactNode;
  showAdvanced?: boolean;
  onToggleAdvanced?: () => void;
}

export function ReplayRoom({ children, advanced, showAdvanced = false, onToggleAdvanced }: ReplayRoomProps) {
  return (
    <section data-agent-studio-room="replay" className="space-y-6">
      <RoomSection
        eyebrow="Debug and decide"
        title="Replay should explain the run clearly enough that the next change becomes obvious."
        body="Start from the exact run, compare phases, find the outcome-changing difference, then decide whether to test, release, or roll back a change."
        items={[
          'Read the run timeline before touching history or governance.',
          'Use phase overlay and paired replay to isolate the expensive or failing step.',
          'Turn the finding into a candidate change, not just a postmortem note.',
        ]}
      />
      {children}
      {advanced ? (
        <AdvancedPanel
          eyebrow="Advanced replay controls"
          title="Promotion, rollback, branch, and governance history"
          body="These surfaces matter after you understand the run. They should be available, but not the first thing users have to parse."
          open={showAdvanced}
          onToggle={onToggleAdvanced || (() => {})}
          openLabel="Show advanced replay"
          closeLabel="Hide advanced replay"
        >
          {advanced}
        </AdvancedPanel>
      ) : null}
    </section>
  );
}
