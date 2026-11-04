import { notFound } from "next/navigation";
import { productWords } from "@/lib/products";
import { getProducts, productSite } from "./brand";
import { ProductBrowser } from "./product-browser";

export const dynamic = "force-dynamic";
type Props = {
  params: Promise<{ site: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProductsHome({ params, searchParams }: Props) {
  const site = await productSite(params);
  if (!site?.products) notFound();
  const words = productWords(site.products.items);
  let products;
  try {
    products = await getProducts(site);
  } catch (error) {
    console.error("[productos] read failed:", error);
    return <main className="p-page"><h1 className="p-title">{site.name}</h1><p className="p-empty" role="alert">No se pudieron cargar {words.theMany}. Intentá de nuevo en unos minutos.</p></main>;
  }
  const { q } = await searchParams;
  return <main className="p-page">
    <h1 className="p-title">{site.name}</h1>
    {products.length
      ? <ProductBrowser products={products} initialQuery={typeof q === "string" ? q : ""} one={words.one} many={words.many} />
      : <p className="p-empty">Estamos preparando {words.firstMany}.</p>}
  </main>;
}
