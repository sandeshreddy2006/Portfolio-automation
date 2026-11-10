import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTemplate, templates } from "@/components/templates";
import { PreviewControls } from "./preview-controls";
import styles from "../templates.module.css";

export function generateStaticParams() {
  return templates.map(({ id }) => ({ id }));
}

export async function generateMetadata({ params }: PageProps<"/templates/[id]">): Promise<Metadata> {
  const template = getTemplate((await params).id);
  return { title: template ? `${template.name} template · Portfolio Automation` : "Template not found" };
}

export default async function TemplatePage({ params }: PageProps<"/templates/[id]">) {
  const { id } = await params;
  const index = templates.findIndex((template) => template.id === id);
  if (index === -1) notFound();

  const template = templates[index];
  const previous = templates[(index - 1 + templates.length) % templates.length];
  const next = templates[(index + 1) % templates.length];

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <Link href="/templates">← All templates</Link>
        <span>
          {index + 1} / {templates.length}
        </span>
      </header>

      <section className={styles.detail}>
        <div>
          <h1>{template.name}</h1>
          <p>{template.tagline}</p>
          <Link className="primary-link" href={`/dashboard?template=${template.id}`} style={{ marginTop: 22 }}>Use this template</Link>
        </div>
        <dl>
          <div>
            <dt>Best for</dt>
            <dd>{template.bestFor}</dd>
          </div>
          <div>
            <dt>Template ID</dt>
            <dd><code>{template.id}</code></dd>
          </div>
          <div>
            <dt>Palette</dt>
            <dd className={styles.swatches}>
              {template.swatches.map((color) => (
                <span key={color} style={{ background: color }} title={color} />
              ))}
            </dd>
          </div>
        </dl>
      </section>

      <PreviewControls key={template.id} id={template.id} name={template.name} />

      <nav className={styles.pager} aria-label="Other templates">
        <Link href={`/templates/${previous.id}`}>← {previous.name}</Link>
        <Link href={`/templates/${next.id}`}>{next.name} →</Link>
      </nav>
    </div>
  );
}
