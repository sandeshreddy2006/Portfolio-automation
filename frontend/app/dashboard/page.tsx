import type { Metadata } from "next";
import { Suspense } from "react";
import StudioHeader from "../studio-header";
import Dashboard from "./dashboard";

export const metadata: Metadata = {
  title: "My portfolios | Portfolabs",
  robots: { index: false },
};

export default function DashboardPage() {
  return (
    <>
      <StudioHeader />
      <Suspense fallback={<main className="page-width"><p role="status">Loading...</p></main>}>
        <Dashboard />
      </Suspense>
    </>
  );
}
