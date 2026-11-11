import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Leaf, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { WhatsappIcon } from "@/app/whatsapp-icon";
import { avoidOptions, type Plant, type Preparation } from "@/lib/catalog";
import { ShareButton } from "../share-button";
import { AddButton } from "../cart";
import { StoreInfo } from "../store-info";
import { WasPrice } from "../storefront";
import { getShop, pricesDate } from "../get-shop";
import { ogImage } from "../../og-image";

// ISR like the store home: the shop is a cached read (getShop) and the panel refreshes it when the catalogue is saved.
export function generateStaticParams() { return []; }
// Same as publicRevalidate (platform/sites/public-cache.ts); segment config must be a literal.
export const revalidate = 3600;
const avoidLabel = (id: string) =>
  avoidOptions.find((o) => o.id === id)?.label ?? id;

async function find(slug: string) {
  const shop = await getShop();
  return { shop, entry: shop.items.find((item) => item.slug === slug) };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { entry } = await find(slug).catch(() => ({ entry: undefined }));
  if (!entry) return { title: "Producto no encontrado | Ñekurel" };
  const item = entry.item;
  const description =
    [entry.price, "properties" in item ? item.properties : "", entry.summary]
      .filter(Boolean)
      .join(". ")
      .slice(0, 200) || "Hierbas y preparados de Ñekurel.";
  const title = `${entry.name} | Ñekurel`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `/${entry.slug}`,
      images: [entry.image || ogImage],
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let found;
  try {
    found = await find(slug);
  } catch (error) {
    console.error("[catalogo/slug] read failed:", error);
    return (
      <main className="shop shop-detail">
        <p className="shop-empty" role="alert">
          No se pudo cargar el producto. Intentá de nuevo en unos minutos.
        </p>
      </main>
    );
  }
  const { shop, entry } = found;
  if (!entry) notFound();
  const item = entry.item;
  const tonic = entry.tonic;
  const plant = item as Plant;
  const prep = item as Preparation;
  const whatsapp = shop.store.whatsapp ?? "";
  const ingredients = tonic
    ? prep.ingredients.flatMap((i) => {
        const herb = shop.catalog.plants.find((p) => p.id === i.plantId);
        return herb
          ? [
              {
                id: herb.id,
                name: herb.name,
                slug: shop.items.find((s) => s.id === herb.id)?.slug,
              },
            ]
          : [];
      })
    : [];
  const avoid = tonic ? (prep.avoid ?? []) : [];
  const message = `Hola, quiero consultar por ${entry.name}${entry.price ? ` (${entry.price})` : ""}.`;
  return (
    <main className="shop shop-detail">
      <div className="detail-top">
        <Link className="detail-back" href="/">
          <ArrowLeft size={20} aria-hidden="true" />
          Catálogo
        </Link>
      </div>
      <article className="detail-grid">
        <div className="detail-photo">
          <Leaf size={72} weight="duotone" aria-hidden="true" />
          {entry.image && (
            <Image
              src={entry.image}
              alt={entry.name}
              width={900}
              height={900}
              unoptimized
              priority
            />
          )}
        </div>
        <div className="detail-info">
          <p className="detail-kind">
            {tonic ? "Tónico" : "Hierba"} <span>{entry.categoryLabel}</span>
          </p>
          <h1>{entry.name}</h1>
          {entry.price ? (
            <p className="detail-price">
              {entry.regularPrice && (
                <>
                  <span className="promo-badge is-inline">Oferta</span>
                  <WasPrice>{entry.regularPrice}</WasPrice>
                </>
              )}
              <span>{entry.price}</span>
            </p>
          ) : (
            <p className="detail-price is-consult">Consultar precio</p>
          )}
          <p className="detail-date">Precio al {pricesDate()}.</p>
          <div className="detail-actions">
            <AddButton offerKey={entry.key} name={entry.name} />
            {whatsapp && (
              <a
                className="button primary"
                href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <WhatsappIcon size={20} />
                Consultar
              </a>
            )}
            <ShareButton
              path={`/${entry.slug}`}
              text={entry.name}
              label="Compartir"
            />
          </div>
          {item.uses.length > 0 && (
            <section>
              <h2>Para qué se usa</h2>
              <ul className="detail-tags">
                {item.uses.map((use) => (
                  <li key={use}>{use}</li>
                ))}
              </ul>
            </section>
          )}
          {!tonic && plant.properties && (
            <section>
              <h2>Propiedades</h2>
              <p>{plant.properties}</p>
            </section>
          )}
          {ingredients.length > 0 && (
            <section>
              <h2>Hierbas que lleva</h2>
              <ul className="detail-tags">
                {ingredients.map((i) => (
                  <li key={i.id}>
                    {i.slug ? (
                      <Link href={`/${i.slug}`}>{i.name}</Link>
                    ) : (
                      i.name
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {(item.warnings || avoid.length > 0) && (
            <section className="detail-warning">
              <h2>
                <WarningCircle size={24} weight="fill" aria-hidden="true" />
                Advertencias
              </h2>
              {avoid.length > 0 && (
                <p>
                  <strong>No recomendado en: </strong>
                  {avoid.map(avoidLabel).join(", ")}.
                </p>
              )}
              {item.warnings && <p>{item.warnings}</p>}
            </section>
          )}
        </div>
      </article>
      <StoreInfo store={shop.store} />
      <footer className="shop-foot">
        @ 2026 Nekurel. Todos los derechos reservados.
      </footer>
    </main>
  );
}
