import type { ReactNode } from 'react';

interface LiveRoomProps {
  children: ReactNode;
}

export function LiveRoom({ children }: LiveRoomProps) {
  return (
    <section data-agent-studio-room="live" className="space-y-6">
      {children}
    </section>
  );
}
