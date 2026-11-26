// The advice of the day: a site keeps a book of numbered chapters (Yakuchil's Zanshei), each one a list of advices written as "XII. TEXT".
// Each visitor gets one advice at random, kept for the rest of the day on their device.

/** One chapter as stored: its number and its advices, each one with its Roman numeral as written in the book. */
export type AdviceChapter = { number: number; items: string[] };
/** `chapterName` is what the book calls a chapter ("Zanshei"). */
export type AdviceBook = { revision: number; chapterName: string; chapters: AdviceChapter[] };
/** What a visitor reads. `numeral` is the one in the book, which skips some numbers (Zanshei 14 has no XI). */
export type Advice = { chapter: number; numeral: string; text: string };
/** What reaches the browser and stays on the device: the label ("Zanshei 003 · I") and the text. */
export type AdviceCard = { label: string; text: string };

const maxChapters = 500;
const maxItems = 100;
const maxItem = 2000;

function fail(message: string): never {
  throw new Error(message);
}

/** Checks a stored book and returns a clean copy, chapters in order. A chapter number appears once; empty advices (or a bare numeral) are dropped. */
export function cleanAdviceBook(value: unknown): AdviceBook {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("Libro de consejos inválido.");
  const data = value as Record<string, unknown>;
  if (typeof data.revision !== "number" || !Number.isInteger(data.revision) || data.revision < 0 || !Array.isArray(data.chapters)) fail("Libro de consejos inválido.");
  if (data.chapters.length > maxChapters) fail(`El libro admite hasta ${maxChapters} capítulos.`);
  const chapterName = typeof data.chapterName === "string" && data.chapterName.trim() ? data.chapterName.trim().slice(0, 40) : "Capítulo";
  const seen = new Set<number>();
  const chapters = data.chapters.map((raw: unknown): AdviceChapter => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) fail("Capítulo inválido.");
    const { number, items } = raw as Record<string, unknown>;
    if (typeof number !== "number" || !Number.isInteger(number) || number < 1 || seen.has(number)) fail("Número de capítulo inválido o repetido.");
    seen.add(number);
    if (!Array.isArray(items) || items.length > maxItems) fail(`El capítulo ${number} es inválido.`);
    const clean = items.map(item => {
      if (typeof item !== "string" || item.length > maxItem) fail(`Un consejo del capítulo ${number} es inválido.`);
      return item.replace(/\s+/g, " ").trim();
    }).filter(item => splitAdvice(0, item).text);
    return { number, items: clean };
  });
  return { revision: data.revision, chapterName, chapters: chapters.sort((a, b) => a.number - b.number) };
}

/** How many advices the book has: the range of the index a visitor draws. */
export const adviceCount = (book: AdviceBook) => book.chapters.reduce((sum, chapter) => sum + chapter.items.length, 0);

/** The advice at a position, counting through the chapters in order; null outside the book. */
export function adviceAt(book: AdviceBook, index: number): Advice | null {
  if (!Number.isInteger(index) || index < 0) return null;
  let rest = index;
  for (const chapter of book.chapters) {
    if (rest < chapter.items.length) return splitAdvice(chapter.number, chapter.items[rest]);
    rest -= chapter.items.length;
  }
  return null;
}

/** "XII. NO MIENTA." → numeral "XII" and the text; "XII." alone has no text. An advice written without a numeral keeps its text whole. */
export function splitAdvice(chapter: number, item: string): Advice {
  const match = /^([IVXLC]+)\.(?:\s+|$)(.*)$/.exec(item);
  return match ? { chapter, numeral: match[1], text: match[2] } : { chapter, numeral: "", text: item };
}

/** "Zanshei 003 · I": the chapter with three digits, as the chapters are named elsewhere on the site. */
export function adviceLabel(advice: Advice, chapterName: string) {
  const chapter = chapterTitle(chapterName, advice.chapter);
  return advice.numeral ? `${chapter} · ${advice.numeral}` : chapter;
}

