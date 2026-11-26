import { notFound } from "next/navigation";
import { productWords, youtubeId } from "@/lib/products";
import { drawAdvice, drawAdvices } from "@/modules/advice/server";
import { AdviceAside } from "@/modules/advice/ui/public";
import { videoStats } from "@/modules/voices/server";
import { VoicesHome } from "@/modules/voices/ui/public";
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
  const initialQuery = typeof q === "string" ? q : "";
  if (site.products.landing === "news") {
    const chapterName = site.products.advice?.chapterName;
    const videoIds = products.map(product => (product.video ? youtubeId(product.video) : null));
    const [[today, more], stats] = await Promise.all([
      chapterName ? Promise.all([drawAdvice(site.id), drawAdvices(site.id, 5)]) : Promise.resolve([null, []] as const),
      videoStats(videoIds.filter(id => id !== null)),
    ]);
    // Only what the cards and the search use: the descriptions stay on each voice's own page.
    const voices = products.map(({ id, slug, name, image, video, keywords, publishedAt }, n) => {
      const counts = videoIds[n] ? stats[videoIds[n]] : undefined;
      return { id, slug, name, image, video, keywords, publishedAt, ...(counts ? { stats: counts } : {}) };
    });
    return <VoicesHome siteId={site.id} title={words.Many} voices={voices} initialQuery={initialQuery}
      aside={chapterName && today ? <AdviceAside siteId={site.id} chapterName={chapterName} today={today} more={more} /> : undefined} />;
  }
  return <main className="p-page">
    <h1 className="p-title">{site.name}</h1>
    {products.length
      ? <ProductBrowser products={products} initialQuery={initialQuery} one={words.one} many={words.many} />
      : <p className="p-empty">Estamos preparando {words.firstMany}.</p>}
  </main>;
}
