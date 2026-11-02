import { Clock, FacebookLogo, InstagramLogo, MapPin } from "@phosphor-icons/react/dist/ssr";
import { WhatsappIcon } from "@/app/whatsapp-icon";
import type { StoreSettings } from "@/lib/catalog";
import { socialLink } from "@/lib/store-tools";

const external = { target: "_blank", rel: "noopener noreferrer" } as const;

/** Contact details the owner loaded in Tienda > Datos: social profiles, address with map link, hours and WhatsApp. Server component. */
export function StoreInfo({ store }: { store: StoreSettings }) {
  const instagram = socialLink(store.instagram, "instagram");
  const facebook = socialLink(store.facebook, "facebook");
  const address = store.address?.trim(); const hours = store.hours?.trim(); const maps = store.mapsUrl?.trim();
  if (!store.whatsapp && !instagram && !facebook && !store.instagram?.trim() && !store.facebook?.trim() && !address && !hours && !maps) return null;
  return <section className="store-info no-print" aria-label="Datos de la tienda">
    <div>
      <h2>Contacto</h2>
      <ul>
        {store.whatsapp && <li><WhatsappIcon size={22} /><a href={`https://wa.me/${store.whatsapp}`} {...external}>Escribinos por WhatsApp</a></li>}
        {instagram ? <li><InstagramLogo size={22} aria-hidden="true" /><a href={instagram.href} {...external}>{instagram.label}</a></li> : store.instagram?.trim() && <li><InstagramLogo size={22} aria-hidden="true" /><span>{store.instagram.trim()}</span></li>}
        {facebook ? <li><FacebookLogo size={22} aria-hidden="true" /><a href={facebook.href} {...external}>{facebook.label}</a></li> : store.facebook?.trim() && <li><FacebookLogo size={22} aria-hidden="true" /><span>{store.facebook.trim()}</span></li>}
        {(address || maps) && <li><MapPin size={22} aria-hidden="true" />{maps ? <a href={maps} {...external}>{address || "Ver en el mapa"}</a> : <span>{address}</span>}</li>}
      </ul>
    </div>
    {hours && <div><h2><Clock size={20} aria-hidden="true" /> Horarios</h2><p className="store-hours">{hours}</p></div>}
  </section>;
}
