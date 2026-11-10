"use client";

import { offerUndo } from "@/shared/ui/undo";
import { fetchJson, sendJson } from "./fetch-json";

/**
 * "Deshacer" for a row the panel saves whole over its own updated_at, such as a plan or a code. A new row is deleted (its route deactivates it
 * instead if someone already used it, and says so); an edited one is saved back as it was, over the version it has now, so a change someone else
 * made in between is refused instead of lost.
 */
export function offerRowUndo<Row extends { id: string; updatedAt: string }, Data>({ message, url, previous, savedId, rowsOf, bodyOf, reload }: {
  message: string;
  /** The panel route of the rows: GET lists them, POST saves one, DELETE ?id= removes a new one. */
  url: string;
  /** The row as it was, or null for a new one. */
  previous: Row | null;
  savedId: string;
  rowsOf: (data: Data) => Row[];
  /** What the form would send for this row. */
  bodyOf: (row: Row) => Record<string, unknown>;
  reload: () => Promise<void>;
}) {
  offerUndo(message, async () => {
    if (!previous) {
      const answer = await sendJson<{ message?: string }>(`${url}?id=${savedId}`, "DELETE");
      await reload();
      return answer?.message;
    }
    const now = rowsOf(await fetchJson<Data>(url)).find(row => row.id === previous.id);
    await sendJson(url, "POST", { ...bodyOf(previous), id: previous.id, updatedAt: now?.updatedAt ?? previous.updatedAt });
    await reload();
  });
}
