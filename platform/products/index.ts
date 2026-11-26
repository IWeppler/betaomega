// Facade over the legacy products code (lib/products.ts), client-safe: types and pure rules only. Reads and saves stay in lib/product-store.ts,
// which the routes call; a module gets the products as props.
export { newestFirst, newestId, productWords, searchProducts, youtubeEmbed, youtubeThumbnail } from "@/lib/products";
export type { Product } from "@/lib/products";
