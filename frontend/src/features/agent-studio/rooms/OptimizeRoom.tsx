import type { ReactNode } from 'react';

interface OptimizeRoomProps {
  children: ReactNode;
}

export function OptimizeRoom({ children }: OptimizeRoomProps) {
  return (
    <section data-agent-studio-room="optimize" className="space-y-6">
      {children}
    </section>
  );
}
