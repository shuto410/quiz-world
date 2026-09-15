/** Room toolbar disclosures dismiss outside the panel and return keyboard focus on Escape. */
import { useEffect, useRef, type ReactNode } from 'react';

/** Native disclosure behavior is preserved for accessible activation and expanded state. */
type RoomDisclosureProps = { className: string; label: ReactNode; children: ReactNode };

export function RoomDisclosure({ className, label, children }: RoomDisclosureProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const dismissOutside = (event: PointerEvent) => {
      const details = detailsRef.current;
      if (details?.open && event.target instanceof Node && !details.contains(event.target))
        details.open = false;
    };
    document.addEventListener('pointerdown', dismissOutside);
    return () => document.removeEventListener('pointerdown', dismissOutside);
  }, []);
  return (
    <details
      ref={detailsRef}
      className={className}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && event.currentTarget.open) {
          event.preventDefault();
          event.currentTarget.open = false;
          event.currentTarget.querySelector('summary')?.focus();
        }
      }}
    >
      <summary>{label}</summary>
      {children}
    </details>
  );
}
