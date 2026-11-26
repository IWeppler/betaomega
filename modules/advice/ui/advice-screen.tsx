"use client";

import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { EmptyState, PageHeader, Paged, SearchBox, SideSheet, useSite } from "@/platform/panel";
import { offerUndo } from "@/shared/ui/undo";
import { adviceCount, chapterTitle, cleanAdviceBook, nextChapterNumber, splitAdvice, type AdviceBook, type AdviceChapter } from "../domain/advice";
import { ChapterForm } from "./chapter-form";
import { Button, Notice } from "./controls";

/** Every route of this module answers `{ error }` with a message for the person, so that message is what gets thrown. */
async function request(url: string, init?: RequestInit): Promise<AdviceBook> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const data = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new Error(data?.error ?? "No se pudo completar. Probá de nuevo.");
  return cleanAdviceBook(data);
}

const searchText = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** The panel section of the advice of the day: the chapters (Zanshei) and their advices. Each visitor of the site gets one at random a day. */
export function AdviceScreen() {
  const site = useSite();
  const url = `/api/sites/${site.id}/advice`;
  const [book, setBook] = useState<AdviceBook | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<{ chapter: AdviceChapter; isNew: boolean } | null>(null);

  const load = useCallback(async () => {
    try {
      setBook(await request(url));
      setError("");
    } catch (failure) { setError((failure as Error).message); }
  }, [url]);
  // After the effect, not in it: the first read starts once the screen is on.
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  /** Saves the whole book; Deshacer saves back the one before, over the version this save left, so a change made in between is not lost. */
  const save = async (next: AdviceBook, message: string) => {
    const previous = book;
    const put = (body: AdviceBook) => request(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const stored = await put(next);
    setBook(stored);
    if (previous) offerUndo(message, async () => { setBook(await put({ ...previous, revision: stored.revision })); });
  };

  const name = book?.chapterName ?? site.products?.advice?.chapterName ?? "Consejos";
  const query = searchText(filter.trim());
  const rows = (book?.chapters ?? []).filter(chapter => !query || searchText([chapterTitle(name, chapter.number), ...chapter.items].join(" ")).includes(query));
  return <>
    <PageHeader
      title={name}
      description={book ? `${book.chapters.length} ${name}, ${adviceCount(book)} consejos. Cada visitante ve uno al azar por día, en un aviso al entrar.` : undefined}
      actions={book && <Button variant="primary" onClick={() => setEditing({ chapter: { number: nextChapterNumber(book), items: [] }, isNew: true })}><Plus size={18} aria-hidden="true" />Nuevo {name}</Button>}
    />
    {error && <div className="mb-3 grid justify-items-start gap-2"><Notice>{error}</Notice><Button onClick={() => void load()}>Reintentar</Button></div>}
    {!book && !error && <p className="text-muted" aria-busy="true">Cargando…</p>}
    {book && (book.chapters.length === 0
      ? <EmptyState title={`Todavía no hay ${name}`} text={`Creá el primero con el botón Nuevo ${name}.`} />
      : <section className="grid gap-3" aria-label={`Lista de ${name}`}>
        <SearchBox value={filter} onChange={setFilter} label="Buscar por número o por texto" />
        {rows.length === 0 && <EmptyState title="No encontramos ese consejo" text="Probá con otra palabra." />}
        {rows.length > 0 && <Paged rows={rows} resetKey={filter}>{shown => <ul className="m-0 grid list-none gap-2 p-0">
          {shown.map(chapter => <li key={chapter.number}>
            <button type="button" aria-current={editing?.chapter.number === chapter.number ? "true" : undefined} onClick={() => setEditing({ chapter, isNew: false })}
              className="grid w-full gap-1 rounded-field border border-line bg-bg p-3 text-left hover:border-line-strong hover:bg-sunken aria-[current=true]:border-accent aria-[current=true]:bg-accent-soft">
              <span className="flex flex-wrap items-baseline gap-x-2">
                <strong className="text-ink">{chapterTitle(name, chapter.number)}</strong>
                <span className="text-sm text-muted">{chapter.items.length} {chapter.items.length === 1 ? "consejo" : "consejos"}</span>
              </span>
              <span className="line-clamp-2 text-muted">{chapter.items[0] ? splitAdvice(chapter.number, chapter.items[0]).text : ""}</span>
            </button>
          </li>)}
        </ul>}</Paged>}
      </section>)}
    {/* The same side sheet as the other lists; closing it drops what was not saved, like Cancelar. */}
    <SideSheet onClose={() => setEditing(null)}>
      {book && editing && <ChapterForm key={`${editing.chapter.number}-${editing.isNew}`} book={book} chapter={editing.chapter} isNew={editing.isNew} save={save} onDone={() => setEditing(null)} />}
    </SideSheet>
  </>;
}
