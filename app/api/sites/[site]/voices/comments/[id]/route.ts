import { patchComment, removeComment } from "@/modules/voices/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const PATCH = patchComment;
export const DELETE = removeComment;
