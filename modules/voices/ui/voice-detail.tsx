import { ArrowLeft, Check } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { youtubeEmbed, type Product } from "@/platform/products";
import { VoiceTracker } from "./tracker";

/**
 * The page of a voz sagrada on a site with the news home page: no cover picture; the name and the video across the whole width; under them
 * the text and, beside it on wide screens, what it is for (each phrase a search). The text keeps a reading measure: very long lines tire.
 */
export function VoiceDetail({ siteId, siteName, voice, descriptionLabel, below }: {
  siteId: string; siteName: string; voice: Pick<Product, "id" | "name" | "description" | "keywords" | "video">; descriptionLabel: string; below?: ReactNode;
}) {
  const video = voice.video ? youtubeEmbed(voice.video) : null;
  return <main className="mx-auto w-full max-w-[1360px] flex-1 px-4 pt-6 pb-18 sm:px-8">
    {/* 1360px: the width of the news bar (NewsNav), so both edges line up. */}
    <VoiceTracker siteId={siteId} voiceId={voice.id} />
    <article className="grid gap-8">
      {/* Back as a round icon beside the name, on its line: one row instead of a link above. Smaller on a phone, so the name fits one line. */}
      <div className="flex items-center gap-3 sm:gap-5">
        <Link href="/" aria-label={`Volver a ${siteName}`} title={`Volver a ${siteName}`}
          className="inline-grid size-11 shrink-0 place-items-center rounded-full border border-line bg-white text-ink no-underline transition-[background-color,border-color,scale] duration-150 hover:border-line-strong hover:bg-sunken active:scale-95 motion-reduce:active:scale-100 sm:size-14">
          <ArrowLeft size={22} aria-hidden="true" />
        </Link>
        <h1 className="m-0 min-w-0 font-display text-4xl/none font-bold text-balance sm:text-6xl/none lg:text-8xl/none">{voice.name}</h1>
      </div>
      {video && <div className="aspect-video w-full overflow-hidden rounded-card bg-black">
        {/* Embedded, not linked: the privacy-enhanced player sets no cookies until it is played. */}
        <iframe className="size-full border-0" src={video} title={`Video: ${voice.name}`} referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
      </div>}
      <div className="grid items-start gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="grid max-w-prose gap-3" aria-labelledby="voice-text">
          <h2 id="voice-text" className="m-0 font-display text-3xl font-bold text-ink">{descriptionLabel}</h2>
          {voice.description.split(/\n+/).map((paragraph, n) => <p key={n} className="m-0 text-lg">{paragraph}</p>)}
        </section>
        {voice.keywords.length > 0 && <section className="grid gap-3 lg:sticky lg:top-6" aria-labelledby="voice-uses">
          <h2 id="voice-uses" className="m-0 font-display text-3xl font-bold text-ink">Para qué sirve</h2>
          <ul className="m-0 grid list-none gap-1 p-0">
            {voice.keywords.map(keyword => <li key={keyword}>
              <Link href={`/?q=${encodeURIComponent(keyword)}`} className="flex min-h-11 items-start gap-2.5 py-1.5 no-underline decoration-accent underline-offset-4 hover:underline">
                <Check size={18} strokeWidth={2.5} aria-hidden="true" className="mt-1 shrink-0 text-muted" />{keyword}
              </Link>
            </li>)}
          </ul>
        </section>}
      </div>
      {below}
    </article>
  </main>;
}
