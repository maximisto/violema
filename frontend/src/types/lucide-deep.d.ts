declare module 'lucide-react/dist/esm/icons/*.js' {
  import type { ForwardRefExoticComponent, RefAttributes, SVGProps } from 'react';

  export type LucideDeepIcon = ForwardRefExoticComponent<
    Omit<SVGProps<SVGSVGElement>, 'ref'> &
      RefAttributes<SVGSVGElement> & {
        size?: string | number;
        absoluteStrokeWidth?: boolean;
      }
  >;

  const icon: LucideDeepIcon;
  export default icon;
}
