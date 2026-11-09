import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTemplate, templates } from "@/components/templates";
import { getSample, sampleVariants, type SampleVariant } from "@/lib/sample-data";

export const metadata: Metadata = { robots: { index: false } };

export function generateStaticParams() {
  return templates.flatMap(({ id }) => sampleVariants.map((variant) => ({ id, variant })));
}

export default async function TemplateFrame({ params }: PageProps<"/templates/[id]/frame/[variant]">) {
  const { id, variant } = await params;
  const template = getTemplate(id);
  if (!template || !sampleVariants.includes(variant as SampleVariant)) notFound();

  return <template.Component content={getSample(variant as SampleVariant, id)} />;
}
