import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, ImageSquare } from "@phosphor-icons/react/dist/ssr";
import { ApplicationSign } from "../application-sign";
import { getProducts, productSite } from "../brand";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ site: string; slug: string }> };

async function find(params: Props["params"]) {
  const site = await productSite(params);
  if (!site) return {};
  const { slug } = await params;
  return { site, product: (await getProducts(site)).find(p => p.slug === slug) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { site, product } = await find(params).catch(() => ({ site: undefined, product: undefined }));
  if (!site || !product) return {};
  const description = product.description.replace(/\s+/g, " ").slice(0, 200);
  const images = [product.image ? { url: product.image, alt: product.name } : { url: "/og", width: 1200, height: 630, alt: site.name }];
  return {
    title: product.name,
    description,
    alternates: { canonical: `/${product.slug}` },
    openGraph: { title: product.name, description, url: `/${product.slug}`, type: "article", siteName: site.name, locale: "es_AR", images },
    twitter: { card: "summary_large_image", title: product.name, description, images },
  };
}

export default async function ProductPage({ params }: Props) {
  let found;
  try { found = await find(params); } catch (error) {
    console.error("[productos/slug] read failed:", error);
    return <main className="p-page"><p className="p-empty" role="alert">No se pudo cargar el producto. Intentá de nuevo en unos minutos.</p></main>;
  }
  const { site, product } = found;
  if (!site?.products || !product) notFound();
  return <main className="p-page">
    <nav className="p-back" aria-label="Volver"><Link href="/"><ArrowLeft size={18} aria-hidden="true" />{site.name}</Link></nav>
    <article className="p-detail">
      <div className="p-photo is-large">
        {product.image
          ? <Image src={product.image} alt={product.name} fill sizes="(max-width: 860px) 100vw, 560px" unoptimized priority />
          : <ImageSquare size={64} aria-hidden="true" />}
      </div>
      <div className="p-info">
        <h1 className="p-title">{product.name}</h1>
        <ApplicationSign application={product.application} large />
        <section>
          <h2>{site.products.descriptionLabel}</h2>
          {product.description.split(/\n+/).map((paragraph, n) => <p key={n}>{paragraph}</p>)}
        </section>
        <section>
          <h2>Para qué sirve</h2>
          <ul className="p-keywords">
            {product.keywords.map(keyword => <li key={keyword}><Link href={`/?q=${encodeURIComponent(keyword)}`}><Check size={18} weight="bold" aria-hidden="true" />{keyword}</Link></li>)}
          </ul>
        </section>
      </div>
    </article>
  </main>;
}
