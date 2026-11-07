import { getCodes, postCode } from "@/modules/sauna/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = getCodes;
export const POST = postCode;
