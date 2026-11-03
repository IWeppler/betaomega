"use client";

import { useRef, useState } from "react";
import {
  ArrowDown,
  ArrowSquareOut,
  ArrowUp,
  Check,
  Copy,
  Plus,
  X,
} from "@phosphor-icons/react";
import { SaveForm } from "@/app/save-form";
import { ImageField } from "@/app/catalog-image";
import { Field } from "@/app/admin-fields";
import {
  anyMoment,
  isScheduled,
  maxExtraImages,
  maxSummary,
  canonicalLabel,
  normalizeCategories,
  normalizeMoments,
  parseIngredientLines,
  parseStepLines,
  recipeCategories,
  recipeCuisines,
  recipeDifficulties,
  recipeMoments,
  slugify,
  type Ingredient,
  type Recipe,
  type RecipeDifficulty,
  type RecipeInput,
  type RecipeMoment,
} from "@/lib/recipes";
import { CategoryInput } from "./category-input";
import { ComboInput } from "./combo-input";
import { EditorFrame } from "./editors";
import { PasteList } from "./paste-list";
import { SharePreview } from "./share-preview";
import { usePanel } from "./panel-context";
import { useRecipes } from "./recipes-context";

const move = <T,>(list: T[], from: number, to: number) => {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
};
/** ISO date → the "2026-11-05T09:00" value a datetime-local input takes, in the browser's time zone. */
const toLocalInput = (iso?: string) => {
  if (!iso) return "";
  const date = new Date(iso),
    pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
/**
 * The date to send: the one chosen, or "now" when a date still in the future was cleared (otherwise the old date would keep the recipe hidden).
 * undefined leaves the stored date alone: an untouched field keeps it exactly, since the input only has minutes.
 */
function pickSchedule(
  raw: string,
  shown: string,
  published: boolean,
  storedAt?: string,
) {
  if (raw) {
    const chosen = raw !== shown ? new Date(raw) : undefined;
    return chosen && !Number.isNaN(chosen.getTime())
      ? chosen.toISOString()
      : undefined;
  }
  return published && storedAt && Date.parse(storedAt) > Date.now()
    ? new Date().toISOString()
    : undefined;
}
const parseMinutes = (value: string) =>
  value.trim() === "" ? undefined : Number(value);

function RowButtons({
  label,
  index,
  count,
  onMove,
  onRemove,
}: {
  label: string;
  index: number;
  count: number;
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  return (
    <div className="recipe-row-buttons">
      <button
        type="button"
        className="icon-button"
        aria-label={`Subir ${label}`}
        disabled={index === 0}
        onClick={() => onMove(index - 1)}
      >
        <ArrowUp size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="icon-button"
        aria-label={`Bajar ${label}`}
        disabled={index === count - 1}
        onClick={() => onMove(index + 1)}
      >
        <ArrowDown size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="icon-button"
        aria-label={`Quitar ${label}`}
        onClick={onRemove}
      >
        <X size={16} weight="bold" aria-hidden="true" />
      </button>
    </div>
  );
}

/** Where the public site answers from here: the local one (comidasdelcielo.localhost) while developing, the real one otherwise. */
function publicOrigin(siteId: string, siteUrl: string) {
  const { protocol, hostname, port } = window.location;
  return hostname.endsWith(".localhost")
    ? `${protocol}//${siteId}.localhost${port ? `:${port}` : ""}`
    : siteUrl;
}

/** Link to the recipe on the site as it was last saved: the page if it is published, a signed preview if it is a draft. */
function SiteLink({
  stored,
  siteId,
  siteUrl,
}: {
  stored?: Recipe;
  siteId: string;
  siteUrl: string;
}) {
  const [copied, setCopied] = useState(false);
  const hidden = !stored?.published || isScheduled(stored);
  if (!stored || (hidden && !stored.previewToken))
    return (
      <p className="recipe-site-link">
        <small>Guardá la receta para ver cómo queda en el sitio.</small>
      </p>
    );
  const href = `${publicOrigin(siteId, siteUrl)}/${stored.slug}${hidden ? `?vista=${stored.previewToken}` : ""}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      /* The link stays visible to copy by hand. */
    }
  };
  return (
    <div className="recipe-site-link">
      <a
        className="button"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
      >
        <ArrowSquareOut size={16} aria-hidden="true" />
        {hidden ? "Vista previa" : "Ver en el sitio"}
      </a>
      {hidden && (
        <button type="button" className="button" onClick={() => void copy()}>
          {copied ? (
            <Check size={16} aria-hidden="true" />
          ) : (
            <Copy size={16} aria-hidden="true" />
          )}
          {copied ? "Link copiado" : "Copiar link"}
        </button>
      )}
      <small>
        {!hidden
          ? "Muestra lo último que guardaste."
          : isScheduled(stored)
            ? "Está programada: hasta su fecha solo la ve quien tenga el link. Muestra lo último que guardaste."
            : "Es un borrador: solo lo ve quien tenga el link. Muestra lo último que guardaste."}
      </small>
    </div>
  );
}

export function RecipeEditor({
  recipe,
  siteId,
  siteName,
  siteUrl,
  onSaved,
  onClose,
  onDelete,
}: {
  recipe: RecipeInput;
  siteId: string;
  siteName: string;
  siteUrl: string;
  onSaved: (item: RecipeInput) => void;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const { busy, setBusy, error, setError, flushRef } = usePanel();
  const { recipes, save } = useRecipes();
  const stored = recipes?.find((r) => r.id === recipe.id);
  // The revision of the last save: the next one must start from it.
  const revision = useRef(recipe.revision);
  const [title, setTitle] = useState(recipe.title);
  // The description is an uncontrolled field; this copy only feeds the share preview.
  const [summary, setSummary] = useState(recipe.summary);
  const [image, setImage] = useState(recipe.image || "");
  // What the date field showed when it was last loaded or saved.
  const shownSchedule = useRef(toLocalInput(stored?.publishedAt));
  const [images, setImages] = useState<string[]>(recipe.images ?? []);
  const [ingredients, setIngredients] = useState<Ingredient[]>(
    recipe.ingredients,
  );
  const [steps, setSteps] = useState<string[]>(recipe.steps);
  const [categories, setCategories] = useState<string[]>(recipe.categories);
  const siteCategories = recipeCategories(recipes ?? []).map((c) => c.label);
  const [moments, setMoments] = useState<RecipeMoment[]>(recipe.moments ?? []);
  const [difficulty, setDifficulty] = useState<RecipeDifficulty | undefined>(
    recipe.difficulty,
  );
  const siteCuisines = recipeCuisines(recipes ?? []);
  const [cuisine, setCuisine] = useState(recipe.cuisine ?? "");
  // "Cualquier momento" goes alone: choosing it clears the others, and choosing another clears it.
  const toggleMoment = (id: RecipeMoment) =>
    setMoments(
      moments.includes(id)
        ? moments.filter((m) => m !== id)
        : id === anyMoment
          ? [anyMoment]
          : normalizeMoments([...moments.filter((m) => m !== anyMoment), id]),
    );
  // While a draft keeps the address derived from its name, the address follows the name. Published addresses stay put.
  const [slug, setSlug] = useState(recipe.slug);
  const [slugFollows, setSlugFollows] = useState(
    !recipe.published &&
      (!recipe.slug || recipe.slug === slugify(recipe.title)),
  );
  const shownSlug = slugFollows ? slugify(title) : slug;
  const setIngredient = (index: number, patch: Partial<Ingredient>) =>
    setIngredients(
      ingredients.map((item, n) =>
        n === index ? { ...item, ...patch } : item,
      ),
    );

  const submit = async (element: HTMLFormElement) => {
    if (!element.checkValidity()) {
      setError("Completá el nombre y los campos requeridos.");
      return false;
    }
    const form = new FormData(element);
    const text = (key: string) => String(form.get(key) || "").trim();
    const prepMinutes = parseMinutes(text("prepMinutes")),
      cookMinutes = parseMinutes(text("cookMinutes"));
    if (
      [prepMinutes, cookMinutes].some(
        (m) => m !== undefined && (!Number.isInteger(m) || m < 0),
      )
    ) {
      setError("Escribí los tiempos en minutos enteros.");
      return false;
    }
    // Rows just added and still blank are skipped, so adding one does not make the save fail.
    const filled = ingredients.filter((i) => i.name.trim() || i.amount.trim());
    if (filled.some((i) => !i.name.trim())) {
      setError("Completá el nombre de cada ingrediente que tiene cantidad.");
      return false;
    }
    const item: RecipeInput = {
      ...recipe,
      revision: revision.current,
      title: text("title"),
      slug: shownSlug,
      image: image || undefined,
      images: images.filter(Boolean),
      scheduledAt: pickSchedule(
        String(form.get("scheduledAt") || ""),
        shownSchedule.current,
        form.get("published") === "on",
        stored?.publishedAt,
      ),
      summary: text("summary"),
      categories: normalizeCategories(categories, siteCategories),
      moments,
      difficulty,
      // Same nation typed differently ("italia", "Itália") is stored as the one already in use.
      cuisine: canonicalLabel(text("cuisine"), siteCuisines),
      servings: text("servings"),
      prepMinutes,
      cookMinutes,
      ingredients: filled.map((i) => ({
        amount: i.amount.trim(),
        name: i.name.trim(),
      })),
      steps: steps.map((s) => s.trim()).filter(Boolean),
      notes: text("notes"),
      published: form.get("published") === "on",
    };
    const saved = await save(item);
    if (!saved) return false;
    revision.current = saved.revision;
    shownSchedule.current = String(form.get("scheduledAt") || "");
    // Once published, the address no longer follows the name.
    if (saved.published && slugFollows) {
      setSlug(saved.slug);
      setSlugFollows(false);
    }
    onSaved(saved);
    return true;
  };

  return (
    <EditorFrame
      title={recipe.title || "Nueva receta"}
      onClose={onClose}
      onDelete={onDelete}
    >
      <SaveForm
        error={error}
        registerRef={flushRef}
        paused={busy}
        onSave={submit}
        changes={JSON.stringify([
          image,
          images,
          ingredients,
          steps,
          categories,
          moments,
          difficulty,
          cuisine,
        ])}
      >
        <label className="field">
          <span>
            Nombre de la receta<span className="required-tag">Obligatorio</span>
          </span>
          <input
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={160}
            required
          />
        </label>
        <div className="publish-row">
          <label className="check">
            <input
              type="checkbox"
              name="published"
              defaultChecked={recipe.published}
            />
            Publicada en el sitio
          </label>
          <SiteLink stored={stored} siteId={siteId} siteUrl={siteUrl} />
        </div>
        <ImageField
          label="Foto de la receta"
          site={siteId}
          value={image}
          onChange={setImage}
          onBusy={setBusy}
        />
        <fieldset className="ingredients-editor">
          <legend>
            Más fotos{" "}
            <span className="panel-muted">
              Opcional, hasta {maxExtraImages}
            </span>
          </legend>
          {images.map((src, index) => (
            <div className="recipe-extra-photo" key={index}>
              <ImageField
                label={`Foto adicional ${index + 1}`}
                site={siteId}
                value={src}
                onChange={(value) =>
                  setImages(images.map((s, n) => (n === index ? value : s)))
                }
                onBusy={setBusy}
              />
              <button
                type="button"
                className="button"
                onClick={() => setImages(images.filter((_, n) => n !== index))}
              >
                <X size={16} weight="bold" aria-hidden="true" />
                Quitar esta foto
              </button>
            </div>
          ))}
          {images.length < maxExtraImages && (
            <button
              className="button"
              type="button"
              onClick={() => setImages([...images, ""])}
            >
              <Plus size={16} weight="bold" aria-hidden="true" />
              Agregar foto
            </button>
          )}
        </fieldset>
        <div
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            if (target.name === "summary") setSummary(target.value);
          }}
        >
          <label className="field">
            <span>Descripción</span>
            <textarea
              className="recipe-summary-input"
              name="summary"
              defaultValue={recipe.summary}
              rows={3}
              maxLength={maxSummary}
            />
            <small>
              Hasta {maxSummary.toLocaleString("es-AR")} caracteres (
              {summary.length.toLocaleString("es-AR")} usados).
            </small>
          </label>
        </div>
        <fieldset className="field recipe-choice">
          <legend>Momento del día</legend>
          <div
            className="choice-chips"
            role="group"
            aria-label="Momento del día"
          >
            {recipeMoments.map((m) => (
              <button
                type="button"
                key={m.id}
                aria-pressed={moments.includes(m.id)}
                onClick={() => toggleMoment(m.id)}
              >
                {moments.includes(m.id) && (
                  <Check size={14} weight="bold" aria-hidden="true" />
                )}
                {m.label}
              </button>
            ))}
          </div>
          <small>
            Podés marcar varios. “Cualquier momento” va solo y la receta aparece
            en todos los momentos.
          </small>
        </fieldset>
        <CategoryInput
          value={categories}
          onChange={setCategories}
          suggestions={siteCategories}
        />
        <div className="form-grid">
          <ComboInput
            label="Nación"
            name="cuisine"
            value={cuisine}
            onChange={setCuisine}
            suggestions={siteCuisines}
            maxLength={40}
            placeholder="Argentina, Italia…"
            createLabel="Crear nación"
            hint="Opcional. Tocá el campo para ver las que ya existen."
          />
          <fieldset className="field recipe-choice">
            <legend>Complejidad</legend>
            <div className="choice-chips" role="group" aria-label="Complejidad">
              {recipeDifficulties.map((d) => (
                <button
                  type="button"
                  key={d.id}
                  aria-pressed={difficulty === d.id}
                  onClick={() =>
                    setDifficulty(difficulty === d.id ? undefined : d.id)
                  }
                >
                  {d.label}
                </button>
              ))}
            </div>
            <small>Tocá la elegida de nuevo para quitarla.</small>
          </fieldset>
        </div>
        <div className="form-grid recipe-times">
          <Field
            label="Porciones"
            name="servings"
            value={recipe.servings}
            hint="Ejemplo: 4 porciones, 12 empanadas."
          />
          <label className="field">
            <span>Preparación (min)</span>
            <input
              name="prepMinutes"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              defaultValue={recipe.prepMinutes ?? ""}
            />
          </label>
          <label className="field">
            <span>Cocción (min)</span>
            <input
              name="cookMinutes"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              defaultValue={recipe.cookMinutes ?? ""}
            />
          </label>
        </div>
        <fieldset className="ingredients-editor">
          <legend>
            Ingredientes{" "}
            <span className="required-tag">Al menos uno para publicar</span>
          </legend>
          {ingredients.map((item, index) => (
            <div className="recipe-ingredient-row" key={index}>
              <input
                aria-label={`Cantidad del ingrediente ${index + 1}`}
                placeholder="200 g"
                value={item.amount}
                maxLength={60}
                onChange={(e) =>
                  setIngredient(index, { amount: e.target.value })
                }
              />
              <input
                aria-label={`Ingrediente ${index + 1}`}
                placeholder="Harina 0000"
                value={item.name}
                maxLength={160}
                onChange={(e) => setIngredient(index, { name: e.target.value })}
              />
              <RowButtons
                label={`ingrediente ${index + 1}`}
                index={index}
                count={ingredients.length}
                onMove={(to) => setIngredients(move(ingredients, index, to))}
                onRemove={() =>
                  setIngredients(ingredients.filter((_, n) => n !== index))
                }
              />
            </div>
          ))}
          <div className="recipe-list-actions">
            <button
              className="button"
              type="button"
              onClick={() =>
                setIngredients([...ingredients, { amount: "", name: "" }])
              }
            >
              <Plus size={16} weight="bold" aria-hidden="true" />
              Agregar ingrediente
            </button>
            <PasteList
              noun="ingrediente"
              nouns="ingredientes"
              placeholder={
                "1 kg carne picada\n200 g de harina\n1/2 taza de leche\n3 huevos\nsal a gusto"
              }
              hint="Un ingrediente por renglón. La cantidad va primero; si no tiene, queda vacía."
              count={(text) => parseIngredientLines(text).length}
              hasRows={ingredients.some(
                (i) => i.name.trim() || i.amount.trim(),
              )}
              onApply={(text, replace) => {
                const rows = parseIngredientLines(text);
                setIngredients(
                  replace
                    ? rows
                    : [
                        ...ingredients.filter(
                          (i) => i.name.trim() || i.amount.trim(),
                        ),
                        ...rows,
                      ],
                );
              }}
            />
          </div>
        </fieldset>
        <fieldset className="ingredients-editor">
          <legend>
            Pasos{" "}
            <span className="required-tag">Al menos uno para publicar</span>
          </legend>
          <ol className="recipe-steps">
            {steps.map((step, index) => (
              <li className="recipe-step-row" key={index}>
                <textarea
                  aria-label={`Paso ${index + 1}`}
                  value={step}
                  rows={2}
                  maxLength={2000}
                  onChange={(e) =>
                    setSteps(
                      steps.map((s, n) => (n === index ? e.target.value : s)),
                    )
                  }
                />
                <RowButtons
                  label={`paso ${index + 1}`}
                  index={index}
                  count={steps.length}
                  onMove={(to) => setSteps(move(steps, index, to))}
                  onRemove={() => setSteps(steps.filter((_, n) => n !== index))}
                />
              </li>
            ))}
          </ol>
          <div className="recipe-list-actions">
            <button
              className="button"
              type="button"
              onClick={() => setSteps([...steps, ""])}
            >
              <Plus size={16} weight="bold" aria-hidden="true" />
              Agregar paso
            </button>
            <PasteList
              noun="paso"
              nouns="pasos"
              placeholder={
                "1. Mezclar la harina con la sal\n2. Agregar el agua de a poco\n3. Cocinar 20 minutos"
              }
              hint="Un paso por renglón o por párrafo. Se quitan los números y viñetas."
              count={(text) => parseStepLines(text).length}
              hasRows={steps.some((s) => s.trim())}
              onApply={(text, replace) => {
                const rows = parseStepLines(text);
                setSteps(
                  replace ? rows : [...steps.filter((s) => s.trim()), ...rows],
                );
              }}
            />
          </div>
        </fieldset>
        <Field
          label="Consejos y variantes"
          name="notes"
          value={recipe.notes}
          multiline
          hint="Opcional: cómo conservarla, reemplazos, trucos."
        />
        <label className="field">
          <span>Dirección de la receta</span>
          <span className="recipe-slug">
            <span aria-hidden="true">
              {siteUrl.replace(/^https?:\/\//, "")}/
            </span>
            <input
              aria-label="Dirección de la receta"
              value={shownSlug}
              maxLength={80}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              onChange={(e) => {
                setSlugFollows(false);
                setSlug(e.target.value.toLowerCase());
              }}
            />
          </span>
          <small>
            {slugFollows
              ? "Sigue al nombre mientras la receta sea un borrador."
              : "Si la cambiás después de publicar, los enlaces compartidos dejan de funcionar."}{" "}
            Solo letras sin tilde, números y guiones.
          </small>
        </label>
        <SharePreview
          recipe={{ title, slug: shownSlug, summary, image }}
          siteName={siteName}
          siteUrl={siteUrl}
          origin={publicOrigin(siteId, siteUrl)}
        />
      </SaveForm>
    </EditorFrame>
  );
}
