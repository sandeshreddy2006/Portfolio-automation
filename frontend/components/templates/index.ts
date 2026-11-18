import type { ComponentType } from "react";
import type { PortfolioContent } from "@/lib/portfolio";
import { Aurora } from "./aurora";
import { AstralNexus } from "./astral-nexus";
import { Bento } from "./bento";
import { Blocky } from "./blocky";
import { Cinema } from "./cinema";
import { Brutalist } from "./brutalist";
import { Desktop } from "./desktop";
import { Editorial } from "./editorial";
import { templateInfo, type TemplateInfo } from "./meta";
import { Storefront } from "./storefront";
import { TrainerJournal } from "./trainer-journal";
import { Terminal } from "./terminal";

export type TemplateMeta = TemplateInfo & {
  Component: ComponentType<{ content: PortfolioContent; resumeHref?: string; portfolioKey?: string }>;
};

const components: Record<string, TemplateMeta["Component"]> = {
  editorial: Editorial,
  terminal: Terminal,
  bento: Bento,
  brutalist: Brutalist,
  blocky: Blocky,
  aurora: Aurora,
  "astral-nexus": AstralNexus,
  storefront: Storefront,
  cinema: Cinema,
  desktop: Desktop,
  "trainer-journal": TrainerJournal,
};

const allTemplates: TemplateMeta[] = templateInfo.map((info) => ({
  ...info,
  Component: components[info.id],
}));

export const templates = allTemplates.filter((template) => !template.adminOnly);

export function getTemplate(id: string): TemplateMeta | undefined {
  return allTemplates.find((template) => template.id === id);
}
