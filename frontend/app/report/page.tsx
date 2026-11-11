import type { Metadata } from "next";
import { Suspense } from "react";
import LegalPage from "../legal-page";
import { SLUG } from "@/lib/published";
import ReportForm from "./report-form";

export const metadata: Metadata = { title: "Report a portfolio | Portfolabs", robots: { index: false, follow: false } };

async function Report({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug } = await searchParams;
  const address = typeof slug === "string" && SLUG.test(slug) && slug.length <= 64 ? slug : null;
  return address ? <ReportForm slug={address} /> : <p>Open the “Report” link on a portfolio to report it.</p>;
}

export default function ReportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <LegalPage title="Report a portfolio" updated="10 November 2026">
      <p>Thanks for helping keep Portfolabs safe. Tell us what’s wrong and we’ll take a look.</p>
      <Suspense fallback={<p role="status">Loading…</p>}>
        <Report searchParams={searchParams} />
      </Suspense>
    </LegalPage>
  );
}
