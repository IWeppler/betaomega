"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ImageSquare, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { searchProducts, type Product } from "@/lib/products";
import { ApplicationSign } from "./application-sign";

/** Search box and grid. The search stays in the address (?q=), so the "para qué sirve" links and shared searches open it filled in. */
export function ProductBrowser({ products, initialQuery }: { products: Product[]; initialQuery: string }) {
  const [query, setQuery] = useState(initialQuery);
  const results = searchProducts(products, query);
  const change = (value: string) => {
    setQuery(value);
    const url = new URL(window.location.href);
    if (value.trim()) url.searchParams.set("q", value); else url.searchParams.delete("q");
    window.history.replaceState(null, "", url);
  };
  return <>
    <label className="p-search">
      <span>Buscá por nombre o para qué sirve</span>
      <span className="p-search-box">
        <MagnifyingGlass size={22} aria-hidden="true" />
        <input type="search" value={query} onChange={e => change(e.target.value)} autoComplete="off" />
      </span>
    </label>
    <p className="sr-only" role="status">{results.length === 1 ? "1 producto" : `${results.length} productos`}</p>
    {results.length > 0
      ? <ul className="p-grid">
        {results.map(product => <li key={product.id}>
          <Link href={`/${product.slug}`} className="p-card">
            <span className="p-photo">
              {product.image
                ? <Image src={product.image} alt="" fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px" unoptimized />
                : <ImageSquare size={48} aria-hidden="true" />}
            </span>
            <h2>{product.name}</h2>
          </Link>
          <ApplicationSign application={product.application} />
        </li>)}
      </ul>
      : <p className="p-empty">No encontramos productos para “{query.trim()}”. Probá con otra palabra.</p>}
  </>;
}
