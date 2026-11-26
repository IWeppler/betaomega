import "server-only";

// Server facade over the products store (lib/product-store.ts): what a module needs to check a product exists and is public.
export { listPublishedProducts } from "@/lib/product-store";
