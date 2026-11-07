"use client";

import { EmptyState, PageHeader, useSite } from "@/platform/panel";
import type { Thing } from "../domain/thing";

export function ThingList({ things }: { things: Thing[] }) {
  const site = useSite();
  return (
    <>
      <PageHeader title="Cosas" description={site.name} />
      {things.length === 0 ? (
        <EmptyState title="Todavía no hay nada" text="Cuando cargues la primera, aparece acá." />
      ) : (
        <ul className="flex flex-col gap-2">
          {things.map(thing => <li key={thing.id} className="rounded-lg border border-line bg-surface p-3 text-ink">{thing.name}</li>)}
        </ul>
      )}
    </>
  );
}
