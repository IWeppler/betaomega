"use client";

import { WarningCircle } from "@phosphor-icons/react";
import { recipeShareInfo, type RecipeInput } from "@/lib/recipes";

/** How the recipe will look in Google and in a WhatsApp message, from the form as it is now (saved or not). */
export function SharePreview({ recipe, siteName, siteUrl, origin }: { recipe: Pick<RecipeInput, "title" | "slug" | "summary" | "image">; siteName: string; siteUrl: string; origin: string }) {
  const share = recipeShareInfo(recipe, siteName);
  const domain = new URL(siteUrl).host.replace(/^www\./, "");
  const image = share.image ?? `${origin}/og`;
  return <details className="share-preview">
    <summary>Cómo se ve al compartir</summary>
    <div className="share-preview-body">
      {share.warnings.length > 0 && <ul className="share-warnings">
        {share.warnings.map(w => <li key={w}><WarningCircle size={16} weight="fill" aria-hidden="true" />{w}</li>)}
      </ul>}
      <figure className="share-card">
        <figcaption>Google</figcaption>
        <div className="share-google">
          <span className="share-google-url">{domain}{share.path === "/" ? "" : ` › ${share.path.slice(1)}`}</span>
          <span className="share-google-title">{share.pageTitle}</span>
          <span className="share-google-desc">{share.description.length > 160 ? `${share.description.slice(0, 157).trimEnd()}…` : share.description}</span>
        </div>
      </figure>
      <figure className="share-card">
        <figcaption>WhatsApp</figcaption>
        <div className="share-whatsapp">
          {/* The photo is the recipe's own upload or the site's /og image; next/image would resize what chat apps fetch at full size. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="" />
          <div>
            <strong>{share.pageTitle}</strong>
            <span>{share.description}</span>
            <small>{domain}</small>
          </div>
        </div>
      </figure>
    </div>
  </details>;
}
