import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

type RevealProps = {
  children: ReactNode;
  /** Stagger offset in ms, applied as CSS transition-delay. */
  delay?: number;
  className?: string;
  style?: CSSProperties;
  id?: string;
};

/**
 * Wraps content in a one-shot scroll reveal. Pairs with the `.reveal` /
 * `.reveal.is-in` rules in index.css and is automatically disabled under
 * prefers-reduced-motion (the CSS forces the visible state).
 */
export default function Reveal({ children, delay = 0, className = '', style, id }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    // If the element is already scrolled past (above the viewport) on mount —
    // e.g. a reload that restores a mid-page scroll position — reveal it
    // immediately so it never gets stuck invisible above the fold.
    if (el.getBoundingClientRect().bottom <= 0) {
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShown(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.16, rootMargin: '0px 0px -8% 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const mergedStyle = { ...style, '--reveal-delay': `${delay}ms` } as CSSProperties;

  return (
    <div ref={ref} id={id} className={`reveal ${shown ? 'is-in' : ''} ${className}`.trim()} style={mergedStyle}>
      {children}
    </div>
  );
}
