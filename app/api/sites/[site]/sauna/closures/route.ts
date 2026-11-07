import { deleteClosure, postClosure } from "@/modules/sauna/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = postClosure;
export const DELETE = deleteClosure;
