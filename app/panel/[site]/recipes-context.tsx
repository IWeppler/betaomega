"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "@/app/admin-fields";
import { pendingCount, type CommentStatus, type RecipeComment } from "@/lib/comments";
import type { Recipe, RecipeInput } from "@/lib/recipes";
import { PanelContext } from "./panel-context";

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

// Same rules as the catalogue: loaded once for the whole panel, refreshed on focus and every 30 s unless something is being edited.
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
    const timer = window.setInterval(refresh, 30000);
    return () => { window.removeEventListener("focus", refresh); window.clearInterval(timer); };
  }, [reload, busy, dirty]);
  const save = useCallback(async (recipe: RecipeInput) => {
    setBusy(true);
    setError("");
    try {
      const saved = await api<Recipe>(`${base}/${recipe.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(recipe) });
      setRecipes(list => [...(list ?? []).filter(r => r.id !== saved.id), saved].sort((a, b) => a.title.localeCompare(b.title, "es")));
      return saved;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally { setBusy(false); }
  }, [base]);
  const remove = useCallback(async (id: string) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${base}/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || "No se pudo eliminar la receta.");
      setRecipes(list => (list ?? []).filter(r => r.id !== id));
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally { setBusy(false); }
  }, [base]);
  const moderate = useCallback(async (id: string, status: CommentStatus) => {
    setBusy(true);
    setError("");
    try {
      const updated = await api<RecipeComment>(`/api/sites/${siteId}/comments/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      setComments(list => (list ?? []).map(c => (c.id === id ? updated : c)));
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally { setBusy(false); }
  }, [siteId]);
  const removeComment = useCallback(async (id: string) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/sites/${siteId}/comments/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || "No se pudo eliminar el comentario.");
      setComments(list => (list ?? []).filter(c => c.id !== id));
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally { setBusy(false); }
  }, [siteId]);
  const renameCategory = useCallback(async (from: string, to: string) => {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ to: string; changed: number; failed: { title: string; error: string }[] }>(`${base}/categories`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ from, to }) });
      await reload();
      return result;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally { setBusy(false); }
  }, [base, reload]);
  return <PanelContext.Provider value={{ ready: Boolean(recipes), loadError, reload, error, setError, busy, setBusy, flushRef, setDirty, badges: { comentarios: pendingCount(comments ?? []) } }}>
    <RecipesContext.Provider value={{ recipes, save, remove, comments, commentsError, moderate, removeComment, renameCategory }}>{children}</RecipesContext.Provider>
  </PanelContext.Provider>;
}
