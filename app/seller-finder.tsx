"use client";

import { useState, type ComponentType } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, CaretDown, Check, Funnel, Leaf, MagnifyingGlass, WarningCircle, X } from "@phosphor-icons/react";
import { CatalogImage } from "./catalog-image";
import { avoidOptions, getAvoidOptions, categoryOptions, getCategories, itemCategories, type Catalog, type Plant, type Preparation } from "@/lib/catalog";

type Props = {
  PriceDisplay: ComponentType<{ item: Plant | Preparation }>;
  selectedId?: string; catalog: Catalog | null; query: string; onQuery: (query: string) => void;
  results: Preparation[]; herbs: Plant[]; onOpenHerb: (plant: Plant) => void;
  isDraft: (id: string) => boolean; onOpen: (prep: Preparation) => void;
  profile: string[]; onProfile: (value: string[]) => void; onExit: () => void;
};

const avoidLabel = (id: string) => avoidOptions.find(o => o.id === id)?.label ?? id;

function Thumbnail({ image, name, tonic = false }: { image?: string; name: string; tonic?: boolean }) {
  return <span className={`catalog-thumb${tonic ? " tonic-thumb" : ""}`}><Leaf size={25} weight={tonic ? "duotone" : "regular"} aria-hidden="true" /><CatalogImage image={image} name={name} /></span>;
}

