import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { adaptLegacyCatalog, resolveCatalogPrices } from "../modules/herbal/index.ts";
import { validateCatalog } from "../platform/catalog/index.ts";

const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const hash = value => createHash("sha256").update(canonical(value)).digest("hex");
const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const secret = process.env.SUPABASE_SECRET_KEY;
if (!base || !secret) throw Error("Falta la configuración de Supabase.");
const headers = { apikey: secret, Authorization: `Bearer ${secret}`, "Content-Type": "application/json" };
const folder = "data/herbal-h4";
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
mkdirSync(folder, { recursive: true });

async function readCurrent() {
  const response = await fetch(`${base}/rest/v1/app_data?key=eq.catalog&select=data,revision,updated_at`, { headers, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw Error(`No se pudo leer el catálogo: HTTP ${response.status}.`);
  const rows = await response.json();
  if (rows.length !== 1) throw Error("No hay un catálogo único guardado. No se usan datos de ejemplo.");
  const row = rows[0];
  validateCatalog(row.data);
  if (row.revision !== row.data.revision) throw Error("La revisión del documento no coincide con la del catálogo.");
  return row;
}
function prepare(catalog, options = {}) {
  const result = adaptLegacyCatalog(catalog, options);
  const after = resolveCatalogPrices(result.catalog);
  validateCatalog(after);
  return { ...result, catalog: after };
}

if (process.argv[2] === "--apply") {
  if (!process.argv[3]) throw Error("Indicá el archivo del plan revisado.");
  const plan = JSON.parse(readFileSync(process.argv[3], "utf8"));
  const result = prepare(plan.before.data, plan.options);
  if (hash(result.catalog) !== hash(plan.after) || hash(plan.before.data) !== plan.beforeHash) throw Error("El plan no coincide con la transformación segura actual.");
  const current = await readCurrent();
  if (current.revision !== plan.before.revision || hash(current.data) !== plan.beforeHash) throw Error("El catálogo cambió después del análisis. Generá un plan nuevo.");
  if (hash(result.catalog) === hash(current.data)) { console.log("Sin cambios para aplicar."); process.exit(0); }
  const backup = `${folder}/catalog-before-apply-${stamp}.json`;
  writeFileSync(backup, JSON.stringify(current, null, 2), { flag: "wx" });
  const payload = { ...result.catalog, revision: current.data.revision + 1 };
  const response = await fetch(`${base}/rest/v1/rpc/save_catalog`, { method: "POST", headers, body: JSON.stringify({ expected: current.data.revision, payload }), signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw Error(`No se pudo guardar: HTTP ${response.status}. Conservá el respaldo y verificá antes de reintentar.`);
  const saved = await response.json();
  if (!saved) throw Error("Conflicto de revisión: la adaptación no se guardó.");
  const verified = await readCurrent();
  if (hash(verified.data) !== hash(payload)) throw Error("La lectura posterior difiere del resultado esperado. Revisá el catálogo antes de continuar.");
  const receipt = { backup, plan: process.argv[3], revisionBefore: current.revision, revisionAfter: verified.revision, beforeHash: plan.beforeHash, afterHash: hash(verified.data), convertedKgPrices: result.convertedKgPrices, addedSteps: result.addedSteps, assignedPresentations: result.assignedPresentations, pendingIssues: result.issues.length };
  writeFileSync(`${folder}/receipt-${stamp}.json`, JSON.stringify(receipt, null, 2), { flag: "wx" });
  console.log(JSON.stringify(receipt, null, 2));
} else if (!process.argv[2] || (process.argv[2] === "--presentation-grams" && process.argv.length === 4)) {
  const options = process.argv[2] ? { presentationGrams: Number(process.argv[3]) } : {};
  const before = await readCurrent();
  const result = prepare(before.data, options);
  const backup = `${folder}/catalog-before-${stamp}.json`;
  const path = `${folder}/plan-${stamp}.json`;
  writeFileSync(backup, JSON.stringify(before, null, 2), { flag: "wx" });
  const plan = { before, options, beforeHash: hash(before.data), after: result.catalog, issues: result.issues, convertedKgPrices: result.convertedKgPrices, addedSteps: result.addedSteps, recognizedFormulas: result.recognizedFormulas, assignedPresentations: result.assignedPresentations };
  writeFileSync(path, JSON.stringify(plan, null, 2), { flag: "wx" });
  writeFileSync(`${folder}/pending-${stamp}.csv`, "\uFEFFTipo;ID;Nombre;Campo;Pendiente\n" + result.issues.map(issue => [issue.kind, issue.id, issue.name, issue.field, issue.reason].map(value => `"${value.replaceAll('"', '""')}"`).join(";")).join("\n"), { flag: "wx" });
  console.log(JSON.stringify({ plan: path, backup, revision: before.revision, plants: before.data.plants.length, tonics: before.data.preparations.length, convertedKgPrices: result.convertedKgPrices, addedSteps: result.addedSteps, recognizedFormulas: result.recognizedFormulas, assignedPresentations: result.assignedPresentations, pendingIssues: result.issues.length, changed: hash(result.catalog) !== hash(before.data) }, null, 2));
} else throw Error("Usá sin argumentos para analizar o --apply <plan.json> para aplicar el plan.");
