import Image from "next/image";
import Link from "next/link";
import { brand, getSettings } from "./brand";
import { EnvelopeSimple, InstagramLogo, WhatsappLogo } from "@phosphor-icons/react/dist/ssr";
import { filterHref, recipeMoments } from "@/lib/recipes";
import { socialLinks } from "@/lib/site-settings";
import { ShareButton, PrintButton } from "./site-actions";
import { FooterActions } from "./footer-actions";
import { HeaderActions } from "./header-actions";

export { ShareButton, PrintButton };

/**
 * Logo and name (a link home; each page has its own h1) and, with `siteId`, the site's actions on the right:
 * Instagram, donating and installing the app. Without `siteId` (error pages) only the brand shows.
 */
export async function SiteHeader({ name, siteId }: { name: string; siteId?: string }) {
  const settings = siteId ? await getSettings(siteId) : undefined;
  return <header className="r-head">
    <Link href="/" className="r-brand" aria-label={`${name}, inicio`}>
      <span className="r-logo"><Image src={brand.logo} alt="" width={108} height={144} unoptimized priority /></span>
      <span className="r-wordmark">{name}</span>
    </Link>
    {settings && <HeaderActions instagram={settings.instagram} donation={settings.donation ?? ""} />}
  </header>;
}

export async function SiteFooter({ name, siteId }: { name: string; siteId: string }) {
  const settings = await getSettings(siteId);
  const links = socialLinks(settings);
  const icon = (href: string) => href.includes("instagram") ? <InstagramLogo size={20} aria-hidden /> : href.includes("wa.me") ? <WhatsappLogo size={20} aria-hidden /> : <EnvelopeSimple size={20} aria-hidden />;
  return <footer className="r-foot">
    <div className="r-foot-main">
      <div className="r-foot-brand">
        <Link href="/" className="r-foot-logo" aria-label={`${name}, inicio`}>
          <Image src={brand.logo} alt="" width={450} height={600} unoptimized />
        </Link>
      </div>
      <nav className="r-foot-col" aria-label="Recetas por momento">
        <h2>Recetas</h2>
        <ul>
          {recipeMoments.map(moment => <li key={moment.id}><Link href={filterHref("moment", moment.id)}>{moment.label}</Link></li>)}
        </ul>
      </nav>
      {links.length > 0 && <div className="r-foot-col">
        <h2>Contacto</h2>
        <ul aria-label="Contacto">
          {links.map(link => <li key={link.href}><a href={link.href} {...(link.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{icon(link.href)}{link.label}</a></li>)}
        </ul>
      </div>}
      <FooterActions donation={settings.donation} />
    </div>
    <p className="r-foot-legal">© {new Date().getFullYear()} {name}.</p>
  </footer>;
}
