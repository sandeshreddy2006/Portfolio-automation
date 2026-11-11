import type { ComponentType } from "react";
import type { PortfolioContent } from "@/lib/portfolio";
import { Aurora } from "./aurora";
import { Bento } from "./bento";
import { Blocky } from "./blocky";
import { Brutalist } from "./brutalist";
import { Editorial } from "./editorial";
import { templateInfo, type TemplateInfo } from "./meta";
import { Terminal } from "./terminal";

export type TemplateMeta = TemplateInfo & {
  Component: ComponentType<{ content: PortfolioContent }>;
};

const components: Record<string, TemplateMeta["Component"]> = {
  editorial: Editorial,
  terminal: Terminal,
  bento: Bento,
  brutalist: Brutalist,
  blocky: Blocky,
  aurora: Aurora,
};

export const templates: TemplateMeta[] = templateInfo.map((info) => ({
  ...info,
  Component: components[info.id],
}));

export function getTemplate(id: string): TemplateMeta | undefined {
  return templates.find((template) => template.id === id);
}
