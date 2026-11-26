import { getComments, postComment } from "@/modules/voices/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = getComments;
export const POST = postComment;
