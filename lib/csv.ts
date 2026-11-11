import { avoidOptions, normalize, type Catalog, type Plant, type Preparation } from "./catalog.ts";

const headers = ["Nombre", "Usos", "Sinónimos", "Hierbas", "Preparación", "Advertencias", "Notas", "No recomendado en", "Habilitado", "Imagen", "Precio", "Unidad del precio"];
const columnNames: Record<string, string> = {
  nombre: "name", tonico: "name", name: "name",
  usos: "uses", "se utiliza para": "uses",
  sinonimos: "aliases", "tambien buscar por": "aliases", sinonimo: "aliases",
  hierbas: "herbs", ingredientes: "herbs",
  preparacion: "instructions", instrucciones: "instructions",
  advertencias: "warnings", contraindicaciones: "warnings",
  notas: "notes", "notas internas": "notes",
  "no recomendado en": "avoid", evitar: "avoid",
  habilitado: "published", publicado: "published", estado: "published",
  imagen: "image",
  precio: "price", "precio de venta": "price",
  "unidad del precio": "priceUnit", "precio por": "priceUnit",
};

/** Parses CSV text. The delimiter (comma or semicolon) is detected from the first line. */
export function parseCsv(text: string): string[][] {
  const source = text.replace(/^﻿/, "");
  const firstLine = source.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) { row.push(cell); cell = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some(c => c.trim())) rows.push(row);
      row = [];
    } else cell += char;
  }
  row.push(cell);
  if (row.some(c => c.trim())) rows.push(row);
  return rows;
}

const quote = (value: string, delimiter: string) => /["\r\n]/.test(value) || value.includes(delimiter) ? `"${value.replace(/"/g, '""')}"` : value;

/** Builds CSV with a BOM and semicolons, which is what Spanish-locale Excel opens correctly. */
export function exportTonics(catalog: Catalog): string {
  const herb = (id: string) => catalog.plants.find(p => p.id === id)?.name ?? "";
  const rows = catalog.preparations.map(p => [
    p.name, p.uses.join("|"), p.aliases.join("|"),
    p.ingredients.map(i => `${herb(i.plantId)}:${i.amount}`).join("|"),
    p.instructions, p.warnings, p.notes,
    (p.avoid ?? []).map(id => avoidOptions.find(o => o.id === id)?.label ?? id).join("|"),
    p.published ? "Sí" : "No", p.image || "", p.price === undefined ? "" : String(p.price), p.priceUnit || "",
  ]);
  return "﻿" + [headers, ...rows].map(r => r.map(c => quote(c, ";")).join(";")).join("\r\n") + "\r\n";
}

const list = (value: string, commas: boolean) => [...new Set(value.split(commas ? /[|;,\n]/ : /[|;\n]/).map(t => t.trim()).filter(Boolean))];
const parseAvoid = (value: string): string[] => {
  const found = new Set<string>();
  for (const label of list(value, true)) {
    const token = normalize(label);
    if (token.includes("embaraz")) found.add("embarazo");
    else if (token.includes("lactan")) found.add("lactancia");
    else if (/nin|infan|bebe/.test(token)) found.add("ninos");
    else if (token.includes("medic")) found.add("medicacion");
    else found.add(label);
  }
  return [...found];
};
const truthy = (value: string) => ["si", "s", "1", "true", "x", "habilitado", "publicado"].includes(normalize(value));

export type ImportReport = { catalog: Catalog; created: number; updated: number; drafts: string[]; errors: string[] };

/** Merges tonics from CSV text into the catalog. Tonics are matched by name; herbs are created when missing. */
export function importTonics(catalog: Catalog, text: string): ImportReport {
  const report: ImportReport = { catalog, created: 0, updated: 0, drafts: [], errors: [] };
  const rows = parseCsv(text);
  if (rows.length < 2) { report.errors.push("El archivo no tiene filas para importar."); return report; }
  const columns = rows[0].map(h => columnNames[normalize(h)]);
  if (!columns.includes("name") || !columns.includes("herbs")) { report.errors.push("Faltan las columnas Nombre y Hierbas en la primera fila."); return report; }
  const plants: Plant[] = [...catalog.plants];
  const preparations: Preparation[] = [...catalog.preparations];
  rows.slice(1).forEach((cells, index) => {
    const line = index + 2;
    const get = (key: string) => (cells[columns.indexOf(key)] ?? "").trim();
    const name = get("name");
    if (!name) { report.errors.push(`Fila ${line}: falta el nombre.`); return; }
    const entries = list(get("herbs"), false).map(entry => { const cut = entry.indexOf(":"); return cut < 0 ? { name: entry, amount: "" } : { name: entry.slice(0, cut).trim(), amount: entry.slice(cut + 1).trim() }; }).filter(e => e.name);
    if (!entries.length) { report.errors.push(`Fila ${line} (${name}): no tiene hierbas.`); return; }
    const created: Plant[] = [];
    const ingredients = entries.map(entry => {
      let herb = plants.find(p => normalize(p.name) === normalize(entry.name)) ?? created.find(p => normalize(p.name) === normalize(entry.name));
      if (!herb) { herb = { id: crypto.randomUUID(), name: entry.name, scientificName: "", properties: "", uses: [], aliases: [], warnings: "", notes: "", published: true }; created.push(herb); }
      return { plantId: herb.id, amount: entry.amount };
    });
    if (new Set(ingredients.map(i => i.plantId)).size !== ingredients.length) { report.errors.push(`Fila ${line} (${name}): repite una hierba.`); return; }
    plants.push(...created);
    const existing = preparations.find(p => normalize(p.name) === normalize(name));
    const image = columns.includes("image") ? get("image") : existing?.image;
    if (image && !/^\/api\/images\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(image)) { report.errors.push(`Fila ${line} (${name}): la imagen no corresponde a un archivo del catálogo.`); return; }
    const priceText = get("price").replace(/[$s]/g, "").replace(",", ".");
    const price = columns.includes("price") ? (priceText ? Number(priceText) : undefined) : existing?.price;
    if (price !== undefined && (!Number.isFinite(price) || price < 0)) { report.errors.push(`Fila ${line} (${name}): el precio no es un número válido.`); return; }
    const priceUnit = columns.includes("priceUnit") ? get("priceUnit") || undefined : existing?.priceUnit;
    const item: Preparation = {
      // Store fields are not in the CSV, so a re-import keeps them.
      ...(existing ? { hidden: existing.hidden, promoPrice: existing.promoPrice, promoUntil: existing.promoUntil } : {}),
      id: existing?.id ?? crypto.randomUUID(), categoryIds: existing?.categoryIds, name, uses: list(get("uses"), true), aliases: list(get("aliases"), true), ingredients,
      instructions: get("instructions"), warnings: get("warnings"), notes: get("notes"), avoid: parseAvoid(get("avoid")), published: false,
      presentationWeightGrams: existing?.presentationWeightGrams,
      ...(image !== undefined ? { image } : {}),
      ...(price !== undefined ? { price } : {}), ...(priceUnit ? { priceUnit } : {}),
    };
    const complete = Boolean(item.instructions && item.uses.length && ingredients.every(i => i.amount));
    item.published = truthy(get("published")) && complete;
    if (truthy(get("published")) && !complete) report.drafts.push(name);
    if (existing) { preparations[preparations.indexOf(existing)] = item; report.updated++; } else { preparations.push(item); report.created++; }
  });
  report.catalog = { ...catalog, plants, preparations };
  return report;
}


