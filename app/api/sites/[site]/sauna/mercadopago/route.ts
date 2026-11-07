import { postMercadoPagoNotice } from "@/modules/sauna/server";

// Mercado Pago's webhook for this site (docs/SAUNA.md §6). The address goes in each preference as notification_url.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = postMercadoPagoNotice;
