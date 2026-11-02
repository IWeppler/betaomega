"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Leaf, MagnifyingGlass, X } from "@phosphor-icons/react";
import { WhatsappIcon } from "@/app/whatsapp-icon";
import { normalize, type Category } from "@/lib/catalog";
import { AddButton } from "./cart";

export type Product = { id: string; key: string; slug: string; name: string; detail: string; price: string; regularPrice?: string; image?: string; tonic: boolean; categoryId: string };
export type ComboCardData = { key: string; slug: string; name: string; description: string; price: string; regularPrice?: string; savings?: string; image?: string; items: { name: string; qty: number }[] };

function Photo({ name, image }: { name: string; image?: string }) {
  const [failed, setFailed] = useState(false);
  return <div className="product-photo">
    <Leaf size={44} weight="duotone" aria-hidden="true" />
    {image && !failed && <Image src={image} alt={name} width={480} height={480} unoptimized onError={() => setFailed(true)} />}
  </div>;
}

/** The crossed-out regular price shown during a promotion. */
export function WasPrice({ children }: { children: string }) {
  return <s className="price-was"><span className="sr-only">Precio anterior: </span>{children}</s>;
}

function Card({ product, whatsapp }: { product: Product; whatsapp: string }) {
  const message = `Hola, quiero consultar por ${product.name}${product.price ? ` (${product.price})` : ""}.`;
  return <li className="product">
    <Photo name={product.name} image={product.image} />
    {product.regularPrice && <span className="promo-badge">Oferta</span>}
    <div className="product-body">
      <h3><Link className="product-link" href={`/${product.slug}`}>{product.name}</Link></h3>
      {product.detail && <p>{product.detail}</p>}
      <div className="product-foot">
        {product.price ? <p className="product-price-line">{product.regularPrice && <WasPrice>{product.regularPrice}</WasPrice>}<strong className="product-price">{product.price}</strong></p> : <span className="product-price is-consult">Consultar</span>}
        <div className="product-actions">
          <AddButton offerKey={product.key} name={product.name} />
          {whatsapp && <a className="product-ask no-print" href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" aria-label={`Consultar por ${product.name} por WhatsApp`}><WhatsappIcon size={24} /></a>}
        </div>
      </div>
    </div>
  </li>;
}

function ComboCard({ combo }: { combo: ComboCardData }) {
  return <li className="product combo-card">
    <Photo name={combo.name} image={combo.image} />
    {combo.savings && <span className="promo-badge">Combo</span>}
    <div className="product-body">
      <h3><Link className="product-link" href={`/combos/${combo.slug}`}>{combo.name}</Link></h3>
      <p>{combo.items.map(i => `${i.qty} x ${i.name}`).join(", ")}</p>
      <div className="product-foot">
        <p className="product-price-line">{combo.regularPrice && <WasPrice>{combo.regularPrice}</WasPrice>}<strong className="product-price">{combo.price}</strong></p>
        {combo.savings && <span className="combo-savings">Ahorrás {combo.savings}</span>}
        <div className="product-actions"><AddButton offerKey={combo.key} name={combo.name} /></div>
      </div>
    </div>
  </li>;
}

export function Storefront({ products, combos, categories, whatsapp }: { products: Product[]; combos: ComboCardData[]; categories: Category[]; whatsapp: string }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const q = normalize(query);
  const matches = (p: Product) => (!category || p.categoryId === category) && (!q || normalize(`${p.name} ${p.detail}`).includes(q));
  const shown = products.filter(matches);
  const shownCombos = category ? [] : combos.filter(c => !q || normalize(`${c.name} ${c.items.map(i => i.name).join(" ")}`).includes(q));
  const grouped = !q && !category;
  const nothing = !shown.length && !shownCombos.length;
  return <>
    <div className="shop-bar no-print">
      <div className="shop-search">
        <MagnifyingGlass size={22} aria-hidden="true" />
        <input type="search" aria-label="Buscar en el catálogo" placeholder="Buscar hierbas o tónicos" value={query} onChange={e => setQuery(e.target.value)} autoComplete="off" spellCheck={false} />
        {query && <button aria-label="Borrar búsqueda" onClick={() => setQuery("")}><X size={20} aria-hidden="true" /></button>}
      </div>
      <div className="shop-chips" role="group" aria-label="Categorías">
        <button aria-pressed={!category} onClick={() => setCategory("")}>Todo <span>{products.length}</span></button>
        {categories.map(c => <button key={c.id} aria-pressed={category === c.id} onClick={() => setCategory(current => current === c.id ? "" : c.id)}>{c.label} <span>{products.filter(p => p.categoryId === c.id).length}</span></button>)}
      </div>
    </div>
    {nothing && <div className="shop-empty" role="status">
      <p>{products.length ? `No encontramos productos${query ? ` para “${query}”` : ""}.` : "Todavía no hay productos en el catálogo."}</p>
      {products.length > 0 && <button className="button" onClick={() => { setQuery(""); setCategory(""); }}>Ver todo el catálogo</button>}
    </div>}
    {shownCombos.length > 0 && <section className="shop-section" aria-labelledby="shop-combos"><h2 id="shop-combos">Combos</h2><ul className="product-grid">{shownCombos.map(c => <ComboCard key={c.key} combo={c} />)}</ul></section>}
    {grouped
      ? categories.map(c => { const list = shown.filter(p => p.categoryId === c.id); return list.length ? <section className="shop-section" key={c.id} aria-labelledby={`cat-${c.id}`}><h2 id={`cat-${c.id}`}>{c.label}</h2><ul className="product-grid">{list.map(p => <Card key={p.id} product={p} whatsapp={whatsapp} />)}</ul></section> : null; })
      : shown.length > 0 && <ul className="product-grid" aria-live="polite">{shown.map(p => <Card key={p.id} product={p} whatsapp={whatsapp} />)}</ul>}
  </>;
}
