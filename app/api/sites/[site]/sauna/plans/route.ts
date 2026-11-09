import { getPlans, postPlan } from "@/modules/sauna/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = getPlans;
export const POST = postPlan;
