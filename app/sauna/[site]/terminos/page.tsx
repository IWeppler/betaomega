import type { Metadata } from "next";
import { publicPage } from "@/modules/sauna/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Términos y condiciones" };

export default async function TermsPage({ params }: { params: Promise<{ site: string }> }) {
  const { terms } = await publicPage((await params).site);
  return <article className="mx-auto grid max-w-2xl gap-5 px-4 pt-36 pb-16">
    <h1 className="m-0 font-display text-4xl/snug font-normal text-ink">Términos y condiciones</h1>
    {terms.split(/\n\s*\n/).map(paragraph => <p key={paragraph} className="m-0 leading-7 text-muted">{paragraph}</p>)}
  </article>;
}
