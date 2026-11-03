"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { CaretDown } from "@phosphor-icons/react";

/**
 * A recipe section as a card that folds (ingredients, preparation). The server renders it open, so it reads fine without JavaScript;
 * on phones the long one (`foldOnPhone`) then starts folded, and printing always opens everything.
 */
export function RecipeSection({ id, title, summary, foldOnPhone = false, className, children }: {
  id: string; title: string; summary?: string; foldOnPhone?: boolean; className?: string; children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const details = ref.current;
    if (!details) return;
    if (foldOnPhone && window.matchMedia("(max-width: 640px)").matches) details.open = false;
    let wasOpen = details.open;
    const beforePrint = () => { wasOpen = details.open; details.open = true; };
    const afterPrint = () => { details.open = wasOpen; };
    window.addEventListener("beforeprint", beforePrint);
    window.addEventListener("afterprint", afterPrint);
    return () => { window.removeEventListener("beforeprint", beforePrint); window.removeEventListener("afterprint", afterPrint); };
  }, [foldOnPhone]);
  return <section className={`r-fold ${className ?? ""}`} aria-labelledby={`${id}-title`}>
    <details ref={ref} open>
      <summary>
        <h2 id={`${id}-title`}>{title}</h2>
        {summary && <span className="r-fold-summary">{summary}</span>}
        <CaretDown className="r-fold-caret" size={22} weight="bold" aria-hidden="true" />
      </summary>
      <div className="r-fold-body">{children}</div>
    </details>
  </section>;
}
