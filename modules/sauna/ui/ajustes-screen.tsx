"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { PageHeader, SaveForm, usePanel, useSite } from "@/platform/panel";
import type { PageContent } from "../domain/page";
import type { Settings } from "../domain/setup";
import { businessDate, dayLabel } from "../domain/time";
import type { Config } from "./config";
import { Button, buttonClass, Card, Field, FormArea, inputClass, Notice } from "./controls";
import { sendJson } from "./fetch-json";
import { useResource } from "./use-resource";

const textareaClass = `${inputClass} py-2`;

const tabs = [
  { id: "portada", label: "Portada" },
  { id: "visita", label: "Tu visita" },
  { id: "contacto", label: "Contacto" },
  { id: "reservas", label: "Reservas" },
  { id: "cobros", label: "Cobros" },
  { id: "terminos", label: "Términos" },
] as const;
type TabId = (typeof tabs)[number]["id"];
const isTab = (value: string): value is TabId => tabs.some(tab => tab.id === value);

function ListField({ label, name, value, hint }: { label: string; name: string; value: string[]; hint?: string }) {
  return <Field label={label} hint={hint ?? "Una por línea."}>
    <textarea className={textareaClass} name={name} rows={5} defaultValue={value.join("\n")} />
  </Field>;
}

/** One block of a tab: a title, what it is for, and its fields. */
function Section({ title, text, children, columns = false }: { title: string; text?: string; children: ReactNode; columns?: boolean }) {
  return <Card className="grid gap-4">
    <div className="grid gap-1">
      <h2 className="m-0 text-lg font-semibold text-ink">{title}</h2>
      {text && <p className="m-0 text-muted">{text}</p>}
    </div>
    <div className={columns ? "grid gap-4 sm:grid-cols-2" : "grid gap-4"}>{children}</div>
  </Card>;
}

/**
 * A tab's content. Every panel stays mounted and only the chosen one shows: the form sends all of them with one Guardar, and what was typed in another
 * tab is not lost when switching.
 */
function TabPanel({ id, current, children }: { id: TabId; current: TabId; children: ReactNode }) {
  return <div role="tabpanel" id={`tab-${id}`} aria-labelledby={`tab-${id}-button`} data-tab={id} hidden={id !== current} className="grid gap-4">{children}</div>;
}

function TabList({ current, onChange }: { current: TabId; onChange: (tab: TabId) => void }) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  // The keys of the WAI-ARIA tabs pattern: arrows move and choose, Home and End jump to the ends.
  const move = (event: KeyboardEvent, index: number) => {
    const next = event.key === "ArrowRight" ? index + 1 : event.key === "ArrowLeft" ? index - 1 : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    const target = (next + tabs.length) % tabs.length;
    onChange(tabs[target].id);
    buttons.current[target]?.focus();
  };
  return <div role="tablist" aria-label="Secciones de la configuración" className="-mx-1 mb-4 flex gap-1 overflow-x-auto border-b border-line px-1 [scrollbar-width:none]">
    {tabs.map((tab, index) => {
      const selected = tab.id === current;
      return <button
        key={tab.id}
        ref={element => { buttons.current[index] = element; }}
        type="button"
        role="tab"
        id={`tab-${tab.id}-button`}
        aria-selected={selected}
        aria-controls={`tab-${tab.id}`}
        tabIndex={selected ? 0 : -1}
        onClick={() => onChange(tab.id)}
        onKeyDown={event => move(event, index)}
        className={`-mb-px min-h-control shrink-0 border-b-2 px-3 font-medium whitespace-nowrap transition-colors duration-150 ${selected ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"}`}
      >{tab.label}</button>;
    })}
  </div>;
}

const resultNotices: Record<string, { kind: "warn" | "error"; text: string } | undefined> = {
  conectado: { kind: "warn", text: "Listo: la cuenta de Mercado Pago quedó conectada. Desde ahora las señas se cobran en esa cuenta." },
  cancelado: { kind: "warn", text: "No se conectó ninguna cuenta: la autorización se canceló en Mercado Pago." },
  error: { kind: "error", text: "No se pudo conectar la cuenta. Probá de nuevo; si sigue fallando, revisá que la aplicación de Mercado Pago tenga cargada la URL de redireccionamiento." },
  dominio: { kind: "error", text: "Para conectar la cuenta, abrí el panel desde la misma dirección que la URL de redireccionamiento de la aplicación de Mercado Pago (MERCADOPAGO_REDIRECT_URL)." },
  pais: { kind: "error", text: "Esa cuenta no es de Mercado Pago Argentina. Las señas se cobran en pesos, así que hay que conectar una cuenta argentina." },
};

