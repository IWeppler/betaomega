import type { Metadata } from "next";
import Image from "next/image";
import { getCategories } from "@/lib/catalog";
import { Storefront, type ComboCardData, type Product } from "./storefront";
import { ShareButton } from "./share-button";
import { StoreInfo } from "./store-info";
import { getShop, pricesDate } from "./get-shop";
import { ogImage } from "../og-image";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Catálogo | Ñekurel",
  description: "Hierbas y preparados de Ñekurel con sus precios.",
  openGraph: { title: "Catálogo | Ñekurel", description: "Hierbas y preparados de Ñekurel con sus precios.", url: "/", images: [ogImage] },
};

export default async function CatalogPage() {
  let shop;
  try { shop = await getShop(); } catch (error) {
    console.error("[catalogo] read failed:", error);
    return <main className="shop"><p className="shop-empty" role="alert">No se pudo cargar el catálogo. Intentá de nuevo en unos minutos.</p></main>;
  }
  // Only the fields the page shows reach the browser: ShopItem.item holds internal notes.
  const products: Product[] = shop.items.map(({ id, key, slug, name, tonic, image, price, regularPrice, categoryId, summary }) => ({ id, key, slug, name, tonic, image, price, regularPrice, categoryId, detail: summary }));
  const combos: ComboCardData[] = shop.combos.map(({ key, slug, name, description, image, price, regularPrice, savings, items }) => ({ key, slug, name, description, image, price, regularPrice, savings, items: items.map(({ name, qty }) => ({ name, qty })) }));
  const categories = getCategories(shop.catalog).filter(c => products.some(p => p.categoryId === c.id));
  return <main className="shop">
    <header className="shop-head">
      <Image src="/nekurel-logo.png" alt="Ñekurel" width={64} height={64} priority />
      <div className="shop-title"><h1>Catálogo Ñekurel</h1><p>Hierbas y preparados. Precios al {pricesDate()}.</p></div>
      <div className="shop-head-actions">
        <ShareButton className="button no-print shop-share" path="/" text="Catálogo Ñekurel" label="Compartir" />
      </div>
    </header>
    <Storefront products={products} combos={combos} categories={categories} whatsapp={shop.store.whatsapp ?? ""} />
    <StoreInfo store={shop.store} />
    <footer className="shop-foot">Productos de uso tradicional. Consultá antes de usarlos si estás embarazada, en lactancia, tomás medicación o tenés una condición de salud. Precios sujetos a cambios.</footer>
  </main>;
}
