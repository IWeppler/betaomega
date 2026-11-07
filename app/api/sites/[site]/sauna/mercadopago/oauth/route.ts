import { finishMercadoPagoConnect } from "@/modules/sauna/server";

// The return address registered in the Mercado Pago application: it has to match exactly, so this path does not change.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = finishMercadoPagoConnect;