/** The account the deposits go into. Connecting is OAuth: Mercado Pago asks the owner to authorize, and the panel only keeps the encrypted tokens. */
function MercadoPagoCard({ status, result, onChanged }: { status: Config["mercadopago"]; result: string | null; onChanged: () => Promise<void> }) {
  const site = useSite();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const connectHref = `/api/sites/${site.id}/sauna/mercadopago/connect`;
  const notice = result ? resultNotices[result] : undefined;
  const disconnect = async () => {
    setBusy(true);
    setError("");
    try {
      await sendJson(connectHref, "DELETE");
      setConfirming(false);
      await onChanged();
    } catch (failure) { setError((failure as Error).message); } finally { setBusy(false); }
  };
  const account = status?.account ?? null;
  return <Section title="Mercado Pago" text="Quien reserva paga la seña con Mercado Pago y la reserva se confirma sola. El dinero entra a la cuenta conectada.">
    {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}
    {!status?.configured
      ? <Notice>Falta configurar la aplicación de Mercado Pago en el servidor (MERCADOPAGO_CLIENT_ID, MERCADOPAGO_CLIENT_SECRET y MERCADOPAGO_WEBHOOK_SECRET). Hasta entonces el sitio no ofrece este medio.</Notice>
      : account
        ? <div className="grid gap-3">
          <div className="grid gap-0.5 rounded-field border border-line bg-bg p-3">
            <span className="text-muted">Cuenta conectada</span>
            <strong className="text-ink">{account.nickname || `Usuario ${account.userId}`}</strong>
            <span className="text-muted">N.º {account.userId} · desde el {dayLabel(businessDate(account.connectedAt))}{account.liveMode ? "" : " · modo de prueba"}</span>
          </div>
          {confirming
            ? <div className="grid gap-2">
              <p className="m-0 text-ink">Si desconectás la cuenta, el sitio deja de ofrecer Mercado Pago hasta que conectes otra. Los pagos ya hechos no cambian.</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="danger" disabled={busy} onClick={() => void disconnect()}>{busy ? "Desconectando…" : "Sí, desconectar"}</Button>
                <Button disabled={busy} onClick={() => setConfirming(false)}>No, volver</Button>
              </div>
            </div>
            : <div className="flex flex-wrap gap-2">
              <a className={buttonClass()} href={connectHref}>Cambiar de cuenta</a>
              <Button variant="danger" onClick={() => setConfirming(true)}>Desconectar</Button>
            </div>}
          <p className="m-0 text-sm text-muted">Para elegir otra cuenta, primero cerrá la sesión de Mercado Pago en este navegador: si no, Mercado Pago autoriza la que tenga abierta.</p>
        </div>
        : <div className="grid justify-items-start gap-2">
          <p className="m-0 text-ink">Todavía no hay una cuenta conectada, así que el sitio no ofrece Mercado Pago.</p>
          <a className={buttonClass("primary")} href={connectHref}>Conectar Mercado Pago</a>
          <p className="m-0 text-sm text-muted">Vas a ir a Mercado Pago para entrar con la cuenta donde querés recibir las señas y autorizar el cobro. Después volvés acá.</p>
        </div>}
    {error && <Notice kind="error">{error}</Notice>}
  </Section>;
}

