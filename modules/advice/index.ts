// Client-safe public entry: types and pure rules only. Server code goes through server.ts.
export { adviceAt, adviceCard, adviceCount, adviceDay, adviceLabel, cleanAdviceBook, splitAdvice } from "./domain/advice";
export type { Advice, AdviceBook, AdviceCard, AdviceChapter } from "./domain/advice";
