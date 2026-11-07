import { getConfig, patchSettings } from "@/modules/sauna/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = getConfig;
export const PATCH = patchSettings;
