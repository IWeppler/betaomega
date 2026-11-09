"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { BellRing, Send, Smartphone, Trash2 } from "lucide-react";
import { PageHeader, useSite } from "@/platform/panel";
import { applicationServerKey } from "@/platform/notifications";
import { showToast } from "@/shared/ui/toast";

// The Avisos screen (docs/tareas-notificaciones.md, points 3 and 4): turn on push in this phone, link a Telegram chat, and see or remove every
// destination. The same screen opens from any site: destinations belong to the panel and choose their sites.

type Destination = { kind: "push" | "telegram"; id: string; label: string; siteIds: string[]; lastSentAt: string | null; endpoint?: string };
type Setup = { pushKey: string | null; telegramBot: string | null; destinations: Destination[]; sites: { id: string; name: string }[] };

const button = "inline-flex min-h-control items-center justify-center gap-1.5 rounded-control px-3.5 font-semibold transition-colors duration-150 disabled:opacity-55";
const primary = `${button} bg-accent text-accent-ink hover:bg-accent-hover`;
const quiet = `${button} border border-line-strong bg-surface text-ink hover:bg-sunken`;
const field = "min-h-control w-full rounded-field border border-line-strong bg-surface px-3 text-ink";

async function send<T>(url: string, method: string, body?: unknown): Promise<T> {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const answer = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(answer.error || "No se pudo completar. Probá de nuevo.");
  return answer;
}

function Card({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return <section className="grid gap-3 rounded-card border border-line bg-surface p-4">
    <h2 className="m-0 flex items-center gap-2 text-base font-semibold text-ink">{icon}{title}</h2>
    {children}
  </section>;
}

/** Every site checked means "all of them", stored as an empty list so a new site is included too. */
function SiteChooser({ sites, value, onChange }: { sites: Setup["sites"]; value: string[]; onChange: (next: string[]) => void }) {
  const all = value.length === 0;
  const checked = (id: string) => all || value.includes(id);
  const toggle = (id: string) => {
    const current = all ? sites.map(site => site.id) : value;
    const next = current.includes(id) ? current.filter(item => item !== id) : [...current, id];
    onChange(next.length === sites.length ? [] : next);
  };
  return <fieldset className="m-0 grid gap-1.5 border-0 p-0">
    <legend className="mb-1 p-0 text-sm font-semibold text-ink">Avisos de</legend>
    {sites.map(site => <label key={site.id} className="flex min-h-8 items-center gap-2 text-ink">
      <input type="checkbox" className="size-4" checked={checked(site.id)} onChange={() => toggle(site.id)} />{site.name}
    </label>)}
  </fieldset>;
}

const sitesText = (destination: Destination, sites: Setup["sites"]) =>
  destination.siteIds.length === 0 ? "Todos los sitios" : destination.siteIds.map(id => sites.find(site => site.id === id)?.name ?? id).join(", ");

const lastText = (instant: string | null) => instant ? `Último aviso: ${new Date(instant).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}` : "Todavía sin avisos";

/** Where this browser stands with push: unsupported, worker missing (development), or ready with its current subscription. */
type PushState = { kind: "unsupported" } | { kind: "no-worker" } | { kind: "ready"; endpoint: string | null; permission: NotificationPermission };

async function readPushState(): Promise<PushState> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return { kind: "unsupported" };
  const registration = await navigator.serviceWorker.getRegistration("/panel-sw.js");
  if (!registration) return { kind: "no-worker" };
  const subscription = await registration.pushManager.getSubscription();
  return { kind: "ready", endpoint: subscription?.endpoint ?? null, permission: Notification.permission };
}

