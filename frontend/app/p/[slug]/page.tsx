import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { getTemplate } from "@/components/templates";
import { getPublished, getRedirectTarget, SITE_URL, SLUG } from "@/lib/published";
import styles from "./public.module.css";

export async function generateMetadata({ params }: PageProps<"/p/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const portfolio = SLUG.test(slug) ? await getPublished(slug) : null;
  if (!portfolio) return { title: "Portfolio not found", robots: { index: false } };

  const { name, headline, search_visible } = portfolio.published_content;
  const description = headline || `${name}'s portfolio`;
  return {
    title: `${name} | Portfolio`,
    description,
    // The owner decides whether search engines may list this page; the link always works.
    robots: search_visible ? { index: true, follow: true } : { index: false, follow: false },
    // Subdomain addresses (name.portfolabs.com) point back to this one address.
    alternates: { canonical: `/p/${slug}` },
    openGraph: { title: name, description, type: "profile", url: `/p/${slug}` },
    twitter: { card: "summary_large_image", title: name, description },
  };
}

async function Portfolio({ params }: { params: PageProps<"/p/[slug]">["params"] }) {
  const { slug } = await params;
  if (!SLUG.test(slug) || slug.length > 64) notFound();
  const portfolio = await getPublished(slug);
  if (!portfolio) {
    // An address that was renamed sends visitors to the new one.
    const moved = await getRedirectTarget(slug);
    if (moved) permanentRedirect(`/p/${moved}`);
  }
  const template = portfolio && getTemplate(portfolio.published_content.template_id);
  if (!portfolio || !template) notFound();

  return (
    <div data-portfolio-export={portfolio.published_at} style={{ display: "contents" }}>
      <template.Component content={portfolio.published_content} />
      <footer className={styles.badge}>
        {portfolio.published_content.resume_id && (
          <>
            <a href={`/p/${slug}/resume`} download="resume.pdf">Download résumé</a>
            <span aria-hidden="true">·</span>
          </>
        )}
        <Link href={SITE_URL}>Made with Portfolabs</Link>
        <span aria-hidden="true">·</span>
        <Link href={`${SITE_URL}/report?slug=${slug}`} rel="nofollow">Report</Link>
      </footer>
    </div>
  );
}

export default function PublicPortfolioPage({ params }: PageProps<"/p/[slug]">) {
  return (
    <Suspense fallback={null}>
      <Portfolio params={params} />
    </Suspense>
  );
}
