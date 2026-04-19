import type { ReactNode } from 'react';
import { AdvancedPanel } from '../components/AdvancedPanel';
import { RoomSection } from '../components/RoomSection';

interface LiveRoomProps {
  children: ReactNode;
  advanced?: ReactNode;
  showAdvanced?: boolean;
  onToggleAdvanced?: () => void;
}

export function LiveRoom({ children, advanced, showAdvanced = false, onToggleAdvanced }: LiveRoomProps) {
  return (
    <section data-agent-studio-room="live" className="space-y-6">
      <RoomSection
        eyebrow="Operator loop"
        title="Operate the workflow first. Intervene only where the run shows pressure."
        body="Live is for the current system state: the map, the active worker, the handoff trail, and the next action that should actually matter."
        items={[
          'Read the map and find the overloaded or underused part of the system.',
          'Inspect one worker at a time instead of scanning every panel.',
          'Use the next action queue to intervene locally, then watch the next run.',
        ]}
      />
      {children}
      {advanced ? (
        <AdvancedPanel
          eyebrow="Advanced live controls"
          title="Deep steering, telemetry, and supporting diagnostics"
          body="Use these only when the default live path is not enough. They are still powerful, but they should not compete with the main operating view."
          open={showAdvanced}
          onToggle={onToggleAdvanced || (() => {})}
          openLabel="Show advanced live"
          closeLabel="Hide advanced live"
        >
          {advanced}
        </AdvancedPanel>
      ) : null}
    </section>
  );
}
