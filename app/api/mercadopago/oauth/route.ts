import { finishMercadoPagoConnect } from "@/modules/sauna/server";

// The one return address registered in the Mercado Pago application, for every site: it has to match exactly, so this path does not change.
// The site comes in the cookie the start left (docs/SAUNA.md §6).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = finishMercadoPagoConnect;
