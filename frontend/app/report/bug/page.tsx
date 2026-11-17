import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "../../legal-page";
import ReportForm from "../report-form";

export const metadata: Metadata = { title: "Report a bug | Portfolabs", robots: { index: false } };

export default function BugReportPage() {
  return (
    <LegalPage title="Report a bug">
      <p>Tell us where it happened, what you did, and what you expected to happen.</p>
      <ReportForm />
      <p><Link href="/settings">Back to settings</Link></p>
    </LegalPage>
  );
}
