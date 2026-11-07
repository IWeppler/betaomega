"use client";

import { useRef, useState, type ReactNode } from "react";
import { PanelContext } from "@/platform/panel";

const reload = async () => {};
const setDirty = () => {};

/** The state the shell needs from a kind's provider. There is no data to load until the sections of phase S2 exist. */
export function SaunaProvider({ children }: { children: ReactNode }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const flushRef = useRef(async () => true);
  return <PanelContext.Provider value={{ ready: true, loadError: "", reload, error, setError, busy, setBusy, flushRef, setDirty }}>{children}</PanelContext.Provider>;
}
