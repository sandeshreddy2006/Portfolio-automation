import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import Brand from "../brand";
import AuthForm from "./auth-form";

export const metadata: Metadata = {
  title: "Your account | Portfolabs",
  referrer: "no-referrer",
};

type Query = Record<string, string | string[] | undefined>;

async function AccountFlow({ searchParams }: { searchParams: Promise<Query> }) {
  const { step, error, status } = await searchParams;
  const initialStep = step === "register" || step === "verify" || step === "link" ||
    step === "password" || step === "delete" || step === "delete-confirm"
    ? step : "login";

  return <AuthForm key={initialStep} initialStep={initialStep} googleError={typeof error === "string" ? error : undefined} deleted={status === "deleted"} />;
}

export default function AccountPage({ searchParams }: { searchParams: Promise<Query> }) {
  return (
    <main className="account-page page-width">
      <Link className="brand-link" href="/" aria-label="Portfolabs home"><Brand compact /></Link>
      <section className="account-panel" aria-label="Your Portfolabs account">
        <Suspense fallback={<p role="status">Loading your account…</p>}>
          <AccountFlow searchParams={searchParams} />
        </Suspense>
      </section>
    </main>
  );
}
