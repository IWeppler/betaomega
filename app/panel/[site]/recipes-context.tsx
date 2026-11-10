"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "@/app/admin-fields";
import { deferChange, offerUndo } from "@/shared/ui/undo";
import { pendingCount, type CommentStatus, type RecipeComment } from "@/lib/comments";
import { isScheduled, toRecipeInput, type Recipe, type RecipeInput } from "@/lib/recipes";
import { PanelContext } from "./panel-context";
import { liveRefreshMs } from "@/shared/lib/live-refresh";

type Value = {
  recipes: Recipe[] | null;
  /** Saves one recipe and returns the stored version, or null (the error is in the panel state). */
  save: (recipe: RecipeInput) => Promise<Recipe | null>;
  remove: (id: string) => Promise<boolean>;
  /** Reader comments of the site (null until loaded). A failed read does not block the panel: the reason is in commentsError. */
  comments: RecipeComment[] | null;
  commentsError: string;
  moderate: (id: string, status: CommentStatus) => Promise<boolean>;
  removeComment: (id: string) => Promise<boolean>;
  /** Renames (or joins) a category in every recipe. Returns the outcome, or null when the request failed (the error is in the panel state). */
  renameCategory: (from: string, to: string) => Promise<{ to: string; changed: number; failed: { title: string; error: string }[] } | null>;
};
const RecipesContext = createContext<Value | null>(null);
export function useRecipes() {
  const value = useContext(RecipesContext);
  if (!value) throw new Error("useRecipes fuera de un sitio de recetas");
  return value;
}

