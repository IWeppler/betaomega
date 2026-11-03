"use client";

import { useEffect, useRef, useState } from "react";
import { api, Field } from "@/app/admin-fields";
import { SaveForm } from "@/app/save-form";
import {
  defaultDonation,
  recipeSiteDefaults,
  type SiteSettings,
} from "@/lib/site-settings";
import { usePanel } from "../panel-context";
import { PageHeader } from "../shell";
import { useParams } from "next/navigation";

export default function SitePage() {
  const { site } = useParams<{ site: string }>();
  const { busy, setBusy, error, setError, flushRef } = usePanel();
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loadError, setLoadError] = useState("");
  // The revision of the last save: the next one must start from it.
  const revision = useRef(0);
  const base = `/api/sites/${site}/settings`;
  useEffect(() => {
    let current = true;
    api<SiteSettings>(base)
      .then((data) => {
        if (current) {
          revision.current = data.revision;
          setSettings(data);
        }
      })
      .catch((e: Error) => {
        if (current) setLoadError(e.message);
      });
    return () => {
      current = false;
    };
  }, [base]);

  const submit = async (element: HTMLFormElement) => {
    const form = new FormData(element);
    const text = (key: string) => String(form.get(key) || "").trim();
    setBusy(true);
    setError("");
    try {
      const saved = await api<SiteSettings>(base, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          revision: revision.current,
          tagline: text("tagline"),
          description: text("description"),
          instagram: text("instagram"),
          contact: text("contact"),
          donation: text("donation"),
        }),
      });
      revision.current = saved.revision;
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Sitio"
        description="Textos y contacto que se ven en el sitio público. Los colores y las tipografías no se editan acá."
      />
      {loadError && (
        <div className="alert error" role="alert">
          {loadError}
        </div>
      )}
      {!settings && !loadError && (
        <div className="panel-skeleton" aria-busy="true" aria-label="Cargando">
          <span className="panel-skeleton-row" />
          <span className="panel-skeleton-row" />
        </div>
      )}
      {settings && (
        <section className="panel-card panel-pad">
          <SaveForm
            error={error}
            registerRef={flushRef}
            paused={busy}
            onSave={submit}
            changes=""
          >
            <Field
              label="Lema"
              name="tagline"
              value={settings.tagline}
              hint={`Título de la portada y de las búsquedas. Vacío: “${recipeSiteDefaults.tagline}”.`}
            />
            <Field
              label="Descripción para buscadores"
              name="description"
              value={settings.description}
              multiline
              rows={3}
              hint={`Lo que Google y WhatsApp muestran del sitio (hasta 160 caracteres se ve completo). Vacío: “${recipeSiteDefaults.description}”.`}
            />
            <div className="form-grid">
              <Field
                label="Instagram"
                name="instagram"
                value={settings.instagram}
                hint="Tu usuario, por ejemplo @comidasdelcielo. Opcional."
              />
              <Field
                label="Contacto"
                name="contact"
                value={settings.contact}
                hint="Un mail o un WhatsApp con código de país (+54 9 11 5555 1234). Opcional."
              />
            </div>
            <Field
              label="Donaciones (Mercado Pago)"
              name="donation"
              value={settings.donation ?? defaultDonation}
              hint="Un enlace de pago como por ejemplo: https://link.mercadopago.com.ar/betayomega. Vacío: se oculta el botón de donar."
            />
            <p className="panel-muted">
              Instagram, contacto y donaciones aparecen en el pie del sitio. Los
              cambios se ven al recargar, sin desplegar.
            </p>
          </SaveForm>
        </section>
      )}
    </>
  );
}
