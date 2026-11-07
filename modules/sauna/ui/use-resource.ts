"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchJson } from "./fetch-json";

/**
 * Data of a screen of this module. Unlike the other kinds of site there is no list loaded once for the whole panel (pattern 6): what a screen reads depends on its dates.
 * With `live`, it follows what happens while the screen stays open: people book from the public site.
 */
export function useResource<T>(url: string, { live = false }: { live?: boolean } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loadedUrl, setLoadedUrl] = useState("");
  // An answer for a page the person already left must not replace the current one.
  const latest = useRef(url);
  const reload = useCallback(async () => {
    latest.current = url;
    try {
      const next = await fetchJson<T>(url);
      if (latest.current !== url) return;
      setData(next);
      setLoadedUrl(url);
      setError("");
    } catch (failure) {
      if (latest.current === url) setError((failure as Error).message);
    }
  }, [url]);
  useEffect(() => { void Promise.resolve().then(reload); }, [reload]);
  useEffect(() => {
    if (!live) return;
    const refresh = () => void reload();
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 30_000);
    return () => { window.removeEventListener("focus", refresh); window.clearInterval(timer); };
  }, [live, reload]);
  return { data, error, reload, loading: !error && loadedUrl !== url };
}
