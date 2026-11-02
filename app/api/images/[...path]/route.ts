import { imageTypes, validImagePath } from "@/lib/images";
import { supabase } from "@/lib/supabase";
export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  if (!validImagePath(path)) return new Response("Imagen no encontrada", { status: 404 });
  const name = path.join("/");
  try {
    const response = await supabase(`/storage/v1/object/images/${name}`);
    if (!response.ok) return new Response("Imagen no encontrada", { status: 404 });
    const extension = name.split(".").pop() as keyof typeof imageTypes;
    return new Response(await response.arrayBuffer(), { headers: { "Content-Type": imageTypes[extension], "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
  } catch { return new Response("Imagen no encontrada", { status: 404 }); }
}
