import type { ReactNode } from "react";
import Link from "next/link";
import { getSettings } from "./brand";
import { socialLinks } from "@/lib/site-settings";
import { ShareButton, PrintButton } from "./site-actions";

export { ShareButton, PrintButton };

export function SiteHeader({ name, action }: { name: string; action?: ReactNode }) {
  return <header className="r-top">
    <div className="r-top-inner">
      <Link href="/" className="r-wordmark">{name}</Link>
      {action}
    </div>
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