function SiteForm({ settings, page, mercadopago, onSaved }: { settings: Settings; page: PageContent; mercadopago: Config["mercadopago"]; onSaved: () => Promise<void> }) {
  const site = useSite();
  const panel = usePanel();
  const [tab, setTab] = useState<TabId>("portada");
  const [result, setResult] = useState<string | null>(null);
  // The tab lives in the address (#cobros), so a reload and the return from Mercado Pago land on it. The result of connecting is read once and removed.
  useEffect(() => {
    void Promise.resolve().then(() => {
      const hash = window.location.hash.slice(1);
      if (isTab(hash)) setTab(hash);
      const params = new URLSearchParams(window.location.search);
      const answer = params.get("mercadopago");
      if (answer) {
        setResult(answer);
        params.delete("mercadopago");
        const query = params.toString();
        window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
      }
    });
  }, []);
  const choose = (next: TabId) => {
    setTab(next);
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${next}`);
  };
  const save = async (form: HTMLFormElement) => {
    const values = new FormData(form);
    const text = (name: string) => String(values.get(name) ?? "");
    panel.setBusy(true);
    panel.setError("");
    try {
      await sendJson(`/api/sites/${site.id}/sauna/config`, "PATCH", {
        ...settings,
        minLeadMinutes: Number(values.get("minLeadMinutes")),
        maxAdvanceDays: Number(values.get("maxAdvanceDays")),
        mpHoldMinutes: Number(values.get("mpHoldMinutes")),
        transferHoldHours: Number(values.get("transferHoldHours")),
        contactWhatsapp: values.get("contactWhatsapp"),
        transferAlias: text("transferAlias"),
        transferCbu: text("transferCbu"),
        transferHolder: text("transferHolder"),
      });
      await sendJson(`/api/sites/${site.id}/sauna/page`, "PUT", {
        revision: page.revision,
        headline: text("headline"),
        intro: text("intro"),
        description: text("description"),
        address: text("address"),
        mapUrl: text("mapUrl"),
        terms: text("terms"),
        includes: text("includes"),
        bring: text("bring"),
        recommendations: text("recommendations"),
        indications: text("indications"),
        contraindications: text("contraindications"),
      });
      await onSaved();
      return true;
    } catch (failure) {
      panel.setError((failure as Error).message);
      return false;
    } finally {
      panel.setBusy(false);
    }
  };
  // A required field left empty in a hidden tab would block Guardar without showing why: its tab opens so the browser can point at it.
  const showInvalid = (target: EventTarget) => {
    const owner = (target as HTMLElement).closest?.("[data-tab]")?.getAttribute("data-tab");
    if (owner && isTab(owner) && owner !== tab) choose(owner);
  };
  // Keep the inputs mounted when revisions refresh: they already hold what was saved.
  return <>
    <TabList current={tab} onChange={choose} />
    <FormArea>
      <SaveForm onSave={save} changes="" paused={panel.busy} error={panel.error} registerRef={panel.flushRef}>
        <div className="mb-4 grid max-w-3xl gap-4" onInvalidCapture={event => showInvalid(event.target)}>
          <TabPanel id="portada" current={tab}>
            <Section title="Portada" text="Lo primero que se lee al entrar al sitio.">
              <Field label="Título"><input className={inputClass} name="headline" maxLength={70} defaultValue={page.headline} required /></Field>
              <Field label="Presentación" hint="Una o dos frases debajo del título.">
                <textarea className={textareaClass} name="intro" rows={2} maxLength={200} defaultValue={page.intro} />
              </Field>
              <Field label="Descripción para buscadores y enlaces compartidos" hint="Lo que muestran Google y WhatsApp al compartir el sitio.">
                <textarea className={textareaClass} name="description" rows={2} maxLength={200} defaultValue={page.description} />
              </Field>
            </Section>
          </TabPanel>

          <TabPanel id="visita" current={tab}>
            <Section title="Tu visita" text="Una lista sin líneas no se muestra en el sitio." columns>
              <ListField label="Qué incluye" name="includes" value={page.includes} />
              <ListField label="Qué traer" name="bring" value={page.bring} />
            </Section>
            <Section title="Antes de venir" text="Textos de salud: conviene que los revise un profesional antes de publicarlos." columns>
              <ListField label="Recomendaciones" name="recommendations" value={page.recommendations} />
              <ListField label="Indicaciones" name="indications" value={page.indications} />
              <ListField label="Contraindicaciones" name="contraindications" value={page.contraindications} />
            </Section>
          </TabPanel>

          <TabPanel id="contacto" current={tab}>
            <Section title="Cómo llegar" text="Con el enlace de Google Maps, el sitio muestra el mapa con el lugar marcado.">
              <Field label="Dirección"><input className={inputClass} name="address" maxLength={200} defaultValue={page.address} /></Field>
              <Field label="Enlace al mapa" hint="Pegá el enlace de Google Maps. Empieza con https://.">
                <input className={inputClass} name="mapUrl" type="url" maxLength={500} defaultValue={page.mapUrl} />
              </Field>
            </Section>
            <Section title="WhatsApp">
              <Field label="WhatsApp de contacto" hint="Quien reservó escribe a este número desde su reserva, para consultar, cancelar o mandar un comprobante.">
                <input className={inputClass} name="contactWhatsapp" type="tel" defaultValue={settings.contactWhatsapp ?? ""} />
              </Field>
            </Section>
          </TabPanel>

          <TabPanel id="reservas" current={tab}>
            <Section title="Cuándo se puede reservar" columns>
              <Field label="Anticipación mínima, en minutos" hint="Hasta cuánto antes del turno se puede reservar.">
                <input className={inputClass} name="minLeadMinutes" type="number" min={0} max={10080} defaultValue={settings.minLeadMinutes} required />
              </Field>
              <Field label="Horizonte, en días" hint="Cuánto hacia adelante se puede reservar.">
                <input className={inputClass} name="maxAdvanceDays" type="number" min={1} max={365} defaultValue={settings.maxAdvanceDays} required />
              </Field>
            </Section>
            <Section title="Cuánto se guarda el lugar mientras se paga" text="Si la seña no llega a tiempo, el lugar se libera solo. Nunca pasa del inicio del turno." columns>
              <Field label="Con Mercado Pago, en minutos">
                <input className={inputClass} name="mpHoldMinutes" type="number" min={1} max={1440} defaultValue={settings.mpHoldMinutes} required />
              </Field>
              <Field label="Con transferencia, en horas">
                <input className={inputClass} name="transferHoldHours" type="number" min={1} max={168} defaultValue={settings.transferHoldHours} required />
              </Field>
            </Section>
            <p className="m-0 text-muted">El porcentaje de la seña se configura en Horarios y precios, junto a cada tipo de turno.</p>
          </TabPanel>

          <TabPanel id="cobros" current={tab}>
            <MercadoPagoCard status={mercadopago} result={result} onChanged={onSaved} />
            <Section title="Transferencia" text="Quien reserva ve estos datos y tiene el lugar guardado mientras dura la retención. La confirmás desde Reservas cuando ves el dinero. Dejá los tres vacíos para no ofrecerla." columns>
              <Field label="Alias"><input className={inputClass} name="transferAlias" maxLength={20} autoComplete="off" defaultValue={settings.transferAlias ?? ""} /></Field>
              <Field label="CBU o CVU" hint="22 números.">
                <input className={inputClass} name="transferCbu" inputMode="numeric" maxLength={26} autoComplete="off" defaultValue={settings.transferCbu ?? ""} />
              </Field>
              <Field label="Titular de la cuenta" hint="Como figura en el banco, para que quien transfiere lo pueda comprobar." className="sm:col-span-2">
                <input className={inputClass} name="transferHolder" maxLength={80} autoComplete="off" defaultValue={settings.transferHolder ?? ""} />
              </Field>
            </Section>
          </TabPanel>

          <TabPanel id="terminos" current={tab}>
            <Section title="Términos y condiciones" text="Quien reserva los acepta al tocar Reservar. Separá los párrafos con una línea en blanco.">
              <Field label="Texto"><textarea className={textareaClass} name="terms" rows={16} maxLength={8000} defaultValue={page.terms} /></Field>
            </Section>
          </TabPanel>
        </div>
      </SaveForm>
    </FormArea>
  </>;
}

export function AjustesScreen() {
  const site = useSite();
  const { data, error, reload } = useResource<Config>(`/api/sites/${site.id}/sauna/config`);
  const header = <PageHeader title="Configuración" description="Lo que muestra el sitio público, cómo se reserva y cómo se cobra." />;
  if (error && !data) return <>{header}<div className="grid justify-items-start gap-2"><Notice kind="error">{error}</Notice><Button onClick={() => void reload()}>Reintentar</Button></div></>;
  if (!data) return <>{header}<p className="text-muted" aria-busy="true">Cargando…</p></>;
  if (!data.settings) return <>{header}<Notice kind="error">Falta la configuración del sitio: corré supabase/schema.sql.</Notice></>;
  return <>{header}<SiteForm settings={data.settings} page={data.page} mercadopago={data.mercadopago} onSaved={reload} /></>;
}