export function AvisosScreen() {
  const site = useSite();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [error, setError] = useState("");
  const [push, setPush] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState("Mi celular");
  const [siteIds, setSiteIds] = useState<string[]>([]);
  const [telegramLabel, setTelegramLabel] = useState("Telegram");
  const [telegramSites, setTelegramSites] = useState<string[]>([]);
  const [telegramLink, setTelegramLink] = useState<string | null>(null);
  const [editing, setEditing] = useState<Destination | null>(null);

  const load = useCallback(async () => {
    try {
      setSetup(await send<Setup>("/api/panel/notifications/setup", "GET"));
      setError("");
    } catch (failure) { setError((failure as Error).message); }
    setPush(await readPushState().catch(() => ({ kind: "unsupported" as const })));
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try { await action(); } catch (failure) { showToast((failure as Error).message, 6000); }
    setBusy(false);
  };

  const activate = () => run(async () => {
    if (!setup?.pushKey) return;
    if (await Notification.requestPermission() !== "granted") throw new Error("El celular no dio permiso para avisar. Habilitalo en los ajustes del navegador para este sitio.");
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription()
      ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey(setup.pushKey) });
    await send("/api/panel/notifications/push", "POST", { subscription: subscription.toJSON(), label, siteIds });
    showToast("Listo: este celular va a recibir los avisos.");
    await load();
  });

  const remove = (destination: Destination) => run(async () => {
    await send("/api/panel/notifications/destinations", "DELETE", { kind: destination.kind, id: destination.id });
    // Removing this phone also drops its subscription, so the browser does not keep a dead one.
    if (push?.kind === "ready" && destination.endpoint === push.endpoint) {
      const registration = await navigator.serviceWorker.getRegistration("/panel-sw.js");
      await (await registration?.pushManager.getSubscription())?.unsubscribe();
    }
    showToast(`Se quitó ${destination.label || "el destino"}.`);
    await load();
  });

  const saveEdit = () => run(async () => {
    if (!editing) return;
    await send("/api/panel/notifications/destinations", "PATCH", { kind: editing.kind, id: editing.id, label: editing.label, siteIds: editing.siteIds });
    setEditing(null);
    await load();
  });

  const test = () => run(async () => {
    const result = await send<{ sent: number; failed: number }>("/api/panel/notifications/test", "POST", { siteId: site.id, label: "el panel" });
    showToast(result.sent ? `Prueba enviada a ${result.sent} ${result.sent === 1 ? "destino" : "destinos"}${result.failed ? `; ${result.failed} no respondieron` : ""}.` : "No hay destinos que respondan todavía.", 6000);
    await load();
  });

  const linkTelegram = () => run(async () => {
    const { url } = await send<{ url: string }>("/api/panel/notifications/telegram", "POST", { label: telegramLabel, siteIds: telegramSites });
    setTelegramLink(url);
    window.open(url, "_blank", "noopener");
  });

  const connectBot = () => run(async () => {
    await send("/api/panel/notifications/telegram", "PUT");
    showToast("El bot quedó conectado a este panel.");
  });

  const thisPhone = push?.kind === "ready" && push.endpoint ? setup?.destinations.find(item => item.endpoint === push.endpoint) : undefined;

  return <>
    <PageHeader title="Avisos" description="Recibí en el celular lo que pasa en todos tus sitios, aunque el panel esté cerrado."
      actions={setup && setup.destinations.length > 0 && <button type="button" className={quiet} disabled={busy} onClick={() => void test()}><Send size={16} aria-hidden="true" />Mandar una prueba</button>} />
    {error && <p role="alert" className="mb-3 rounded-field border border-danger bg-surface px-3 py-2 text-danger">{error}</p>}
    {!setup && !error && <p className="text-muted" aria-busy="true">Cargando…</p>}
    {setup && <div className="grid max-w-2xl gap-4">
      <Card title="Notificaciones en este celular" icon={<Smartphone size={18} aria-hidden="true" />}>
        {!setup.pushKey ? <p className="m-0 text-muted">Falta configurar las claves de las notificaciones (VAPID) en el servidor.</p>
          : push?.kind === "unsupported" ? <p className="m-0 text-muted">Este navegador no recibe notificaciones. En Android, abrí el panel con Chrome.</p>
          : push?.kind === "no-worker" ? <p className="m-0 text-muted">Las notificaciones funcionan en el panel publicado, no en el servidor local.</p>
          : thisPhone ? <div className="grid gap-2">
            <p className="m-0 text-ink">Este celular ya recibe avisos como <strong className="font-semibold">{thisPhone.label || "sin nombre"}</strong> ({sitesText(thisPhone, setup.sites)}).</p>
            <div><button type="button" className={quiet} disabled={busy} onClick={() => void remove(thisPhone)}>Dejar de recibir en este celular</button></div>
          </div>
          : <div className="grid gap-3">
            <label className="grid gap-1"><span className="text-sm font-semibold text-ink">Nombre de este celular</span><input className={field} value={label} maxLength={60} onChange={event => setLabel(event.target.value)} /></label>
            <SiteChooser sites={setup.sites} value={siteIds} onChange={setSiteIds} />
            <div><button type="button" className={primary} disabled={busy} onClick={() => void activate()}><BellRing size={16} aria-hidden="true" />Activar en este celular</button></div>
            {push?.kind === "ready" && push.permission === "denied" && <p className="m-0 text-sm text-danger">El permiso está bloqueado: habilitalo en los ajustes del navegador para este sitio.</p>}
            <p className="m-0 text-sm text-muted">En Android: instalá el panel con &quot;Agregar a la pantalla principal&quot; de Chrome y quitale la optimización de batería, para que los avisos lleguen con la pantalla apagada.</p>
          </div>}
      </Card>

      <Card title="Telegram" icon={<Send size={18} aria-hidden="true" />}>
        {!setup.telegramBot ? <p className="m-0 text-muted">Falta configurar el bot de Telegram en el servidor (TELEGRAM_BOT_TOKEN y TELEGRAM_BOT_USERNAME).</p>
          : <div className="grid gap-3">
            <label className="grid gap-1"><span className="text-sm font-semibold text-ink">Nombre del chat</span><input className={field} value={telegramLabel} maxLength={60} onChange={event => setTelegramLabel(event.target.value)} /></label>
            <SiteChooser sites={setup.sites} value={telegramSites} onChange={setTelegramSites} />
            <div className="flex flex-wrap gap-2">
              <button type="button" className={primary} disabled={busy} onClick={() => void linkTelegram()}>Conectar Telegram</button>
              <button type="button" className={quiet} disabled={busy} onClick={() => void connectBot()}>Conectar el bot a este panel</button>
            </div>
            {telegramLink && <p className="m-0 text-sm text-ink">Se abrió Telegram con @{setup.telegramBot}: tocá <strong className="font-semibold">Iniciar</strong>. Si no se abrió, abrí <a className="break-all text-accent-text underline" href={telegramLink} target="_blank" rel="noopener noreferrer">este enlace</a> en el celular que tiene Telegram. Vale 10 minutos y una sola vez.</p>}
            <p className="m-0 text-sm text-muted">&quot;Conectar el bot a este panel&quot; se hace una sola vez, después de publicar.</p>
          </div>}
      </Card>

      <Card title="Dónde llegan los avisos" icon={<BellRing size={18} aria-hidden="true" />}>
        {setup.destinations.length === 0 ? <p className="m-0 text-muted">Todavía no hay celulares ni chats.</p>
          : <ul className="m-0 grid list-none gap-2 p-0">
            {setup.destinations.map(destination => <li key={`${destination.kind}:${destination.id}`} className="grid gap-2 rounded-field border border-line bg-bg p-3">
              {editing?.id === destination.id ? <>
                <input className={field} value={editing.label} maxLength={60} aria-label="Nombre" onChange={event => setEditing({ ...editing, label: event.target.value })} />
                <SiteChooser sites={setup.sites} value={editing.siteIds} onChange={next => setEditing({ ...editing, siteIds: next })} />
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={primary} disabled={busy} onClick={() => void saveEdit()}>Guardar</button>
                  <button type="button" className={quiet} disabled={busy} onClick={() => setEditing(null)}>Cancelar</button>
                </div>
              </> : <div className="flex items-start gap-3">
                {destination.kind === "push" ? <Smartphone size={18} className="mt-0.5 shrink-0 text-muted" aria-label="Notificación" /> : <Send size={18} className="mt-0.5 shrink-0 text-muted" aria-label="Telegram" />}
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <strong className="font-semibold text-ink">{destination.label || (destination.kind === "push" ? "Celular" : "Telegram")}{destination === thisPhone ? " (este celular)" : ""}</strong>
                  <span className="text-sm text-muted">{sitesText(destination, setup.sites)} · {lastText(destination.lastSentAt)}</span>
                </div>
                <button type="button" className={quiet} disabled={busy || editing !== null} onClick={() => setEditing(destination)}>Editar</button>
                <button type="button" className={`${quiet} px-2.5`} disabled={busy} aria-label={`Quitar ${destination.label || "el destino"}`} onClick={() => void remove(destination)}><Trash2 size={16} aria-hidden="true" /></button>
              </div>}
            </li>)}
          </ul>}
      </Card>
    </div>}
  </>;
}
