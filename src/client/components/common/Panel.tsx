import type { ReactNode } from 'react';

interface PanelProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

/** Standard dark cockpit card with an optional section title. */
export function Panel({ title, children, className }: PanelProps) {
  return (
    <section
      className={`rounded-lg border border-cockpit-edge bg-cockpit-panel p-3 ${className ?? ''}`}
    >
      {title && (
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}
