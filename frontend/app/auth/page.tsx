import { redirect } from "next/navigation";
import { Suspense } from "react";

type Query = Record<string, string | string[] | undefined>;

async function AccountRedirect({ searchParams }: { searchParams: Promise<Query> }) {
  const { step, error, status, next } = await searchParams;
  const query = new URLSearchParams({ auth: typeof step === "string" ? step : "login" });
  if (typeof error === "string") query.set("error", error);
  if (status === "deleted" || status === "password-updated") query.set("status", status);
  if (typeof next === "string") query.set("next", next);
  return redirect(`/?${query}`);
}


export default function AccountPage({ searchParams }: { searchParams: Promise<Query> }) {
  return <Suspense><AccountRedirect searchParams={searchParams} /></Suspense>;
}
