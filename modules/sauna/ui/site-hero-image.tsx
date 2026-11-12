import { getImageProps } from "next/image";
import desktopPhoto from "../../../public/jarind-hero.webp";
import mobilePhoto from "../../../public/jarind-hero-mobile.webp";

const ALT = "Helechos, lavanda y romero junto a un arroyo, con vapor dorado entre los rayos del sol.";

/**
 * The hero's ground: herbs and ferns by a stream, with steam in the sunlight. Wide on desktop (from 1024px, where the text sits beside the picture) and tall on a phone,
 * each its own file so a phone never downloads the wide one. Full bleed; it settles from a slight zoom once on load. A black gradient keeps the text and the bare header readable.
 */
export function HeroImage() {
  const common = { alt: ALT, fill: true, sizes: "100vw", quality: 80 };
  const { props: { srcSet: wide } } = getImageProps({ ...common, src: desktopPhoto });
  const { props: { srcSet: tall, ...img } } = getImageProps({ ...common, src: mobilePhoto });
  return <div className="absolute inset-0 overflow-hidden bg-black">
    <div className="relative h-full animate-arrive">
      <picture>
        <source media="(min-width: 1024px)" srcSet={wide} />
        {/* The first thing on screen: no lazy loading, and the browser is told it matters. */}
        <img {...img} srcSet={tall} loading="eager" fetchPriority="high" alt={ALT} className="size-full object-cover" />
      </picture>
    </div>
    {/* Neutral black, not the brand's wine: the photograph keeps its own colours and only gets darker where the text sits. */}
    <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/35 to-black/10 lg:bg-linear-to-r lg:from-black/75 lg:via-black/40 lg:to-black/0" aria-hidden="true" />
    <div className="absolute inset-x-0 top-0 h-40 bg-linear-to-b from-black/55 to-transparent" aria-hidden="true" />
  </div>;
}
