import assert from "node:assert/strict";
import test from "node:test";
import { adviceAt, adviceCard, adviceCount, adviceDay, adviceLabel, chapterTitle, cleanAdviceBook, fromRoman, joinAdvice, nextChapterNumber, nextNumeral, readStoredAdvice, splitAdvice, toRoman, todaysAdvice, withChapter, withoutChapter } from "./advice.ts";

const book = cleanAdviceBook({ revision: 1, chapterName: " Zanshei ", chapters: [{ number: 1, items: ["I. UNO.", "II. DOS."] }, { number: 3, items: ["I. TRES.", "  XII.  CON   ESPACIOS. ", "", "XIII."] }] });

test("el libro se valida y descarta consejos vacíos", () => {
  assert.equal(adviceCount(book), 4);
  assert.deepEqual(book.chapters[1].items, ["I. TRES.", "XII. CON ESPACIOS."]);
  assert.throws(() => cleanAdviceBook({ revision: 0, chapters: [{ number: 1, items: [] }, { number: 1, items: [] }] }), /repetido/);
  assert.throws(() => cleanAdviceBook({ chapters: [] }), /inválido/);
  assert.throws(() => cleanAdviceBook({ revision: 0, chapters: [{ number: 2, items: [5] }] }), /consejo del capítulo 2/);
});

test("cada posición del sorteo es un consejo, recorriendo los capítulos en orden", () => {
  assert.deepEqual(adviceAt(book, 0), { chapter: 1, numeral: "I", text: "UNO." });
  assert.deepEqual(adviceAt(book, 2), { chapter: 3, numeral: "I", text: "TRES." });
  assert.deepEqual(adviceAt(book, 3), { chapter: 3, numeral: "XII", text: "CON ESPACIOS." });
  assert.equal(adviceAt(book, 4), null);
  assert.equal(adviceAt(book, -1), null);
  assert.equal(adviceAt(book, 1.5), null);
});

test("la tarjeta lleva el nombre de los capítulos del libro, o Capítulo si no tiene", () => {
  assert.deepEqual(adviceCard(book, 3), { label: "Zanshei 003 · XII", text: "CON ESPACIOS." });
  assert.equal(adviceCard(book, 9), null);
  assert.equal(cleanAdviceBook({ revision: 0, chapters: [] }).chapterName, "Capítulo");
});

test("el número romano se separa del texto y un consejo sin número queda entero", () => {
  assert.deepEqual(splitAdvice(7, "XIV. SEA VALIENTE."), { chapter: 7, numeral: "XIV", text: "SEA VALIENTE." });
  assert.deepEqual(splitAdvice(7, "SIN NÚMERO."), { chapter: 7, numeral: "", text: "SIN NÚMERO." });
});

test("la etiqueta lleva el capítulo con tres cifras y el número del consejo", () => {
  assert.equal(adviceLabel({ chapter: 3, numeral: "I", text: "x" }, "Zanshei"), "Zanshei 003 · I");
  assert.equal(adviceLabel({ chapter: 112, numeral: "", text: "x" }, "Zanshei"), "Zanshei 112");
});

test("el día del consejo es el de Argentina, no el del reloj del dispositivo", () => {
  assert.equal(adviceDay(new Date("2026-11-26T02:59:00Z")), "2026-11-25");
  assert.equal(adviceDay(new Date("2026-11-26T03:00:00Z")), "2026-11-26");
});

test("el consejo se abre solo una vez por día y después queda el mismo", () => {
  const drawn = { label: "Zanshei 005 · II", text: "NUEVO." };
  const kept = { day: "2026-11-25", advice: { label: "Zanshei 001 · I", text: "DE HOY." } };
  assert.deepEqual(todaysAdvice(kept, drawn, "2026-11-25"), { advice: kept.advice, open: false, store: false });
  assert.deepEqual(todaysAdvice(kept, drawn, "2026-11-26"), { advice: drawn, open: true, store: true });
  assert.deepEqual(todaysAdvice(null, drawn, "2026-11-26"), { advice: drawn, open: true, store: true });
});

test("lo guardado en el dispositivo se valida: si está roto cuenta como nada", () => {
  assert.equal(readStoredAdvice(null), null);
  assert.equal(readStoredAdvice("{roto"), null);
  assert.equal(readStoredAdvice(JSON.stringify({ day: "2026-11-25", advice: { label: "Zanshei 001 · I", text: "" } })), null);
  assert.deepEqual(readStoredAdvice(JSON.stringify({ day: "2026-11-25", advice: { label: "Zanshei 001 · I", text: "HOLA.", extra: 1 } })), { day: "2026-11-25", advice: { label: "Zanshei 001 · I", text: "HOLA." } });
});

test("los capítulos quedan en orden aunque estén guardados desordenados", () => {
  const messy = cleanAdviceBook({ revision: 0, chapters: [{ number: 5, items: ["I. A."] }, { number: 2, items: ["I. B."] }] });
  assert.deepEqual(messy.chapters.map(chapter => chapter.number), [2, 5]);
});

test("los números romanos van y vuelven, y lo mal escrito vale cero", () => {
  for (const [value, numeral] of [[1, "I"], [4, "IV"], [9, "IX"], [14, "XIV"], [40, "XL"], [99, "XCIX"], [112, "CXII"]] as [number, string][]) {
    assert.equal(toRoman(value), numeral);
    assert.equal(fromRoman(numeral), value);
  }
  assert.equal(fromRoman("IIII"), 0);
  assert.equal(fromRoman("ABC"), 0);
  assert.equal(fromRoman(""), 0);
});

test("un consejo nuevo toma el número siguiente al más alto, aunque el libro saltee alguno", () => {
  assert.equal(nextNumeral(["I. A.", "II. B.", "XII. C."]), "XIII");
  assert.equal(nextNumeral([]), "I");
  assert.equal(nextNumeral(["SIN NÚMERO."]), "I");
  assert.equal(joinAdvice("XIII", "  NUEVO. "), "XIII. NUEVO.");
  assert.equal(joinAdvice("", "SUELTO."), "SUELTO.");
});

test("un Zanshei nuevo toma el número siguiente y se guarda en orden", () => {
  assert.equal(nextChapterNumber(book), 4);
  assert.equal(nextChapterNumber(cleanAdviceBook({ revision: 0, chapters: [] })), 1);
  const added = withChapter(book, { number: 2, items: ["I.  DOS  ", "II.", "  "] });
  assert.deepEqual(added.chapters.map(chapter => chapter.number), [1, 2, 3]);
  assert.deepEqual(added.chapters[1].items, ["I. DOS"]);
  assert.equal(book.chapters.length, 2);
});

test("editar reemplaza el Zanshei con su número y uno sin consejos no se guarda", () => {
  const edited = withChapter(book, { number: 1, items: ["I. CAMBIADO."] });
  assert.deepEqual(edited.chapters[0], { number: 1, items: ["I. CAMBIADO."] });
  assert.equal(edited.chapters.length, 2);
  assert.throws(() => withChapter(book, { number: 1, items: ["II.", " "] }), /al menos un consejo/);
});

test("eliminar quita solo ese Zanshei", () => {
  assert.deepEqual(withoutChapter(book, 1).chapters.map(chapter => chapter.number), [3]);
  assert.equal(chapterTitle("Zanshei", 7), "Zanshei 007");
});
