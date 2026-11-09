import { connection } from "next/server";
import { Suspense } from "react";

type RepositoryInfo = {
  name: string;
  description: string;
  repository_url: string;
};

async function RepositoryDetails() {
  await connection();
  const backendUrl =
    process.env.BACKEND_URL ||
    (process.env.NODE_ENV === "development" ? "http://127.0.0.1:8000" : "");

  if (!backendUrl) {
    return <p>Set BACKEND_URL to connect to the portfolio API.</p>;
  }

  let repository: RepositoryInfo;
  try {
    const response = await fetch(new URL("/api/repo", backendUrl), {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      throw new Error(`Portfolio API returned ${response.status}`);
    }
    repository = await response.json();
  } catch (error) {
    console.error("Could not load repository details", error);
    return <p>Repository details are temporarily unavailable.</p>;
  }

  return (
    <section className="space-y-4">
      <h1 className="text-4xl font-semibold tracking-tight">{repository.name}</h1>
      <p className="text-lg text-zinc-600 dark:text-zinc-300">
        {repository.description}
      </p>
      <a className="inline-block underline underline-offset-4" href={repository.repository_url}>
        View source on GitHub
      </a>
    </section>
  );
}

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-4 px-6 py-24">
      <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
        Project overview
      </p>
      <Suspense fallback={<p role="status">Loading repository details…</p>}>
        <RepositoryDetails />
      </Suspense>
    </main>
  );
}
