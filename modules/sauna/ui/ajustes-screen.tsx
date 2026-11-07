"use client";

import { PageHeader, SaveForm, usePanel, useSite } from "@/platform/panel";
import type { PageContent } from "../domain/page";
import type { Settings } from "../domain/setup";
import type { Config } from "./config";
import { Button, Card, Field, FormArea, inputClass, Notice } from "./controls";
import { sendJson } from "./fetch-json";
import { useResource } from "./use-resource";

const textareaClass = `${inputClass} py-2`;

function ListField({
  label,
  name,
  value,
  hint,
}: {
  label: string;
  name: string;
  value: string[];
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint ?? "Una por línea."}>
      <textarea
        className={textareaClass}
        name={name}
        rows={4}
        defaultValue={value.join("\n")}
      />
    </Field>
  );
}

function SiteForm({
  settings,
  page,
  onSaved,
}: {
  settings: Settings;
  page: PageContent;
  onSaved: () => Promise<void>;
}) {
  const site = useSite();
  const panel = usePanel();
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
  // Keep the inputs mounted when revisions refresh: they already hold what was saved.
  return (
    <FormArea>
      <SaveForm
        onSave={save}
        changes=""
        paused={panel.busy}
        error={panel.error}
        registerRef={panel.flushRef}
      >
        <div className="mb-4 grid max-w-3xl gap-4">
          <Card className="grid gap-4">
            <h2 className="m-0 text-lg font-semibold text-ink">Portada</h2>
            <Field label="Título">
              <input
                className={inputClass}
                name="headline"
                maxLength={70}
                defaultValue={page.headline}
                required
              />
            </Field>
            <Field label="Presentación">
              <textarea
                className={textareaClass}
                name="intro"
                rows={2}
                maxLength={200}
                defaultValue={page.intro}
              />
            </Field>
            <Field label="Descripción para buscadores y enlaces compartidos">
              <textarea
                className={textareaClass}
                name="description"
                rows={2}
                maxLength={200}
                defaultValue={page.description}
              />
            </Field>
          </Card>
          <Card className="grid gap-4">
            <h2 className="m-0 text-lg font-semibold text-ink">Tu visita</h2>
            <p className="m-0 text-muted">
              Una sección sin líneas no se muestra en el sitio.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <ListField
                label="Qué incluye"
                name="includes"
                value={page.includes}
              />
              <ListField label="Qué traer" name="bring" value={page.bring} />
            </div>
          </Card>
          <Card className="grid gap-4">
            <h2 className="m-0 text-lg font-semibold text-ink">
              Antes de venir
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <ListField
                label="Recomendaciones"
                name="recommendations"
                value={page.recommendations}
              />
              <ListField
                label="Indicaciones"
                name="indications"
                value={page.indications}
              />
              <ListField
                label="Contraindicaciones"
                name="contraindications"
                value={page.contraindications}
              />
            </div>
          </Card>
          <Card className="grid gap-4">
            <h2 className="m-0 text-lg font-semibold text-ink">
              Cómo llegar y contacto
            </h2>
            <Field label="Dirección">
              <input
                className={inputClass}
                name="address"
                maxLength={200}
                defaultValue={page.address}
              />
            </Field>
            <Field
              label="Enlace al mapa"
              hint="Pegá el enlace de Google Maps. Empieza con https://."
            >
              <input
                className={inputClass}
                name="mapUrl"
                type="url"
                maxLength={500}
                defaultValue={page.mapUrl}
              />
            </Field>
            <Field
              label="WhatsApp de contacto"
              hint="Quien reservó escribe a este número desde su reserva."
            >
              <input
                className={inputClass}
                name="contactWhatsapp"
                type="tel"
                defaultValue={settings.contactWhatsapp ?? ""}
              />
            </Field>
          </Card>
          <Card className="grid gap-4 sm:grid-cols-2">
            <h2 className="m-0 text-lg font-semibold text-ink sm:col-span-2">
              Cómo se reserva
            </h2>
            <Field
              label="Anticipación mínima, en minutos"
              hint="Hasta cuándo se puede reservar un turno."
            >
              <input
                className={inputClass}
                name="minLeadMinutes"
                type="number"
                min={0}
                max={10080}
                defaultValue={settings.minLeadMinutes}
                required
              />
            </Field>
            <Field
              label="Horizonte, en días"
              hint="Cuánto hacia adelante se puede reservar."
            >
              <input
                className={inputClass}
                name="maxAdvanceDays"
                type="number"
                min={1}
                max={365}
                defaultValue={settings.maxAdvanceDays}
                required
              />
            </Field>
            <Field
              label="Retención con Mercado Pago, en minutos"
              hint="Cuánto se guarda el lugar mientras se paga."
            >
              <input
                className={inputClass}
                name="mpHoldMinutes"
                type="number"
                min={1}
                max={1440}
                defaultValue={settings.mpHoldMinutes}
                required
              />
            </Field>
            <Field label="Retención con transferencia, en horas">
              <input
                className={inputClass}
                name="transferHoldHours"
                type="number"
                min={1}
                max={168}
                defaultValue={settings.transferHoldHours}
                required
              />
            </Field>
          </Card>
          <Card className="grid gap-4">
            <h2 className="m-0 text-lg font-semibold text-ink">
              Términos y condiciones
            </h2>
            <Field
              label="Texto"
              hint="Separá los párrafos con una línea en blanco."
            >
              <textarea
                className={textareaClass}
                name="terms"
                rows={14}
                maxLength={8000}
                defaultValue={page.terms}
              />
            </Field>
          </Card>
        </div>
      </SaveForm>
    </FormArea>
  );
}

export function AjustesScreen() {
  const site = useSite();
  const { data, error, reload } = useResource<Config>(
    `/api/sites/${site.id}/sauna/config`,
  );
  const header = (
    <PageHeader
      title="Sitio"
      description="Lo que dice el sitio público y cómo se reserva."
    />
  );
  if (error && !data)
    return (
      <>
        {header}
        <div className="grid justify-items-start gap-2">
          <Notice kind="error">{error}</Notice>
          <Button onClick={() => void reload()}>Reintentar</Button>
        </div>
      </>
    );
  if (!data)
    return (
      <>
        {header}
        <p className="text-muted" aria-busy="true">
          Cargando…
        </p>
      </>
    );
  if (!data.settings)
    return (
      <>
        {header}
        <Notice kind="error">
          Falta la configuración del sitio: corré supabase/schema.sql.
        </Notice>
      </>
    );
  return (
    <>
      {header}
      <SiteForm settings={data.settings} page={data.page} onSaved={reload} />
    </>
  );
}
