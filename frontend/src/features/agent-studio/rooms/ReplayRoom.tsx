import type { ReactNode } from 'react';

interface ReplayRoomProps {
  children: ReactNode;
}

export function ReplayRoom({ children }: ReplayRoomProps) {
  return (
    <section data-agent-studio-room="replay" className="space-y-6">
      {children}
    </section>
  );
}
