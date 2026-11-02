"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Leaf,
  MagnifyingGlass,
  Plus,
  Storefront,
  LockKey,
  Trash,
  UploadSimple,
  WifiSlash,
  X,
} from "@phosphor-icons/react";
import Image from "next/image";
import { TonicDetail, HerbDetail } from "@/app/finder";
import { Finder } from "@/app/seller-finder";
import { ImageField } from "@/app/catalog-image";
import { HerbCombobox } from "@/app/herb-combobox";
import { Screen } from "@/app/screen";
import { CategoryPicker } from "@/app/category-picker";
import { CategoryImageEditor } from "@/app/category-images";
import { AvoidSelector } from "@/app/avoid-selector";
import { SaveForm } from "@/app/save-form";
import { StoreTab } from "@/app/store-tab";
import { api, blankTonic, Field, newHerb, parsePrice, PriceFields, proportions, splitTags } from "@/app/admin-fields";
import {
  getAvoidOptions,
  getCategories,
  combosUsing,
  formatPrice,
  normalize,
  searchCatalog,
  type Catalog,
  type Plant,
  type Preparation,
} from "@/lib/catalog";
import { importTonics, type ImportReport } from "@/lib/csv";

type Tab = "search" | "tonics" | "herbs" | "store";
type Draft = { name: string; amount: string };
const labels = { tonics: "Tónicos", herbs: "Hierbas", store: "Tienda" };
export default function Home() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const catalogRef = useRef<Catalog | null>(null);
  useEffect(() => {
    catalogRef.current = catalog;
  }, [catalog]);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [adminAccess, setAdmin] = useState(false);
  const [role, setRole] = useState<"seller" | "admin" | null>(null);
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1100px)");
    const update = () => setDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const admin = role === "admin" && adminAccess;
  const [online, setOnline] = useState(true);
  const [tab, setTab] = useState<Tab>("search");
  const [query, setQuery] = useState("");
  const [profile, setProfile] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [login, setLogin] = useState<false | "admin" | "seller">(false);
  const [sellerAccess, setSeller] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [editor, setEditor] = useState<Preparation | null>(null);
  const [herbEditor, setHerbEditor] = useState<Plant | null>(null);
  const [herbDetail, setHerbDetail] = useState<Plant | null>(null);
  const [avoid, setAvoid] = useState<string[]>([]);
  const [image, setImage] = useState("");
  const [detail, setDetail] = useState<Preparation | null>(null);
  const [busy, setBusy] = useState(false);
  const [categoryEditor, setCategoryEditor] = useState(false);
  const [formError, setFormError] = useState("");
  const [preview, setPreview] = useState(false);
  const [deleting, setDeleting] = useState<Preparation | Plant | null>(null);
  const flushEditor = useRef<() => Promise<boolean>>(async () => true);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [storeDirty, setStoreDirty] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const load = useCallback(async () => {
    try {
      // Offline, the session cannot be checked: assume a seller and let the server (or the cached catalogue) decide.
      const session = await api<{ admin: boolean; seller: boolean }>(
        "/api/session",
      ).catch(() => ({ admin: false, seller: true }));
      setSeller(session.seller);
      if (!role) {
        setAdmin(session.admin);
        return;
      }
      if (role === "seller" && !session.seller) {
        setRole(null);
        setLoginError("");
        setLogin("seller");
        return;
      }
      const data = await api<Catalog>(
        role === "admin" ? "/api/catalog" : "/api/catalog?scope=public",
      );
      setAdmin(session.admin);
      setCatalog(data);
      setError("");
      if (!session.admin) {
        setTab("search");
        setPreview(false);
        if (role === "admin") setRole(null);
      }
      setUsage(
        await api<Record<string, number>>("/api/usage").catch(() => ({})),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }, [role]);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);
  useEffect(() => {
    const refresh = () => {
      if (
        !editor &&
        !herbEditor &&
        !categoryEditor &&
        !deleting &&
        !login &&
        !busy &&
        !report &&
        !storeDirty
      )
        void load();
    };
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 30000);
    return () => {
      window.removeEventListener("focus", refresh);
      window.clearInterval(timer);
    };
  }, [
    load,
    editor,
    herbEditor,
    categoryEditor,
    deleting,
    login,
    busy,
    report,
    storeDirty,
  ]);
  const plantName = useCallback(
    (id: string) =>
      catalog?.plants.find((p) => p.id === id)?.name || "Hierba no disponible",
    [catalog],
  );
  const openEditor = async (tonic: Preparation) => {
    if (!(await flushEditor.current())) return;
    tonic =
      catalogRef.current?.preparations.find((p) => p.id === tonic.id) ?? tonic;
    setHerbEditor(null);
    setDeleting(null);
    setEditor(tonic);
    setAvoid(tonic.avoid ?? []);
    setImage(tonic.image || "");
    setFormError("");
    setDrafts(
      tonic.ingredients.map((i) => ({
        name: plantName(i.plantId),
        amount: i.amount,
      })),
    );
  };
  const openHerbEditor = async (plant: Plant) => {
    if (!(await flushEditor.current())) return;
    plant = catalogRef.current?.plants.find((p) => p.id === plant.id) ?? plant;
    setEditor(null);
    setDeleting(null);
    setHerbEditor(plant);
    setImage(plant.image || "");
    setFormError("");
  };
  const openDetail = (prep: Preparation) => {
    setHerbDetail(null);
    setDetail(prep);
    if (admin) return;
    setUsage((u) => ({ ...u, [prep.id]: (u[prep.id] ?? 0) + 1 }));
    void fetch("/api/usage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: prep.id }),
    }).catch(() => undefined);
  };
  const save = async (next: Catalog) => {
    setBusy(true);
    setFormError("");
    try {
      const saved = await api<Catalog>("/api/catalog", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      catalogRef.current = saved;
      setCatalog(saved);
      return true;
    } catch (e) {
      setFormError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const submitEditor = async (element: HTMLFormElement): Promise<boolean> => {
    if (!editor || !catalog) return false;
    if (!element.checkValidity()) {
      setFormError("Completá el nombre y los campos requeridos.");
      return false;
    }
    const form = new FormData(element);
    const text = (key: string) => String(form.get(key) || "").trim();
    if (!drafts.length || drafts.some((d) => !d.name.trim())) {
      setFormError("Agregá al menos una hierba y completá todos los nombres.");
      return false;
    }
    const plants = [...catalog.plants];
    const ingredients = drafts.map((d) => {
      let herb = plants.find((p) => normalize(p.name) === normalize(d.name));
      if (!herb) {
        herb = newHerb(d.name.trim());
        plants.push(herb);
      }
      return { plantId: herb.id, amount: d.amount.trim() };
    });
    if (
      new Set(ingredients.map((i) => i.plantId)).size !== ingredients.length
    ) {
      setFormError("Hay una hierba repetida en este tónico.");
      return false;
    }
    const item: Preparation = {
      ...editor,
      image,
      name: text("name"),
      uses: splitTags(text("uses")),
      aliases: splitTags(text("aliases")),
      warnings: text("warnings"),
      notes: editor.notes,
      categoryIds: form.getAll("categoryIds").map(String),
      published: true,
      ingredients,
      instructions: text("instructions"),
      avoid,
      price: parsePrice(text("price")),
      priceUnit: text("priceUnit") || undefined,
      promoPrice: parsePrice(text("promoPrice")),
      promoUntil: text("promoUntil") || undefined,
      hidden: form.get("visible") ? undefined : true,
    };
    const next = {
      ...catalog,
      plants,
      preparations: [
        ...catalog.preparations.filter((p) => p.id !== item.id),
        item,
      ],
    };
    if (!(await save(next))) return false;
    setEditor(item);
    return true;
  };
  const submitHerb = async (element: HTMLFormElement): Promise<boolean> => {
    if (!herbEditor || !catalog) return false;
    if (!element.checkValidity()) {
      setFormError("Completá el nombre de la hierba.");
      return false;
    }
    const form = new FormData(element);
    const text = (key: string) => String(form.get(key) || "").trim();
    if (
      catalog.plants.some(
        (p) =>
          p.id !== herbEditor.id &&
          normalize(p.name) === normalize(text("name")),
      )
    ) {
      setFormError("Ya existe una hierba con ese nombre. Editá su ficha.");
      return false;
    }
    const item: Plant = {
      ...herbEditor,
      image,
      name: text("name"),
      scientificName: text("scientificName"),
      properties: text("properties"),
      uses: splitTags(text("uses")),
      aliases: splitTags(text("aliases")),
      warnings: text("warnings"),
      notes: herbEditor.notes,
      categoryIds: form.getAll("categoryIds").map(String),
      published: true,
      price: parsePrice(text("price")),
      priceUnit: text("priceUnit") || undefined,
      promoPrice: parsePrice(text("promoPrice")),
      promoUntil: text("promoUntil") || undefined,
      hidden: form.get("visible") ? undefined : true,
    };
    if (
      !(await save({
        ...catalog,
        plants: [...catalog.plants.filter((p) => p.id !== item.id), item],
      }))
    )
      return false;
    setHerbEditor(item);
    return true;
  };
  const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setLoginError("");
    const secret = new FormData(event.currentTarget).get("secret");
    const seller = login === "seller";
    try {
      await api("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(seller ? { code: secret } : { password: secret }),
      });
      setCatalog(null);
      setPreview(false);
      if (seller) {
        setSeller(true);
        setRole("seller");
        setTab("search");
      } else {
        setAdmin(true);
        setRole("admin");
        setTab("tonics");
      }
      setLogin(false);
    } catch (e) {
      setLoginError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const logout = async () => {
    if (!(await flushEditor.current())) return;
    try {
      if (adminAccess) await api("/api/session", { method: "DELETE" });
      setAdmin(false);
      setPreview(false);
      setTab("search");
      setDetail(null);
      setHerbDetail(null);
      setQuery("");
      setProfile([]);
      setRole(null);
      setCatalog(null);
      setEditor(null);
      setHerbEditor(null);
      setDeleting(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const chooseCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!(await flushEditor.current())) return;
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !catalog) return;
    if (file.size > 1_500_000) {
      setError("El archivo es demasiado grande.");
      return;
    }
    setFormError("");
    setReport(importTonics(catalogRef.current ?? catalog, await file.text()));
  };

  const searchedCatalog =
    catalog && preview && admin
      ? {
          ...catalog,
          preparations: catalog.preparations.map((p) => ({
            ...p,
            published: true,
          })),
        }
      : catalog;
  const searchResults = searchedCatalog
    ? searchCatalog(searchedCatalog, query)
    : { preparations: [], plants: [] };
  const found = searchResults.preparations;
  const searching = query.trim().length > 0;
  const byUsage = searching
    ? found
    : [...found].sort(
        (a, b) =>
          (usage[b.id] ?? 0) - (usage[a.id] ?? 0) ||
          a.name.localeCompare(b.name, "es"),
      );
  const isFlagged = (p: Preparation) =>
    (p.avoid ?? []).some((id) => profile.includes(id));
  const ordered = profile.length
    ? [...byUsage.filter((p) => !isFlagged(p)), ...byUsage.filter(isFlagged)]
    : byUsage;
  const herbOptions = (catalog?.plants ?? [])
    .map((p) => ({
      id: p.id,
      name: p.name,
      tonics:
        catalog?.preparations.filter((t) =>
          t.ingredients.some((i) => i.plantId === p.id),
        ).length ?? 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  const matches = (name: string) => normalize(name).includes(normalize(filter));
  const setDraft = (index: number, patch: Partial<Draft>) =>
    setDrafts(drafts.map((d, n) => (n === index ? { ...d, ...patch } : d)));

  const adminWorkspace =
    admin && desktop && (tab === "tonics" || tab === "herbs");
  const screenOpen = Boolean(
    login ||
    (categoryEditor && admin) ||
    (!adminWorkspace &&
      ((editor && admin) || (herbEditor && admin) || (deleting && admin))) ||
    detail ||
    herbDetail ||
    (report && admin),
  );
  const tonicEditor = editor && admin && (
    <Screen
      key={editor.id}
      inline={adminWorkspace}
      title={editor.name ? `${editor.name}` : "Nuevo tónico"}
      onClose={async () => {
        if (!busy && (await flushEditor.current())) setEditor(null);
      }}
    >
      <SaveForm
        error={formError}
        key={editor.id}
        registerRef={flushEditor}
        paused={busy}
        onSave={submitEditor}
        changes={JSON.stringify([drafts, image, avoid])}
      >
        <Field
          label="Nombre del tónico"
          name="name"
          value={editor.name}
          required
        />
        <ImageField value={image} onChange={setImage} onBusy={setBusy} />
        {catalog && <CategoryPicker catalog={catalog} item={editor} />}
        <PriceFields item={editor} />
        <div className="form-grid">
          <Field
            label="Se utiliza para"
            name="uses"
            value={editor.uses.join(", ")}
            multiline
            hint="Separá cada uso con una coma: gases, pesadez, descanso."
          />
          <Field
            label="También buscar por"
            name="aliases"
            value={editor.aliases.join(", ")}
            multiline
            hint="Sinónimos y expresiones del cliente: hinchazón, dolor de panza."
          />
        </div>
        <fieldset className="ingredients-editor">
          <legend>
            Hierbas y proporciones{" "}
            <span className="required-tag">
              Obligatorio: al menos una hierba
            </span>
          </legend>
          <p>
            Escribí el nombre y elegí una hierba existente. Si no está, se
            agrega sola. Con proporciones como &quot;2 partes&quot; el empleado
            puede calcular gramos.
          </p>
          {drafts.map((draft, index) => (
            <div className="ingredient-row" key={index}>
              <HerbCombobox
                label={`Hierba ${index + 1}`}
                value={draft.name}
                onChange={(name) => setDraft(index, { name })}
                options={herbOptions}
                taken={
                  new Set(
                    drafts
                      .filter((_, n) => n !== index)
                      .map((d) => normalize(d.name)),
                  )
                }
              />
              <select
                aria-label={`Proporción ${index + 1}`}
                value={draft.amount}
                onChange={(e) => setDraft(index, { amount: e.target.value })}
              >
                <option value="">Elegir partes</option>
                {draft.amount && !proportions.includes(draft.amount) && (
                  <option value={draft.amount}>{draft.amount}</option>
                )}
                {proportions.map((amount) => (
                  <option key={amount} value={amount}>
                    {amount}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="icon-button"
                aria-label={`Quitar hierba ${index + 1}`}
                onClick={() => setDrafts(drafts.filter((_, n) => n !== index))}
              >
                <X size={22} weight="bold" aria-hidden="true" />
              </button>
            </div>
          ))}
          <button
            className="button"
            type="button"
            onClick={() => setDrafts([...drafts, { name: "", amount: "" }])}
          >
            <Plus size={20} weight="bold" aria-hidden="true" />
            Agregar hierba
          </button>
        </fieldset>
        <Field
          label="Preparación e indicaciones internas"
          name="instructions"
          value={editor.instructions}
          multiline
          hint="Escribí el método y los tiempos definidos por el dueño."
        />
        <Field
          label="Advertencias / contraindicaciones"
          name="warnings"
          value={editor.warnings}
          multiline
        />
        <AvoidSelector
          value={avoid}
          options={getAvoidOptions(catalog)}
          onChange={setAvoid}
        />
        {formError && (
          <div className="alert error" role="alert">
            {formError}
          </div>
        )}
      </SaveForm>
    </Screen>
  );
  const plantEditor = herbEditor && admin && (
    <Screen
      key={herbEditor.id}
      inline={adminWorkspace}
      title={herbEditor.name ? `${herbEditor.name}` : "Nueva hierba"}
      onClose={async () => {
        if (!busy && (await flushEditor.current())) setHerbEditor(null);
      }}
    >
      <SaveForm
        error={formError}
        key={herbEditor.id}
        registerRef={flushEditor}
        paused={busy}
        onSave={submitHerb}
        changes={image}
      >
        <Field
          label="Nombre de la hierba"
          name="name"
          value={herbEditor.name}
          required
        />
        <ImageField value={image} onChange={setImage} onBusy={setBusy} />
        {catalog && <CategoryPicker catalog={catalog} item={herbEditor} />}
        <PriceFields item={herbEditor} />
        <Field
          label="Nombre científico"
          name="scientificName"
          value={herbEditor.scientificName}
        />
        <Field
          label="Propiedades"
          name="properties"
          value={herbEditor.properties}
          multiline
        />
        <Field
          label="Usos tradicionales y formas de uso"
          name="uses"
          value={herbEditor.uses.join(", ")}
          multiline
          hint="Separá por comas. Ejemplos: mate, infusión, sobremesa."
        />
        <Field
          label="También buscar por"
          name="aliases"
          value={herbEditor.aliases.join(", ")}
          multiline
          hint="Sinónimos o búsquedas del cliente. Ejemplo: hierbas para mate."
        />
        <Field
          label="Advertencias / contraindicaciones"
          name="warnings"
          value={herbEditor.warnings}
          multiline
        />
        {formError && (
          <div className="alert error" role="alert">
            {formError}
          </div>
        )}
      </SaveForm>
    </Screen>
  );
  const deletePanel = deleting && admin && (
    <Screen
      inline={adminWorkspace}
      title={`Eliminar ${deleting.name}`}
      onClose={() => {
        if (!busy) setDeleting(null);
      }}
    >
      <p className="screen-intro">
        Esta ficha se eliminará del catálogo. La eliminación no se puede
        deshacer.
      </p>
      {formError && (
        <div className="alert error" role="alert">
          {formError}
        </div>
      )}
      <div className="form-actions">
        <button
          className="button"
          disabled={busy}
          onClick={() => setDeleting(null)}
        >
          Cancelar
        </button>
        <button
          className="button danger"
          disabled={busy}
          onClick={async () => {
            if (!catalog) return;
            const tonic = "ingredients" in deleting;
            if (
              !tonic &&
              catalog.preparations.some((p) =>
                p.ingredients.some((i) => i.plantId === deleting.id),
              )
            ) {
              setFormError(
                "Esta hierba se utiliza en un tónico. Quitala de sus ingredientes antes de eliminarla.",
              );
              return;
            }
            const combos = combosUsing(catalog, deleting.id);
            if (combos.length) {
              setFormError(
                `Esta ficha forma parte de ${combos.length === 1 ? "el combo" : "los combos"} ${combos.map((c) => c.name).join(", ")}. Quitala del combo antes de eliminarla.`,
              );
              return;
            }
            if (
              await save(
                tonic
                  ? {
                      ...catalog,
                      preparations: catalog.preparations.filter(
                        (p) => p.id !== deleting.id,
                      ),
                    }
                  : {
                      ...catalog,
                      plants: catalog.plants.filter(
                        (p) => p.id !== deleting.id,
                      ),
                    },
              )
            ) {
              setDeleting(null);
              setEditor(null);
              setHerbEditor(null);
            }
          }}
        >
          {busy ? "Eliminando…" : "Eliminar ficha"}
        </button>
      </div>
    </Screen>
  );
  return (
    <>
      {!role && (
        <div className="role-entry" inert={screenOpen}>
          <div className="entry-brand">
            <Image
              src="/nekurel-logo.png"
              alt="Ñekurel Herboristería — Tostado, Santa Fe"
              width={1600}
              height={1280}
              preload
              unoptimized
            />
          </div>
          <div className="entry-content">
            <h1>¿Cómo querés entrar?</h1>
            <div className="role-options">
              <button
                className="role-card"
                onClick={() => {
                  if (!sellerAccess) {
                    setLoginError("");
                    setLogin("seller");
                    return;
                  }
                  setCatalog(null);
                  setRole("seller");
                  setTab("search");
                  setPreview(false);
                }}
              >
                <span className="role-icon">
                  <Storefront size={28} aria-hidden="true" />
                </span>
                <strong>Vendedor</strong>
                <span>
                  Buscar hierbas y tónicos.
                  <br />
                  Consultar y compartir preparados.
                </span>
                <span className="role-action">
                  Entrar al catálogo <ArrowRight size={20} aria-hidden="true" />
                </span>
              </button>
              <button
                className="role-card"
                // Administration moved to the central panel (its own host and session). /equipo/panel is a route handler that redirects there, so a full navigation is what is wanted.
                // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                onClick={() => { window.location.href = "/equipo/panel"; }}
              >
                <span className="role-icon">
                  <LockKey size={28} aria-hidden="true" />
                </span>
                <strong>Administrador</strong>
                <span>
                  Cargar el conocimiento.
                  <br />
                  Gestionar hierbas y recetas.
                </span>
                <span className="role-action">
                  Administrar <ArrowRight size={20} aria-hidden="true" />
                </span>
              </button>
            </div>
            {error && (
              <div className="alert error" role="alert">
                {error}
                <button onClick={() => void load()}>Reintentar</button>
              </div>
            )}
          </div>
        </div>
      )}
      {role && (
        <div
          className={`app ${admin ? "admin-app" : "seller-app"}`}
          inert={screenOpen}
        >
          <main>
            {admin && (
              <div className="admin-access">
                <button onClick={() => void logout()}>
                  <ArrowLeft size={18} aria-hidden="true" />
                  Cambiar rol
                </button>
                <button
                  className="category-manage-button"
                  disabled={busy}
                  onClick={async () => {
                    if (!(await flushEditor.current())) return;
                    setFormError("");
                    setCategoryEditor(true);
                  }}
                >
                  <Leaf size={21} aria-hidden="true" />
                  Gestionar categorías
                </button>
              </div>
            )}
            {admin && (
              <header className="admin-header">
                <div className="admin-search-row">
                  {tab !== "store" && (
                  <label className="admin-search">
                    <MagnifyingGlass size={22} aria-hidden="true" />
                    <input
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                      aria-label={
                        tab === "herbs" ? "Filtrar hierbas" : "Filtrar tónicos"
                      }
                      placeholder={
                        tab === "herbs"
                          ? "Buscar una hierba"
                          : "Buscar un tónico"
                      }
                    />
                  </label>
                  )}
                  <nav className="segmented" aria-label="Secciones">
                    {(Object.keys(labels) as (keyof typeof labels)[]).map(
                      (item) => (
                        <button
                          key={item}
                          disabled={busy}
                          aria-current={tab === item ? "page" : undefined}
                          onClick={async () => {
                            if (!(await flushEditor.current())) return;
                            setEditor(null);
                            setHerbEditor(null);
                            setDeleting(null);
                            setTab(item);
                            setFilter("");
                            setNotice("");
                          }}
                        >
                          {labels[item]}
                        </button>
                      ),
                    )}
                  </nav>
                  {tab !== "store" && (
                  <>
                  <label className="button admin-import">
                    <UploadSimple size={20} aria-hidden="true" />
                    Importar CSV
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      hidden
                      disabled={busy}
                      onChange={(e) => void chooseCsv(e)}
                    />
                  </label>
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={() =>
                      tab === "herbs"
                        ? void openHerbEditor(newHerb(""))
                        : void openEditor(blankTonic())
                    }
                  >
                    <Plus size={20} aria-hidden="true" />
                    {tab === "herbs" ? "Nueva hierba" : "Nuevo tónico"}
                  </button>
                  </>
                  )}
                </div>
              </header>
            )}
            {!online && (
              <div className="alert offline" role="status">
                <WifiSlash size={22} weight="bold" aria-hidden="true" />
                Sin conexión. Se muestra la última versión guardada.
              </div>
            )}
            {error && (
              <div className="alert error" role="alert">
                {error}
                <button onClick={() => void load()}>Reintentar</button>
              </div>
            )}
            {notice && (
              <div className="alert success" role="status">
                {notice}
                <button aria-label="Cerrar aviso" onClick={() => setNotice("")}>
                  <X size={22} weight="bold" aria-hidden="true" />
                </button>
              </div>
            )}
            {tab === "search" && (
              <>
                {admin && (
                  <div className="preview-bar">
                    <span>
                      {preview
                        ? "Vista previa: incluye borradores."
                        : "El equipo solo ve tónicos habilitados."}
                    </span>
                    <button
                      onClick={() => {
                        setPreview(!preview);
                        setQuery("");
                      }}
                    >
                      {preview ? "Salir de vista previa" : "Ver borradores"}
                    </button>
                  </div>
                )}
                <Finder
                  selectedId={detail?.id ?? herbDetail?.id}
                  catalog={catalog}
                  query={query}
                  onQuery={setQuery}
                  results={ordered}
                  herbs={searchResults.plants}
                  onOpenHerb={(plant) => {
                    setDetail(null);
                    setHerbDetail(plant);
                  }}
                  isDraft={(id) =>
                    preview &&
                    !catalog?.preparations.find((p) => p.id === id)?.published
                  }
                  onOpen={openDetail}
                  profile={profile}
                  onProfile={setProfile}
                  onExit={() => void logout()}
                />
              </>
            )}
            {admin && catalog && (
              <StoreTab
                catalog={catalog}
                busy={busy}
                error={formError}
                active={tab === "store"}
                flushRef={flushEditor}
                onSave={save}
                onReload={() => void load()}
                onClearError={() => setFormError("")}
                onDirty={setStoreDirty}
              />
            )}
            <div className={adminWorkspace ? "admin-workspace" : undefined}>
              <div className="admin-catalog">
                {admin && tab === "tonics" && (
                  <section className="admin-region">
                    <div className="admin-table-wrap">
                      <table className="admin-table">
                        <caption>Tónicos</caption>
                        <thead>
                          <tr>
                            <th scope="col">Nombre</th>
                            <th scope="col">Hierbas</th>
                            <th scope="col">Precio</th>
                            <th scope="col">
                              <span className="sr-only">Acciones</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {catalog?.preparations
                            .filter((p) => matches(p.name))
                            .sort((a, b) => a.name.localeCompare(b.name, "es"))
                            .map((item) => (
                              <tr
                                key={item.id}
                                className={
                                  editor?.id === item.id
                                    ? "is-selected"
                                    : undefined
                                }
                              >
                                <th scope="row">
                                  <button
                                    className="table-select"
                                    disabled={busy}
                                    onClick={() => void openEditor(item)}
                                  >
                                    {item.name}
                                  </button>
                                  {item.hidden && (
                                    <span className="hidden-tag">Oculto</span>
                                  )}
                                </th>
                                <td>{item.ingredients.length}</td>
                                <td>{formatPrice(item) || "—"}</td>
                                <td>
                                  <button
                                    className="table-delete danger-text"
                                    disabled={busy}
                                    aria-label={`Eliminar ${item.name}`}
                                    onClick={async () => {
                                      if (!(await flushEditor.current()))
                                        return;
                                      setFormError("");
                                      setDeleting(item);
                                    }}
                                  >
                                    <Trash size={22} aria-hidden="true" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                    {catalog &&
                      !catalog.preparations.some((p) => matches(p.name)) && (
                        <div className="empty">
                          <h3>
                            {filter
                              ? "No encontramos ese tónico"
                              : "Todavía no hay tónicos"}
                          </h3>
                          <p>
                            {filter
                              ? "Probá con otro nombre."
                              : "Creá un tónico o importá varios desde un archivo CSV."}
                          </p>
                        </div>
                      )}
                  </section>
                )}
                {admin && tab === "herbs" && (
                  <section className="admin-region">
                    <div className="admin-table-wrap">
                      <table className="admin-table herb-table">
                        <caption>Hierbas</caption>
                        <thead>
                          <tr>
                            <th scope="col">Nombre</th>
                            <th scope="col">Nombre científico</th>
                            <th scope="col">Usos</th>
                            <th scope="col">Tónicos</th>
                            <th scope="col">Precio</th>
                            <th scope="col">
                              <span className="sr-only">Acciones</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {catalog?.plants
                            .filter((p) => matches(p.name))
                            .sort((a, b) => a.name.localeCompare(b.name, "es"))
                            .map((plant) => {
                              const count = catalog.preparations.filter((p) =>
                                p.ingredients.some(
                                  (i) => i.plantId === plant.id,
                                ),
                              ).length;
                              return (
                                <tr
                                  key={plant.id}
                                  className={
                                    herbEditor?.id === plant.id
                                      ? "is-selected"
                                      : undefined
                                  }
                                >
                                  <th scope="row">
                                    <button
                                      className="table-select"
                                      disabled={busy}
                                      onClick={() => void openHerbEditor(plant)}
                                    >
                                      {plant.name}
                                    </button>
                                    {plant.hidden && (
                                      <span className="hidden-tag">Oculto</span>
                                    )}
                                  </th>
                                  <td className="table-scientific">
                                    {plant.scientificName || "—"}
                                  </td>
                                  <td>
                                    <span
                                      className="table-uses"
                                      title={plant.uses.join(", ")}
                                    >
                                      {plant.uses.slice(0, 2).join(", ") || "—"}
                                    </span>
                                  </td>
                                  <td>{count}</td>
                                  <td>{formatPrice(plant) || "—"}</td>
                                  <td>
                                    <button
                                      className="table-delete danger-text"
                                      disabled={busy || count > 0}
                                      title={
                                        count
                                          ? "Quitá esta hierba de sus tónicos antes de eliminarla"
                                          : "Eliminar hierba"
                                      }
                                      aria-label={`Eliminar ${plant.name}`}
                                      onClick={async () => {
                                        if (!(await flushEditor.current()))
                                          return;
                                        setFormError("");
                                        setDeleting(plant);
                                      }}
                                    >
                                      <Trash size={22} aria-hidden="true" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                    {catalog && !herbOptions.some((h) => matches(h.name)) && (
                      <div className="empty">
                        <h3>
                          {filter
                            ? "No encontramos esa hierba"
                            : "Todavía no hay hierbas"}
                        </h3>
                        <p>
                          {filter
                            ? "Probá con otro nombre."
                            : "Creá una hierba o agregala al armar un tónico."}
                        </p>
                      </div>
                    )}
                  </section>
                )}
              </div>
              {adminWorkspace && (
                <aside className="admin-detail" aria-label="Editar ficha">
                  {deletePanel ||
                    (tab === "tonics" ? tonicEditor : plantEditor) || (
                      <div className="detail-placeholder">
                        <Leaf size={44} weight="duotone" aria-hidden="true" />
                        <h2>Seleccioná una ficha</h2>
                        <p>
                          Elegí un tónico o una hierba del listado para editar
                          su información desde acá.
                        </p>
                      </div>
                    )}
                </aside>
              )}
            </div>{" "}
          </main>
        </div>
      )}
      {login && (
        <Screen
          key={login}
          title={login === "seller" ? "Catálogo del equipo" : "Administración de Ñekurel"}
          onClose={() => {
            if (!busy) setLogin(false);
          }}
        >
          <p className="screen-intro">
            {login === "seller"
              ? "Ingresá el código de vendedor. Se pide una sola vez en este dispositivo."
              : "Ingresá para gestionar los tónicos."}
          </p>
          <form onSubmit={submitLogin}>
            <label className="field">
              <span>{login === "seller" ? "Código de vendedor" : "Contraseña de administrador"}</span>
              <input
                name="secret"
                type="password"
                required
                autoComplete={login === "seller" ? "off" : "current-password"}
                autoFocus
                maxLength={512}
              />
            </label>
            {loginError && (
              <div className="alert error" role="alert">
                {loginError}
              </div>
            )}
            <button className="button primary full" disabled={busy}>
              {busy ? "Ingresando…" : "Ingresar"}
            </button>
          </form>
        </Screen>
      )}
      {!adminWorkspace && tonicEditor}
      {!adminWorkspace && plantEditor}
      {report && admin && (
        <Screen
          title="Importar tónicos"
          onClose={() => {
            if (!busy) setReport(null);
          }}
        >
          {report.created + report.updated > 0 ? (
            <p className="screen-intro">
              Se van a crear <strong>{report.created}</strong> tónicos y
              actualizar <strong>{report.updated}</strong>. Los tónicos se
              identifican por su nombre.
            </p>
          ) : (
            <p className="screen-intro">No hay nada para importar.</p>
          )}
          {report.drafts.length > 0 && (
            <div className="alert warn">
              <span>
                Quedan como borrador por estar incompletos (faltan usos,
                preparación o proporciones): {report.drafts.join(", ")}.
              </span>
            </div>
          )}
          {report.errors.length > 0 && (
            <div className="alert error" role="alert">
              <ul>
                {report.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="section-note">
            Columnas: Nombre, Usos, Sinónimos, Hierbas (como Manzanilla:2
            partes|Menta:1 parte), Preparación, Advertencias, Notas, No
            recomendado en, Habilitado.
          </p>
          {formError && (
            <div className="alert error" role="alert">
              {formError}
            </div>
          )}
          <div className="form-actions">
            <button
              className="button"
              disabled={busy}
              onClick={() => setReport(null)}
            >
              Cancelar
            </button>
            {report.created + report.updated > 0 && (
              <button
                className="button primary"
                disabled={busy}
                onClick={async () => {
                  if (await save(report.catalog)) setReport(null);
                }}
              >
                {busy ? "Importando…" : "Confirmar importación"}
              </button>
            )}
          </div>
        </Screen>
      )}
      {categoryEditor && admin && catalog && (
        <CategoryImageEditor
          initial={catalog.categoryImages ?? {}}
          initialCategories={getCategories(catalog)}
          error={formError}
          onClose={() => setCategoryEditor(false)}
          onSave={(categories, images) =>
            save({
              ...(catalogRef.current ?? catalog),
              categories,
              categoryImages: images,
            })
          }
        />
      )}
      {detail && (
        <TonicDetail
          key={detail.id}
          prep={detail}
          catalog={catalog}
          plantName={plantName}
          preview={preview}
          profile={profile}
          onClose={() => setDetail(null)}
          onEdit={
            admin
              ? () => {
                  openEditor(detail);
                  setDetail(null);
                }
              : undefined
          }
        />
      )}
      {herbDetail && (
        <HerbDetail
          plant={herbDetail}
          onClose={() => setHerbDetail(null)}
          onEdit={
            admin
              ? () => {
                  openHerbEditor(herbDetail);
                  setHerbDetail(null);
                }
              : undefined
          }
        />
      )}
      {!adminWorkspace && deletePanel}
    </>
  );
}
