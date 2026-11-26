import { getMetrics, postMetric } from "@/modules/voices/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = getMetrics;
export const POST = postMetric;
