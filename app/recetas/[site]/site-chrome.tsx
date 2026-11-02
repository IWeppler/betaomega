import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { brand, getSettings } from "./brand";
import { socialLinks } from "@/lib/site-settings";
import { ShareButton, PrintButton } from "./site-actions";

export { ShareButton, PrintButton };

/** Logo, name and an optional action (share). With `subtitle` the name is the page's h1 (home); without it, a link home (recipe pages have their own h1). */
export function SiteHeader({ name, subtitle, action }: { name: string; subtitle?: string; action?: ReactNode }) {
  return <header className="r-head">
    <Link href="/" className="r-logo" aria-label={`${name}, inicio`}>
      <Image src={brand.logo} alt="" width={108} height={144} unoptimized priority />
    </Link>
    <div className="r-title">
      {subtitle !== undefined ? <h1>{name}</h1> : <p className="r-wordmark"><Link href="/">{name}</Link></p>}
      {subtitle ? <p className="r-subtitle">{subtitle}</p> : null}
    </div>
    {action}
  </header>;
}

export async function SiteFooter({ name, siteId }: { name: string; siteId: string }) {
  const links = socialLinks(await getSettings(siteId));
  return <footer className="r-foot">
    <p className="r-wordmark">{name}</p>
    <p>Recetas caseras, probadas en casa. © {new Date().getFullYear()} {name}.</p>
    {links.length > 0 && <ul className="r-foot-links" aria-label="Contacto">
      {links.map(link => <li key={link.href}><a href={link.href} {...(link.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{link.label}</a></li>)}
    </ul>}
  </footer>;
}
