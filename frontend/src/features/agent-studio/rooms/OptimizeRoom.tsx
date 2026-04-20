import type { ReactNode } from 'react';
import { AdvancedPanel } from '../components/AdvancedPanel';
import { RoomSection } from '../components/RoomSection';

interface OptimizeRoomProps {
  children: ReactNode;
  advanced?: ReactNode;
  showAdvanced?: boolean;
  onToggleAdvanced?: () => void;
}

export function OptimizeRoom({ children, advanced, showAdvanced = false, onToggleAdvanced }: OptimizeRoomProps) {
  return (
    <section data-agent-studio-room="optimize" className="space-y-6">
      <RoomSection
        eyebrow="Release path"
        title="Choose the operating goal, compare a candidate, then decide whether it should ship."
        body="Optimize is for release decisions. Start with scenarios and presets, read the decision brief, then decide whether the candidate is better enough to apply."
        items={[
          'Set the pressure you expect with a scenario, not a pile of overrides.',
          'Read the decision brief before diving into detailed candidate diff.',
          'Open the advanced lab only when the simple path stops being enough.',
        ]}
      />
      {children}
      {advanced ? (
        <AdvancedPanel
          eyebrow="Advanced optimize controls"
          title="Strategy lab, plans, branches, and policy governance"
          body="These controls are still available, but they should support release decisions instead of overwhelming them."
          open={showAdvanced}
          onToggle={onToggleAdvanced || (() => {})}
          openLabel="Show advanced optimize"
          closeLabel="Hide advanced optimize"
        >
          {advanced}
        </AdvancedPanel>
      ) : null}
    </section>
  );
}
