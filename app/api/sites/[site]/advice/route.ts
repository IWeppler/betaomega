import { getAdviceBook, putAdviceBook } from "@/modules/advice/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = getAdviceBook;
export const PUT = putAdviceBook;
