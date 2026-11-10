import { nekurelOgImage, redirectToStatic } from "@/shared/lib/static-icons";

// Old address of the social card, kept for shared links and the panel's preview: redirects to the pre-rendered file.
export function GET() {
  return redirectToStatic(nekurelOgImage);
}
