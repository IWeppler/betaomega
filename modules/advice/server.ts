import "server-only";

// Server public entry: the build fails if a client component imports this file.
export { getAdviceBook, putAdviceBook } from "./api/advice-book";
export { drawAdvice } from "./data/advice-book";
