"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { chapterTitle, joinAdvice, nextNumeral, splitAdvice, withChapter, withoutChapter, type AdviceBook, type AdviceChapter } from "../domain/advice";
import { Button, Card, Notice, textareaClass } from "./controls";

type Row = { key: number; numeral: string; text: string };
let rowKey = 0;
const rowsOf = (items: string[]) => items.map(item => { const { numeral, text } = splitAdvice(0, item); return { key: rowKey++, numeral, text }; });

/**
 * Edits one chapter: its advices, each with the numeral it has in the book. No "para qué sirve": a chapter is not a product. `save` stores the
 * whole book and resolves once it is saved; it throws a message for the person.
 */
export function ChapterForm({ book, chapter, isNew, save, onDone }: {
  book: AdviceBook; chapter: AdviceChapter; isNew: boolean;
  save: (next: AdviceBook, message: string) => Promise<void>; onDone: () => void;
}) {
  const [rows, setRows] = useState<Row[]>(() => (chapter.items.length ? rowsOf(chapter.items) : [{ key: rowKey++, numeral: "I", text: "" }]));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const title = chapterTitle(book.chapterName, chapter.number);
  const card = useRef<HTMLDivElement>(null);
  // The form opens above the list: bring it into view, or a chapter picked far down would open out of sight.
  useEffect(() => { card.current?.scrollIntoView({ block: "start" }); }, []);

  const run = async (next: () => AdviceBook, message: string) => {
    setBusy(true);
    setError("");
    try {
      await save(next(), message);
      onDone();
    } catch (failure) {
      setError((failure as Error).message);
      setBusy(false);
    }
  };
  const submit = () => run(() => withChapter(book, { number: chapter.number, items: rows.map(row => joinAdvice(row.numeral, row.text)) }), isNew ? `Se creó ${title}.` : `Se guardó ${title}.`);
  const add = () => setRows(current => [...current, { key: rowKey++, numeral: nextNumeral(current.map(row => joinAdvice(row.numeral, "x"))), text: "" }]);
  const change = (key: number, text: string) => setRows(current => current.map(row => (row.key === key ? { ...row, text } : row)));
  const remove = (key: number) => setRows(current => current.filter(row => row.key !== key));

  return <div ref={card} className="scroll-mt-4"><Card className="mb-4">
    <form className="grid gap-4" onSubmit={event => { event.preventDefault(); void submit(); }}>
      <div className="grid gap-1">
        <h2 className="m-0 text-lg font-semibold text-ink">{isNew ? `Nuevo: ${title}` : `Editar ${title}`}</h2>
        <p className="m-0 text-sm text-muted">Cada consejo conserva su número. Uno nuevo toma el siguiente al más alto. Los vacíos no se guardan.</p>
      </div>
      <ol className="m-0 grid list-none gap-3 p-0">
        {rows.map(row => <li key={row.key} className="grid grid-cols-[3.5rem_1fr_auto] items-start gap-2">
          <label htmlFor={`advice-${row.key}`} className="pt-2 text-right font-semibold text-muted">{row.numeral ? `${row.numeral}.` : "—"}</label>
          <textarea id={`advice-${row.key}`} className={`${textareaClass} field-sizing-content min-h-12`} rows={2} maxLength={2000} value={row.text} disabled={busy}
            aria-label={`Consejo ${row.numeral || "sin número"}`} onChange={event => change(row.key, event.target.value)} />
          <Button aria-label={`Quitar el consejo ${row.numeral || "sin número"}`} title="Quitar" disabled={busy || rows.length === 1} onClick={() => remove(row.key)} className="px-2.5">
            <Trash2 size={18} aria-hidden="true" />
          </Button>
        </li>)}
      </ol>
      <div><Button disabled={busy} onClick={add}><Plus size={18} aria-hidden="true" />Agregar consejo</Button></div>
      {error && <Notice>{error}</Notice>}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" variant="primary" disabled={busy}>{busy ? "Guardando…" : "Guardar"}</Button>
        <Button disabled={busy} onClick={onDone}>Cancelar</Button>
        {!isNew && (confirmDelete
          ? <span className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <span className="text-ink">¿Eliminar {title} y {chapter.items.length === 1 ? "su consejo" : `sus ${chapter.items.length} consejos`}?</span>
            <Button variant="danger" disabled={busy} onClick={() => void run(() => withoutChapter(book, chapter.number), `Se eliminó ${title}.`)}>Sí, eliminar</Button>
            <Button disabled={busy} onClick={() => setConfirmDelete(false)}>No</Button>
          </span>
          : <Button variant="danger" disabled={busy} className="sm:ml-auto" onClick={() => setConfirmDelete(true)}><Trash2 size={18} aria-hidden="true" />Eliminar</Button>)}
      </div>
    </form>
  </Card></div>;
}
