"use client";

import { useId, useState, type ReactNode } from "react";
import { Plus } from "lucide-react";

export function Question({ title, open = false, children }: { title: string; open?: boolean; children: ReactNode }) {
  const id = useId();
  const [expanded, setExpanded] = useState(open);
  return <div className="border-b border-line-strong">
    <h3 className="m-0 font-text text-xl font-semibold">
      <button id={`${id}-trigger`} type="button" aria-expanded={expanded} aria-controls={`${id}-answer`} onClick={() => setExpanded(value => !value)} className="flex min-h-control w-full items-center justify-between gap-5 py-5 text-left text-ink transition-colors duration-200 hover:text-accent-text motion-reduce:transition-none">
        {title}<Plus size={20} strokeWidth={1.25} aria-hidden="true" className={`shrink-0 transition-transform duration-300 ease-out motion-reduce:transition-none ${expanded ? "rotate-45" : "rotate-0"}`} />
      </button>
    </h3>
    <div id={`${id}-answer`} role="region" aria-labelledby={`${id}-trigger`} aria-hidden={!expanded} inert={!expanded} className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
      <div className="min-h-0 overflow-hidden"><div className="pb-5 text-lg leading-8 text-muted">{children}</div></div>
    </div>
  </div>;
}
