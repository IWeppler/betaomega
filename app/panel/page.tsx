import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { sites } from "@/lib/sites";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function PanelHome() {
  if (await isAdmin()) redirect(`/${sites[0].id}`);
  return <LoginForm />;
}
