import { InstallApp } from "./install-app";
import { reservePath, textLinkClass } from "./site-parts";

const link = `${textLinkClass} min-h-0 py-1 text-night-ink/90 hover:text-night-ink`;

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="grid content-start gap-3">
    <h2 className="m-0 font-text text-base font-medium text-night-muted">{title}</h2>
    <ul className="m-0 grid list-none gap-1 p-0 text-lg">{children}</ul>
  </div>;
}

/** The public site's footer: a short line, three columns of links, the name set across the whole width, and a bottom bar. */
export function SiteFooter({ siteName, home, termsHref, address = "", preview = false }: { siteName: string; home: string; termsHref: string; address?: string; preview?: boolean }) {
  const base = home === "/" ? "/" : home;
  return <footer className={`overflow-hidden bg-night px-[7%] pt-16 text-night-ink lg:px-[5%] lg:pt-20 ${preview ? "pb-20" : "pb-6"}`}>
    <div className="grid gap-12 lg:grid-cols-[1.4fr_repeat(3,1fr)] lg:gap-10">
      <p className="m-0 max-w-xs font-display text-2xl/snug text-night-ink">Un espacio para volver a vos.</p>
      <Column title="Explorar">
        <li><a className={link} href={`${base}#sesiones`}>Las sesiones</a></li>
        <li><a className={link} href={`${base}#espacio`}>El espacio</a></li>
        <li><a className={link} href={`${base}#preguntas`}>Antes de venir</a></li>
        <li><a className={link} href={`${base}#horarios`}>Horarios</a></li>
      </Column>
      <Column title="Visita">
        {address && <li className="py-1 text-night-ink/90">{address}</li>}
        <li><a className={link} href={`${base}#horarios`}>Cómo llegar</a></li>
      </Column>
      <Column title="Reservas">
        <li><a className={link} href={reservePath(home)}>Reservar una sesión</a></li>
        <li><a className={link} href={termsHref}>Términos y condiciones</a></li>
        <li><InstallApp className={`${link} cursor-pointer`} helpClassName="m-0 mt-2 max-w-[22ch] text-base text-night-muted" /></li>
      </Column>
    </div>
    <p aria-hidden="true" className="m-0 mt-14 select-none whitespace-nowrap text-center font-display text-[12.5vw]/[1] font-normal tracking-tight text-brand-highlight uppercase lg:mt-20">{siteName}</p>
    <div className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-night-ink/20 pt-5 text-base text-night-muted">
      <span>© {new Date().getFullYear()} {siteName}</span>
      <span>Reservas online, solo o en grupo.</span>
    </div>
  </footer>;
}
