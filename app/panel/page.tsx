import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { listSites } from "@/lib/site-registry";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function PanelHome() {
  if (await isAdmin()) redirect(`/${(await listSites())[0].id}`);
  return <LoginForm />;
}