/** The business day of a moment in Argentina, as YYYY-MM-DD: the advice changes at midnight there, whatever the device's clock zone. */
export function adviceDay(moment: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).format(moment);
}

/** The card of the advice at a position, or null outside the book. */
export function adviceCard(book: AdviceBook, index: number): AdviceCard | null {
  const advice = adviceAt(book, index);
  return advice && { label: adviceLabel(advice, book.chapterName), text: advice.text };
}

/** What the device keeps: the day and the advice it got. Anything else stored there counts as nothing. */
export type StoredAdvice = { day: string; advice: AdviceCard };
export function readStoredAdvice(raw: string | null): StoredAdvice | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredAdvice> | null;
    const advice = value?.advice;
    if (typeof value?.day !== "string" || !advice || typeof advice.label !== "string" || typeof advice.text !== "string" || !advice.text) return null;
    return { day: value.day, advice: { label: advice.label, text: advice.text } };
  } catch {
    return null;
  }
}

/**
 * Which advice the visitor sees today and whether it opens by itself: the one they already got today, closed; otherwise the new one the
 * server drew, open, so it shows once a day.
 */
export function todaysAdvice(stored: StoredAdvice | null, drawn: AdviceCard, day: string): { advice: AdviceCard; open: boolean; store: boolean } {
  if (stored && stored.day === day) return { advice: stored.advice, open: false, store: false };
  return { advice: drawn, open: true, store: true };
}

// Editing in the panel. An advice keeps the numeral it has: the book skips some, and renumbering would change what readers already saw.
// A new advice takes the one after the highest of its chapter.

const romanValues: [number, string][] = [[100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];

/** 1 → "I", 14 → "XIV". Up to 399, more than a chapter holds. */
export function toRoman(value: number) {
  let rest = value;
  let out = "";
  for (const [amount, letters] of romanValues) while (rest >= amount) { out += letters; rest -= amount; }
  return out;
}

/** "XIV" → 14; 0 for anything that is not a Roman numeral written the usual way. */
export function fromRoman(numeral: string) {
  const letters: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100 };
  let total = 0;
  for (let n = 0; n < numeral.length; n++) {
    const value = letters[numeral[n]];
    if (!value) return 0;
    const next = letters[numeral[n + 1]] ?? 0;
    total += next > value ? -value : value;
  }
  return total > 0 && toRoman(total) === numeral ? total : 0;
}

/** The numeral for an advice added at the end of a chapter: one more than the highest it has. */
export function nextNumeral(items: string[]) {
  const highest = items.reduce((max, item) => Math.max(max, fromRoman(splitAdvice(0, item).numeral)), 0);
  return toRoman(highest + 1);
}

/** "XII" and "NO MIENTA." → "XII. NO MIENTA.", as the book stores it. */
export const joinAdvice = (numeral: string, text: string) => (numeral ? `${numeral}. ${text.trim()}` : text.trim());

/** The number for a new chapter: one more than the highest. */
export const nextChapterNumber = (book: AdviceBook) => book.chapters.reduce((max, chapter) => Math.max(max, chapter.number), 0) + 1;

/** The book with this chapter added or replacing the one with its number, kept in order. A chapter needs at least one advice. */
export function withChapter(book: AdviceBook, chapter: AdviceChapter): AdviceBook {
  const items = chapter.items.map(item => item.replace(/\s+/g, " ").trim()).filter(item => splitAdvice(0, item).text);
  if (!items.length) fail("Escribí al menos un consejo.");
  const chapters = [...book.chapters.filter(each => each.number !== chapter.number), { number: chapter.number, items }].sort((a, b) => a.number - b.number);
  return { ...book, chapters };
}

/** The book without the chapter with this number. */
export const withoutChapter = (book: AdviceBook, number: number): AdviceBook => ({ ...book, chapters: book.chapters.filter(chapter => chapter.number !== number) });

/** "Zanshei 003": a chapter's name with three digits. */
export const chapterTitle = (chapterName: string, number: number) => `${chapterName} ${String(number).padStart(3, "0")}`;