// Same rules as the catalogue: loaded once for the whole panel, refreshed on focus and every few minutes (liveRefreshMs) unless something is being edited.
export function RecipesProvider({ siteId, children }: { siteId: string; children: ReactNode }) {
  const base = `/api/sites/${siteId}/recipes`;
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [comments, setComments] = useState<RecipeComment[] | null>(null);
  const [commentsError, setCommentsError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const flushRef = useRef<() => Promise<boolean>>(async () => true);
  const reload = useCallback(async () => {
    try {
      setRecipes(await api<Recipe[]>(base));
      setLoadError("");
    } catch (e) { setLoadError((e as Error).message); }
    // Comments load apart: if their table is missing the recipes still work.
    try {
      setComments(await api<RecipeComment[]>(`/api/sites/${siteId}/comments`));
      setCommentsError("");
    } catch (e) { setCommentsError((e as Error).message); }
  }, [base, siteId]);
  useEffect(() => { void Promise.resolve().then(reload); }, [reload]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible" && !busy && !dirty) void reload(); };
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, liveRefreshMs);
    return () => { window.removeEventListener("focus", refresh); window.clearInterval(timer); };
  }, [reload, busy, dirty]);
  // Latest lists, also between renders: an undo builds on what is there when it runs, not on when it was offered.
  const recipesRef = useRef<Recipe[] | null>(null);
  const commentsRef = useRef<RecipeComment[] | null>(null);
  useEffect(() => { recipesRef.current = recipes; commentsRef.current = comments; });
  const sorted = (list: Recipe[]) => list.sort((a, b) => a.title.localeCompare(b.title, "es"));
  const put = useCallback(async (recipe: RecipeInput) => {
    const saved = await api<Recipe>(`${base}/${recipe.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(recipe) });
    setRecipes(list => sorted([...(list ?? []).filter(r => r.id !== saved.id), saved]));
    return saved;
  }, [base]);
  const destroy = useCallback(async (id: string) => {
    const response = await fetch(`${base}/${id}`, { method: "DELETE", keepalive: true });
    if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || "No se pudo eliminar la receta.");
  }, [base]);
  /** A recipe as it was, saved over the revision it has now. A recipe scheduled to come out keeps its date. */
  const restore = useCallback((before: Recipe) => {
    const now = recipesRef.current?.find(r => r.id === before.id);
    return put({ ...toRecipeInput(before), revision: now?.revision ?? before.revision, scheduledAt: isScheduled(before) ? before.publishedAt : undefined });
  }, [put]);
  const save = useCallback(async (recipe: RecipeInput) => {
    const before = recipesRef.current?.find(r => r.id === recipe.id);
    setBusy(true);
    setError("");
    try {
      const saved = await put(recipe);
      offerUndo("Se guardó correctamente.", async () => {
        if (before) { await restore(before); return; }
        // A new recipe has no comments or views yet: undoing it is deleting it.
        await destroy(saved.id);
        setRecipes(list => (list ?? []).filter(r => r.id !== saved.id));
      });
      return saved;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally { setBusy(false); }
  }, [put, restore, destroy]);
  // Deleting takes its comments and views along, so it cannot be saved back: it leaves the list now and reaches the server when the notice closes.
  const remove = useCallback(async (id: string) => {
    const recipe = recipesRef.current?.find(r => r.id === id);
    setError("");
    setRecipes(list => (list ?? []).filter(r => r.id !== id));
    deferChange({
      message: `Se eliminó ${recipe?.title || "la receta"}.`,
      commit: () => destroy(id),
      onSettled: made => {
        if (made) return;
        if (recipe) setRecipes(list => sorted([...(list ?? []).filter(r => r.id !== id), recipe]));
        else void reload();
      },
    });
    return true;
  }, [destroy, reload]);
  const patchComment = useCallback(async (id: string, status: CommentStatus) => {
    const updated = await api<RecipeComment>(`/api/sites/${siteId}/comments/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    setComments(list => (list ?? []).map(c => (c.id === id ? updated : c)));
  }, [siteId]);
  const moderate = useCallback(async (id: string, status: CommentStatus) => {
    const before = commentsRef.current?.find(c => c.id === id)?.status;
    setBusy(true);
    setError("");
    try {
      await patchComment(id, status);
      const said: Record<CommentStatus, string> = { approved: "Se aprobó el comentario.", hidden: "Se ocultó el comentario.", pending: "El comentario volvió a pendiente." };
      if (before && before !== status) offerUndo(said[status], () => patchComment(id, before));
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally { setBusy(false); }
  }, [patchComment]);
  // A deleted comment cannot be written back with its author and date: it waits, like a recipe.
  const removeComment = useCallback(async (id: string) => {
    const comment = commentsRef.current?.find(c => c.id === id);
    setError("");
    setComments(list => (list ?? []).filter(c => c.id !== id));
    deferChange({
      message: "Se eliminó el comentario.",
      commit: async () => {
        const response = await fetch(`/api/sites/${siteId}/comments/${id}`, { method: "DELETE", keepalive: true });
        if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || "No se pudo eliminar el comentario.");
      },
      onSettled: made => {
        if (made) return;
        if (comment) setComments(list => [comment, ...(list ?? []).filter(c => c.id !== id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
        else void reload();
      },
    });
    return true;
  }, [siteId, reload]);
  const renameCategory = useCallback(async (from: string, to: string) => {
    const before = recipesRef.current ?? [];
    setBusy(true);
    setError("");
    try {
      const result = await api<{ to: string; changed: number; failed: { title: string; error: string }[] }>(`${base}/categories`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ from, to }) });
      await reload();
      // Joining two categories cannot be split again by name: each recipe that changed gets its own categories back.
      const changed = before.filter(old => {
        const now = recipesRef.current?.find(r => r.id === old.id);
        return now && JSON.stringify(now.categories) !== JSON.stringify(old.categories);
      });
      if (changed.length) offerUndo(`Se cambió la categoría en ${changed.length === 1 ? "1 receta" : `${changed.length} recetas`}.`, async () => {
        const failed: string[] = [];
        for (const old of changed) await restore(old).catch(() => failed.push(old.title));
        if (failed.length) throw new Error(`No se pudo deshacer en: ${failed.join(", ")}. Revisalas a mano.`);
      });
      return result;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally { setBusy(false); }
  }, [base, reload, restore]);
  return <PanelContext.Provider value={{ ready: Boolean(recipes), loadError, reload, error, setError, busy, setBusy, flushRef, setDirty, badges: { comentarios: pendingCount(comments ?? []) } }}>
    <RecipesContext.Provider value={{ recipes, save, remove, comments, commentsError, moderate, removeComment, renameCategory }}>{children}</RecipesContext.Provider>
  </PanelContext.Provider>;
}
