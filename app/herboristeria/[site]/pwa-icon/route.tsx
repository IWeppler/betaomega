import { askedIconSize, redirectToStatic } from "@/shared/lib/static-icons";
import { herbIcon } from "../og-image";

// Old address of the home-screen icon (?size=, ?maskable=1), kept for installed apps: redirects to the pre-rendered file.
export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  return redirectToStatic(herbIcon(askedIconSize(params.get("size")), params.get("maskable") === "1"));
}
