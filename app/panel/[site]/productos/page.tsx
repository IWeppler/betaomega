"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Package, Plus } from "@phosphor-icons/react";
import { ImageField } from "@/app/catalog-image";
import { Field } from "@/app/admin-fields";
import { SaveForm } from "@/app/save-form";
import { normalize } from "@/lib/catalog";
import { blankProduct, productApplications, type Product, type ProductApplication } from "@/lib/products";
import { findSite, type ProductSiteOptions } from "@/lib/sites";
import { EditorFrame } from "../editors";
import { KeywordInput } from "../keyword-input";
import { EmptyState, SearchBox, useNewFromLink, useSelection } from "../list-tools";
import { usePanel } from "../panel-context";
import { useProducts } from "../products-context";
import { PageHeader } from "../shell";

export default function ProductsPage() {
  const { site: siteId } = useParams<{ site: string }>();
  const options = findSite(siteId)?.products;
  const { products } = useProducts();
  const { busy } = usePanel();
  const { selection, setSelection, select } = useSelection<Product>();
  useNewFromLink(() => setSelection({ item: blankProduct(), mode: "edit" }));
  const [filter, setFilter] = useState("");
  if (!products || !options) return null;
  const query = normalize(filter);
  const rows = products.filter(p => normalize([p.name, ...p.keywords].join(" ")).includes(query));
  const saved = (id: string) => products.some(p => p.id === id);
  const side = selection?.mode === "delete"
    ? <DeleteProduct product={selection.item} onCancel={() => setSelection({ item: selection.item, mode: "edit" })} onDeleted={() => setSelection(null)} />
    : selection
      ? <ProductEditor key={selection.item.id} product={selection.item} siteId={siteId} options={options}
          onSaved={item => setSelection({ item, mode: "edit" })}
          onClose={() => void select(null)}
          onDelete={saved(selection.item.id) ? () => void select({ item: selection.item, mode: "delete" }) : undefined} />
      : null;
  return <>
    <PageHeader title="Productos" description={`${products.filter(p => p.published).length} publicados de ${products.length}.`}
      actions={<button className="button primary" disabled={busy} onClick={() => void select({ item: blankProduct(), mode: "edit" })}><Plus size={16} aria-hidden="true" />Nuevo producto</button>} />
    <div className="panel-split" data-open={side ? "true" : undefined}>
      <section className="panel-card panel-list" aria-label="Lista de productos">
        <div className="panel-list-tools"><SearchBox value={filter} onChange={setFilter} label="Buscar por nombre o para qué sirve" /></div>
        {rows.length > 0 && <table className="panel-table">
          <thead><tr><th scope="col">Nombre</th><th scope="col">Para qué sirve</th>{options.application && <th scope="col">Uso</th>}</tr></thead>
          <tbody>
            {rows.map(item => <tr key={item.id} aria-selected={selection?.item.id === item.id}>
              <th scope="row"><button className="panel-row-button" disabled={busy} onClick={() => void select({ item, mode: "edit" })}>
                <Package size={16} aria-hidden="true" /><span>{item.name}</span>
                {!item.published && <span className="panel-badge is-draft">Borrador</span>}
              </button></th>
              <td>{item.keywords.join(", ") || <span className="panel-muted">Sin cargar</span>}</td>
              {options.application && <td>{item.application ? productApplications[item.application].sign : <span className="panel-muted">Sin elegir</span>}</td>}
            </tr>)}
          </tbody>
        </table>}
        {!rows.length && <EmptyState title={filter ? "No encontramos ese producto" : "Todavía no hay productos"} text={filter ? "Probá con otro nombre o frase." : "Creá el primero con el botón Nuevo producto."} />}
      </section>
      <div className="panel-side">{side ?? <EmptyState title="Elegí un producto" text="Seleccioná un producto de la lista para editarlo, o creá uno nuevo." />}</div>
    </div>
  </>;
}

function ProductEditor({ product, siteId, options, onSaved, onClose, onDelete }: { product: Product; siteId: string; options: ProductSiteOptions; onSaved: (item: Product) => void; onClose: () => void; onDelete?: () => void }) {
  const { save } = useProducts();
  const { busy, setBusy, error, flushRef } = usePanel();
  const [image, setImage] = useState(product.image ?? "");
  const [keywords, setKeywords] = useState(product.keywords);
  const submit = async (element: HTMLFormElement) => {
    const form = new FormData(element);
    const application = form.get("application");
    const stored = await save({
      id: product.id,
      slug: product.slug,
      name: String(form.get("name") || "").trim(),
      ...(image ? { image } : {}),
      description: String(form.get("description") || "").trim(),
      keywords,
      ...(application ? { application: application as ProductApplication } : {}),
      published: form.get("published") === "on",
    });
    if (stored) onSaved(stored);
    return Boolean(stored);
  };
  return <EditorFrame title={product.name || "Nuevo producto"} onClose={onClose} onDelete={onDelete}>
    <SaveForm error={error} registerRef={flushRef} paused={busy} onSave={submit} changes={JSON.stringify([image, keywords])}>
      <Field label="Nombre" name="name" value={product.name} required hint="En el sitio se muestra grande y en mayúsculas." />
      <ImageField label="Imagen del producto" value={image} site={siteId} onChange={setImage} onBusy={setBusy} />
      <Field label={options.descriptionLabel} name="description" value={product.description} multiline rows={5} />
      {options.application && <fieldset className="field">
        <legend>Cómo se usa</legend>
        {(Object.keys(productApplications) as ProductApplication[]).map(id => <label className="check" key={id}>
          <input type="radio" name="application" value={id} defaultChecked={product.application === id} />
          {productApplications[id].option}
        </label>)}
        <small>Se muestra como aviso en la tarjeta y en la página del producto.</small>
      </fieldset>}
      <KeywordInput value={keywords} onChange={setKeywords} />
      <label className="check"><input type="checkbox" name="published" defaultChecked={product.published} />Publicado en el sitio</label>
    </SaveForm>
  </EditorFrame>;
}

function DeleteProduct({ product, onCancel, onDeleted }: { product: Product; onCancel: () => void; onDeleted: () => void }) {
  const { busy, error } = usePanel();
  const { remove } = useProducts();
  return <EditorFrame title={`Eliminar ${product.name}`} onClose={onCancel}>
    <p className="panel-muted">El producto se elimina del panel y del sitio. No se puede deshacer. Si solo querés ocultarlo, desmarcá &quot;Publicado en el sitio&quot;.</p>
    {error && <div className="alert error" role="alert">{error}</div>}
    <div className="form-actions">
      <button className="button" disabled={busy} onClick={onCancel}>Cancelar</button>
      <button className="button danger" disabled={busy} onClick={async () => { if (await remove(product.id)) onDeleted(); }}>{busy ? "Eliminando…" : "Eliminar producto"}</button>
    </div>
  </EditorFrame>;
}
