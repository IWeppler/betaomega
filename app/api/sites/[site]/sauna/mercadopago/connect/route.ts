import { disconnectMercadoPago, startMercadoPagoConnect } from "@/modules/sauna/server";

// GET starts connecting the site's Mercado Pago account; DELETE disconnects it (docs/SAUNA.md §6).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = startMercadoPagoConnect;
export const DELETE = disconnectMercadoPago;
