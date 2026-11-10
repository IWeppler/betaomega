import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Leaf } from "@phosphor-icons/react/dist/ssr";
import { WhatsappIcon } from "@/app/whatsapp-icon";
import { ShareButton } from "../../share-button";
import { AddButton } from "../../cart";
import { StoreInfo } from "../../store-info";
import { WasPrice } from "../../storefront";
import { getShop, pricesDate } from "../../get-shop";
import { ogImage } from "../../../og-image";

// ISR like the store home: the shop is a cached read (getShop) and the panel refreshes it when the catalogue is saved.
export function generateStaticParams() { return []; }
// Same as publicRevalidate (platform/sites/public-cache.ts); segment config must be a literal.
export const revalidate = 3600;

async function find(slug: string) {
  const shop = await getShop();
  return { shop, combo: shop.combos.find(c => c.slug === slug) };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { combo } = await find(slug).catch(() => ({ combo: undefined }));
  if (!combo) return { title: "Combo no encontrado | Ñekurel" };
  const description = [combo.price, combo.description, combo.items.map(i => `${i.qty} x ${i.name}`).join(", ")].filter(Boolean).join(". ").slice(0, 200);
  const title = `${combo.name} | Ñekurel`;
  return { title, description, openGraph: { title, description, url: `/combos/${combo.slug}`, images: [combo.image || ogImage] } };
}

export default async function ComboPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let found;
  try { found = await find(slug); } catch (error) {
    console.error("[catalogo/combos] read failed:", error);
    return <main className="shop shop-detail"><p className="shop-empty" role="alert">No se pudo cargar el combo. Intentá de nuevo en unos minutos.</p></main>;
  }
  const { shop, combo } = found;
  // Hidden products make the combo disappear (see isComboInStore), so a broken combo is a 404 here.
  if (!combo) notFound();
  const whatsapp = shop.store.whatsapp ?? "";
  const message = `Hola, quiero consultar por el combo ${combo.name} (${combo.price}).`;
  return <main className="shop shop-detail">
    <div className="detail-top">
      <Link className="detail-back" href="/"><ArrowLeft size={20} aria-hidden="true" />Catálogo</Link>
    </div>
    <article className="detail-grid">
      <div className="detail-photo">
        <Leaf size={72} weight="duotone" aria-hidden="true" />
        {combo.image && <Image src={combo.image} alt={combo.name} width={900} height={900} unoptimized priority />}
      </div>
      <div className="detail-info">
        <p className="detail-kind">Combo</p>
        <h1>{combo.name}</h1>
        <p className="detail-price">
          {combo.regularPrice && <WasPrice>{combo.regularPrice}</WasPrice>}
          <span>{combo.price}</span>
        </p>
        {combo.savings && <p className="combo-savings is-large">Ahorrás {combo.savings}</p>}
        <p className="detail-date">Precio al {pricesDate()}. Dentro del combo, los productos se venden al precio del combo.</p>
        <div className="detail-actions">
          <AddButton offerKey={combo.key} name={combo.name} />
          {whatsapp && <a className="button primary" href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer"><WhatsappIcon size={20} />Consultar</a>}
          <ShareButton path={`/combos/${combo.slug}`} text={combo.name} label="Compartir" />
        </div>
        {combo.description && <section><h2>Qué es</h2><p>{combo.description}</p></section>}
        <section>
          <h2>Qué incluye</h2>
          <ul className="detail-tags">
            {combo.items.map(item => <li key={item.name}>{item.qty} x {item.slug ? <Link href={`/${item.slug}`}>{item.name}</Link> : item.name}</li>)}
          </ul>
        </section>
      </div>
    </article>
    <StoreInfo store={shop.store} />
    <footer className="shop-foot">@ 2026 Nekurel. Todos los derechos reservados.</footer>
  </main>;
}
