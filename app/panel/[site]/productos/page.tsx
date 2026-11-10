"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Plus } from "@phosphor-icons/react";
import { Droplet, TriangleExclamationPoint } from "lucide-react";
import { ImageField } from "@/app/catalog-image";
import { Field } from "@/app/admin-fields";
import { SaveForm } from "@/app/save-form";
import { normalize } from "@/lib/catalog";
import { blankProduct, productApplications, productWords, type Product, type ProductApplication } from "@/lib/products";
import type { ProductSiteOptions } from "@/lib/sites";
import { EditorFrame } from "../editors";
import { KeywordInput } from "../keyword-input";
import { EmptyState, Paged, SearchBox, useNewFromLink, useSelection } from "../list-tools";
import { SideSheet } from "../sheet";
import { usePanel } from "../panel-context";
import { useProducts } from "../products-context";
import { PageHeader } from "../shell";

type Words = ReturnType<typeof productWords>;

export default function ProductsPage() {
  const { site: siteId } = useParams<{ site: string }>();
  const { products, options } = useProducts();
  const { busy } = usePanel();
  const { selection, setSelection, select } = useSelection<Product>();
  useNewFromLink(() => setSelection({ item: blankProduct(), mode: "edit" }));
  const [filter, setFilter] = useState("");
  if (!products || !options) return null;
  const words = productWords(options.items);
  const query = normalize(filter);
  const rows = products.filter(p => normalize([p.name, ...p.keywords].join(" ")).includes(query));
  const saved = (id: string) => products.some(p => p.id === id);
  const side = selection?.mode === "delete"
    ? <DeleteProduct product={selection.item} words={words} onCancel={() => setSelection({ item: selection.item, mode: "edit" })} onDeleted={() => setSelection(null)} />
    : selection
      ? <ProductEditor key={selection.item.id} product={selection.item} siteId={siteId} options={options} words={words}
          onSaved={() => setSelection(null)}
          onClose={() => void select(null)}
          onDelete={saved(selection.item.id) ? () => void select({ item: selection.item, mode: "delete" }) : undefined} />
      : null;
  return <>
    <PageHeader title={words.Many} description={`${products.filter(p => p.published).length} ${words.publishedMany} de ${products.length}.`}
      actions={<button className="button primary" disabled={busy} onClick={() => void select({ item: blankProduct(), mode: "edit" })}><Plus size={16} aria-hidden="true" />{words.new}</button>} />
    <div>
      <section className="panel-card panel-list" aria-label={`Lista de ${words.many}`}>
        <div className="panel-list-tools"><SearchBox value={filter} onChange={setFilter} label="Buscar por nombre o para qué sirve" /></div>
        {rows.length > 0 && <Paged rows={rows} resetKey={filter}>{shown => <table className="panel-table">
          <thead><tr><th scope="col">Nombre</th><th scope="col" className="is-hide-sm">Para qué sirve</th>{options.application && <th scope="col" className="w-14 sm:w-32">Uso</th>}</tr></thead>
          <tbody>
            {shown.map(item => <tr key={item.id} aria-selected={selection?.item.id === item.id}>
              <th scope="row"><button className="panel-row-button" disabled={busy} onClick={() => void select({ item, mode: "edit" })}>
                <span role="img" aria-label={item.published ? "Publicado" : "Borrador"} className={`size-2.5 flex-none rounded-full sm:hidden ${item.published ? "bg-green-500" : "bg-amber-400"}`} />
                <span>{item.name}</span>
                {!item.published && <span className="panel-badge is-draft max-sm:hidden">Borrador</span>}
              </button></th>
              <td className="is-hide-sm">{item.keywords.join(", ") || <span className="panel-muted">Sin cargar</span>}</td>
              {options.application && <td>{item.application
                ? <>
                  <span className="max-sm:hidden">{productApplications[item.application].sign}</span>
                  <span role="img" aria-label={productApplications[item.application].sign} title={productApplications[item.application].sign} className="inline-flex sm:hidden">
                    {item.application === "piel" ? <TriangleExclamationPoint size={20} aria-hidden="true" /> : <Droplet size={20} aria-hidden="true" />}
                  </span>
                </>
                : <span className="panel-muted">Sin elegir</span>}</td>}
            </tr>)}
          </tbody>
        </table>}</Paged>}
        {!rows.length && <EmptyState title={filter ? `No encontramos ${words.that}` : `Todavía no hay ${words.many}`} text={filter ? "Probá con otro nombre o frase." : `${words.createFirst} con el botón ${words.new}.`} />}
      </section>
      <SideSheet onClose={() => void select(null)}>{side}</SideSheet>
    </div>
  </>;
}

function ProductEditor({ product, siteId, options, words, onSaved, onClose, onDelete }: { product: Product; siteId: string; options: ProductSiteOptions; words: Words; onSaved: (item: Product) => void; onClose: () => void; onDelete?: () => void }) {
  const { products, save } = useProducts();
  const suggestions = [...new Set((products ?? []).flatMap(p => p.keywords))].sort((a, b) => a.localeCompare(b, "es"));
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
  return <EditorFrame title={product.name || words.new} onClose={onClose} onDelete={onDelete}>
    <SaveForm error={error} registerRef={flushRef} paused={busy} onSave={submit} changes={JSON.stringify([image, keywords])}>
      <Field label="Nombre" name="name" value={product.name} required hint="En el sitio se muestra grande y en mayúsculas." />
      <ImageField label={`Imagen ${words.ofThe}`} value={image} site={siteId} onChange={setImage} onBusy={setBusy} />
      <Field label={options.descriptionLabel} name="description" value={product.description} multiline rows={5} />
      {options.application && <fieldset className="field">
        <legend>Cómo se usa</legend>
        {(Object.keys(productApplications) as ProductApplication[]).map(id => <label className="check" key={id}>
          <input type="radio" name="application" value={id} defaultChecked={product.application === id} />
          {productApplications[id].option}
        </label>)}
        <small>Se muestra como aviso en la tarjeta y en la página {words.ofThe}.</small>
      </fieldset>}
      <KeywordInput value={keywords} onChange={setKeywords} suggestions={suggestions} />
      <label className="check"><input type="checkbox" name="published" defaultChecked={product.published} />{words.Published} en el sitio</label>
    </SaveForm>
  </EditorFrame>;
}

function DeleteProduct({ product, words, onCancel, onDeleted }: { product: Product; words: Words; onCancel: () => void; onDeleted: () => void }) {
  const { busy, error } = usePanel();
  const { remove } = useProducts();
  return <EditorFrame title={`Eliminar ${product.name}`} onClose={onCancel}>
    <p className="panel-muted">{words.The} se elimina del panel y del sitio. Podés deshacerlo desde el aviso que aparece abajo. Si solo querés ocultar{words.it}, desmarcá &quot;{words.Published} en el sitio&quot;.</p>
    {error && <div className="alert error" role="alert">{error}</div>}
    <div className="form-actions">
      <button className="button" disabled={busy} onClick={onCancel}>Cancelar</button>
      <button className="button danger" disabled={busy} onClick={async () => { if (await remove(product.id)) onDeleted(); }}>{busy ? "Eliminando…" : `Eliminar ${words.one}`}</button>
    </div>
  </EditorFrame>;
}
