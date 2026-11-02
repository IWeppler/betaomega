import { createHmac, timingSafeEqual } from "node:crypto";

// Draft previews. The panel's session lives on its own domain, so the public site cannot see it:
// a signed link opens one draft and nothing else. It covers the site and the recipe id, so it survives renames.
// Same secret as the sessions, different payload, so a preview signature can never pass as a session.
export const previewToken = (siteId: string, recipeId: string) =>
  createHmac("sha256", process.env.ANKORA_SESSION_SECRET || "").update(`preview:${siteId}:${recipeId}`).digest("hex").slice(0, 32);

export function validPreview(siteId: string, recipeId: string, token: unknown) {
  if (!process.env.ANKORA_SESSION_SECRET || typeof token !== "string") return false;
  const given = Buffer.from(token), expected = Buffer.from(previewToken(siteId, recipeId));
  return given.length === expected.length && timingSafeEqual(given, expected);
}
