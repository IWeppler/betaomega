import { Drop, Warning } from "@phosphor-icons/react/dist/ssr";
import { productApplications, type ProductApplication } from "@/lib/products";

/** How the product is used, as a sign that is hard to miss: like the "sin TACC" seal, but read as a warning. */
export function ApplicationSign({ application, large = false }: { application?: ProductApplication; large?: boolean }) {
  if (!application) return null;
  const { sign, note } = productApplications[application];
  const SignIcon = application === "piel" ? Warning : Drop;
  return <p className={`p-sign is-${application}${large ? " is-large" : ""}`}>
    <SignIcon size={large ? 36 : 22} weight="fill" aria-hidden="true" />
    <span><strong>{sign}</strong><small>{note}</small></span>
  </p>;
}
