"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { EditorFrame } from "@/platform/panel";
import { chapterTitle, joinAdvice, nextNumeral, splitAdvice, withChapter, withoutChapter, type AdviceBook, type AdviceChapter } from "../domain/advice";
import { Button, Notice, textareaClass } from "./controls";

type Row = { key: number; numeral: string; text: string };
let rowKey = 0;
const rowsOf = (items: string[]) => items.map(item => { const { numeral, text } = splitAdvice(0, item); return { key: rowKey++, numeral, text }; });

/**
 * Edits one chapter in the side sheet, like the other lists of the panel: its advices, each with the numeral it has in the book. No "para qué
 * sirve": a chapter is not a product. `save` stores the whole book and resolves once it is saved; it throws a message for the person.
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
  const count = chapter.items.length === 1 ? "su consejo" : `sus ${chapter.items.length} consejos`;

  if (confirmDelete) return <EditorFrame title={`Eliminar ${title}`} onClose={() => setConfirmDelete(false)}>
    <div className="grid gap-4">
      <p className="m-0 text-muted">{title} se elimina con {count}, del panel y del consejo del día. Podés deshacerlo desde el aviso que aparece abajo.</p>
      {error && <Notice>{error}</Notice>}
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => setConfirmDelete(false)}>Cancelar</Button>
        <Button variant="danger" disabled={busy} onClick={() => void run(() => withoutChapter(book, chapter.number), `Se eliminó ${title}.`)}>{busy ? "Eliminando…" : `Eliminar ${title}`}</Button>
      </div>
    </div>
  </EditorFrame>;

  return <EditorFrame title={isNew ? `Nuevo: ${title}` : title} onClose={onDone} onDelete={isNew ? undefined : () => setConfirmDelete(true)}>
    <form className="grid gap-4" onSubmit={event => { event.preventDefault(); void submit(); }}>
      <p className="m-0 text-sm text-muted">Cada consejo conserva su número. Uno nuevo toma el siguiente al más alto. Los vacíos no se guardan.</p>
      <ol className="m-0 grid list-none gap-3 p-0">
        {rows.map(row => <li key={row.key} className="grid grid-cols-[2.75rem_1fr_auto] items-start gap-2">
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
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" disabled={busy}>{busy ? "Guardando…" : "Guardar"}</Button>
        <Button disabled={busy} onClick={onDone}>Cancelar</Button>
      </div>
    </form>
  </EditorFrame>;
}