export function Finder({ catalog, query, onQuery, results, herbs, onOpenHerb, isDraft, onOpen, profile, onProfile, onExit, selectedId, PriceDisplay }: Props) {
  const [kind, setKind] = useState<"all" | "tonics" | "herbs">("all");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const searching = query.trim().length > 0;
  const categories = getCategories(catalog).map(c => ({ ...c, position: categoryOptions.find(o => o.id === c.id)?.position ?? "50%" }));
  const categoryResults = selectedCategory ? results.filter(item => itemCategories(item).includes(selectedCategory)) : results;
  const categoryHerbs = selectedCategory ? herbs.filter(item => itemCategories(item).includes(selectedCategory)) : herbs;
  const suitable = categoryResults.filter(prep => !(prep.avoid ?? []).some(id => profile.includes(id)));
  const hidden = categoryResults.length - suitable.length;
  const preparations = kind === "herbs" ? [] : suitable;
  const plants = kind === "tonics" ? [] : categoryHerbs;
  const updateQuery = (value: string) => { onQuery(value); setSelectedCategory(""); };
  const toggleProfile = (id: string) => onProfile(profile.includes(id) ? profile.filter(p => p !== id) : [...profile, id]);
  return <section className="seller-finder">
    <div className="seller-return"><button aria-label="Volver a seleccionar rol" onClick={onExit}><ArrowLeft size={22} aria-hidden="true" />Volver</button><Link href="/">Catálogo con precios</Link></div>
    <div className="seller-search"><MagnifyingGlass size={37} weight="regular" aria-hidden="true" /><input type="search" aria-label="Buscar hierbas, tónicos o usos" placeholder="Buscar" value={query} onChange={e => updateQuery(e.target.value)} inputMode="search" enterKeyHint="search" autoComplete="off" spellCheck={false} />{query && <button className="search-reset" aria-label="Borrar búsqueda" onClick={() => updateQuery("")}><X size={24} aria-hidden="true" /></button>}</div>

    {!searching && <section className="seller-section"><h2>Categorías</h2><div className="category-strip">{categories.map(category => {
      const custom = catalog?.categoryImages?.[category.id];
      return <button className={`category-tile category-${category.id}`} key={category.id} aria-pressed={selectedCategory === category.id} onClick={() => { setKind("all"); setSelectedCategory(current => current === category.id ? "" : category.id); onQuery(""); }}>
        {custom ? <CatalogImage image={custom} name="" className="category-photo" /> : <span className={`category-photo ${categoryOptions.some(c => c.id === category.id) ? "category-fallback" : "category-empty"}`} style={{ backgroundPosition: `${category.position} center` }} aria-hidden="true" />}
        <span className="category-label">{category.label}</span><span className="category-arrow" aria-hidden="true"><ArrowUpRight size={18} /></span>
      </button>;
    })}</div></section>}

    <section className="seller-section seller-catalog"><div className="catalog-heading"><h2>{searching ? "Resultados" : "Catálogo"}</h2>
      <button className="filter-toggle desktop-filter" aria-expanded={filterOpen} aria-controls="customer-filter" onClick={() => setFilterOpen(open => !open)}><Funnel size={20} weight={profile.length ? "fill" : "regular"} aria-hidden="true" />Situación del cliente{profile.length > 0 && <span className="filter-count" aria-label={`${profile.length} seleccionadas`}>{profile.length}</span>}<CaretDown className="filter-caret" size={16} aria-hidden="true" /></button></div>
      <div className="catalog-controls"><div className="catalog-kinds" role="group" aria-label="Tipo de resultado">{([{ id: "all", label: "Todo" }, { id: "tonics", label: "Tónicos" }, { id: "herbs", label: "Hierbas" }] as const).map(option => <button key={option.id} aria-pressed={kind === option.id} onClick={() => { setKind(option.id); setSelectedCategory(""); }}>{option.label}</button>)}</div><button className="filter-toggle mobile-filter" aria-label="Situación del cliente" aria-expanded={filterOpen} aria-controls="customer-filter" onClick={() => setFilterOpen(open => !open)}><Funnel size={20} weight={profile.length ? "fill" : "regular"} aria-hidden="true" /><span>Situación</span>{profile.length > 0 && <span className="filter-count">{profile.length}</span>}</button></div>
      {filterOpen && <div id="customer-filter" className="filter-panel" role="group" aria-label="Situación del cliente">
        {getAvoidOptions(catalog).map(option => <label key={option.id} className="filter-option"><input type="checkbox" checked={profile.includes(option.id)} onChange={() => toggleProfile(option.id)} /><span className="filter-box" aria-hidden="true"><Check size={14} weight="bold" /></span>{option.label}</label>)}
        {profile.length > 0 && <button className="filter-clear" onClick={() => onProfile([])}>Limpiar</button>}
      </div>}
      {profile.length > 0 && <p className="filter-summary" role="status"><WarningCircle size={18} weight="fill" aria-hidden="true" />Ocultando tónicos no recomendados para {profile.map(avoidLabel).join(", ").toLowerCase()}{hidden > 0 && ` (${hidden})`}.</p>}

      <div className="seller-results" aria-live="polite" aria-busy={!catalog}>
        {!catalog && <p className="seller-loading" role="status">Cargando el catálogo…</p>}
        {catalog && preparations.length > 0 && <><h3 className="catalog-group-label">Tónicos <span>{preparations.length}</span></h3><ul className="seller-catalog-list">{preparations.map(prep => <li key={prep.id}><button aria-current={selectedId === prep.id ? "true" : undefined} className="seller-catalog-row" onClick={() => onOpen(prep)}><Thumbnail image={prep.image} name={prep.name} tonic /><span className="seller-row-copy"><strong>{prep.name}</strong>{isDraft(prep.id) && <span className="seller-row-warning">Borrador · vista previa</span>}<PriceDisplay item={prep} /></span><ArrowUpRight className="seller-row-arrow" size={18} aria-hidden="true" /></button></li>)}</ul></>}
        {catalog && plants.length > 0 && <><h3 className="catalog-group-label">Hierbas <span>{plants.length}</span></h3><ul className="seller-catalog-list">{plants.map(plant => <li key={plant.id}><button aria-current={selectedId === plant.id ? "true" : undefined} className="seller-catalog-row" onClick={() => onOpenHerb(plant)}><Thumbnail image={plant.image} name={plant.name} /><span className="seller-row-copy"><strong>{plant.name}</strong><span className="seller-row-description">Hierba individual</span><span className="seller-row-tags">{plant.uses.slice(0, 3).map(use => <span key={use}>{use}</span>)}</span><PriceDisplay item={plant} /></span><ArrowUpRight className="seller-row-arrow" size={18} aria-hidden="true" /></button></li>)}</ul></>}
        {catalog && !preparations.length && !plants.length && <div className="seller-empty"><h3>No encontramos fichas{query ? ` para “${query}”` : ""}.</h3><p>{hidden > 0 ? "Hay tónicos ocultos por la situación del cliente." : "Probá otra palabra o cambiá el tipo de resultado."}</p><button onClick={() => { setKind("all"); updateQuery(""); }}>Ver todo el catálogo</button></div>}
      </div>
    </section>
    <p className="seller-footer">Ñekurel <span>·</span></p>
  </section>;
}
