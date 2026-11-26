"use client";

import { Eye, ScrollText, ThumbsUp } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import Link from "next/link";
import { youtubeThumbnail, type Product } from "@/platform/products";
import { shortCount, type VideoStats } from "../domain/video-stats";

/** What the home page needs of a voz sagrada: no description, which can be thousands of characters and is read on its own page. */
export type Voice = Pick<Product, "id" | "slug" | "name" | "image" | "video" | "keywords" | "publishedAt"> & { stats?: VideoStats };

/** Its own image, else its video's picture, else nothing (a tinted tile with an icon). */
const pictureOf = (voice: Voice, size: "hq" | "max") => voice.image || (voice.video ? youtubeThumbnail(voice.video, size) : null);

/** On the last one published. White on a picture: it sits on photos and on the shade of the lead. */
function NewBadge() {
  return <span className="inline-flex min-h-7 items-center rounded-full bg-white px-3 text-sm font-bold text-ink">Nuevo</span>;
}

/** Views · likes of its video on YouTube, like the time and servings of a recipe card. Nothing when YouTube gave nothing. */
function VideoMeta({ stats, light = false }: { stats?: VideoStats; light?: boolean }) {
  if (stats?.views === undefined && stats?.likes === undefined) return null;
  return <span className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold ${light ? "text-white/90" : "text-muted"}`}>
    {stats.views !== undefined && <span className="inline-flex items-center gap-1.5"><Eye size={16} aria-hidden="true" />{shortCount(stats.views)}<span className="sr-only"> visualizaciones en YouTube</span></span>}
    {stats.likes !== undefined && <span className="inline-flex items-center gap-1.5"><ThumbsUp size={16} aria-hidden="true" />{shortCount(stats.likes)}<span className="sr-only"> me gusta en YouTube</span></span>}
  </span>;
}

/** The picture in its frame: under the pointer of the card around it (`group`) it grows by a hair, slowly. */
function Picture({ voice, sizes, priority = false, big = false }: { voice: Voice; sizes: string; priority?: boolean; big?: boolean }) {
  // A big frame asks for the video's picture without bars; a video without it answers an error and gets the usual one.
  const [size, setSize] = useState<"hq" | "max">(big ? "max" : "hq");
  const src = pictureOf(voice, size);
  return src
    ? <Image src={src} alt="" fill sizes={sizes} unoptimized priority={priority} onError={() => setSize("hq")} className="object-cover transition-transform duration-700 ease-standard group-hover:scale-102 motion-reduce:transition-none motion-reduce:group-hover:scale-100" />
    : <span className="grid size-full place-items-center bg-accent-soft text-accent"><ScrollText size={44} strokeWidth={1.5} aria-hidden="true" /></span>;
}

/** The last one published, big, like the lead story of a news front page: its picture across the column and its name over it, on a dark shade. */
export function FeaturedVoice({ voice, isNew }: { voice: Voice; isNew: boolean }) {
  return <Link href={`/${voice.slug}`} className="group relative block aspect-4/3 overflow-hidden rounded-card bg-ink no-underline sm:aspect-video">
    <Picture voice={voice} sizes="(max-width: 1024px) 100vw, 860px" priority big />
    {/* Shade under the words, so white text stays readable on any picture. */}
    <span className="absolute inset-0 bg-linear-to-t from-black/80 via-black/25 to-transparent" aria-hidden="true" />
    <span className="absolute inset-x-0 bottom-0 grid justify-items-start gap-3 p-5 sm:p-8">
      {isNew && <NewBadge />}
      <h2 className="m-0 font-display text-4xl/none font-bold text-balance text-white sm:text-6xl/none">{voice.name}</h2>
      {voice.keywords[0] && <span className="line-clamp-2 max-w-2xl text-base text-white/85 sm:text-lg">{voice.keywords[0]}</span>}
      <VideoMeta stats={voice.stats} light />
    </span>
  </Link>;
}

/** A voz sagrada in a list: picture, name and what it is for, the whole card one link. Under the pointer, quietly: the name underlines. */
export function VoiceCard({ voice, isNew, compact = false }: { voice: Voice; isNew: boolean; compact?: boolean }) {
  return <Link href={`/${voice.slug}`} className="group grid content-start gap-3 no-underline">
    <span className="relative block aspect-video overflow-hidden rounded-card bg-sunken">
      <Picture voice={voice} sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 440px" />
      {isNew && <span className="absolute top-3 left-3"><NewBadge /></span>}
    </span>
    <h3 className={`m-0 font-display font-bold decoration-2 underline-offset-4 group-hover:underline ${compact ? "text-2xl/tight" : "text-3xl/tight"}`}>{voice.name}</h3>
    {voice.keywords[0] && <span className="-mt-1 line-clamp-2 text-lg text-muted">{voice.keywords[0]}</span>}
    <VideoMeta stats={voice.stats} />
  </Link>;
}
