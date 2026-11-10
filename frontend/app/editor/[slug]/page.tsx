import type { Metadata } from "next";
import { Suspense } from "react";
import StudioHeader from "../../studio-header";
import Editor from "./editor";

export const metadata: Metadata = {
  title: "Edit portfolio | Portfolabs",
  robots: { index: false },
};

async function EditorLoader({ params }: { params: PageProps<"/editor/[slug]">["params"] }) {
  const { slug } = await params;
  return <Editor key={slug} slug={slug} />;
}

export default function EditorPage({ params }: PageProps<"/editor/[slug]">) {
  return (
    <>
      <StudioHeader />
      <Suspense fallback={<main className="page-width"><p role="status">Loading…</p></main>}>
        <EditorLoader params={params} />
      </Suspense>
    </>
  );
}
