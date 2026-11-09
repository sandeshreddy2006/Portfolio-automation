import type { ComponentType } from "react";
import type { PortfolioContent } from "@/lib/portfolio";
import { Aurora } from "./aurora";
import { Bento } from "./bento";
import { Blocky } from "./blocky";
import { Brutalist } from "./brutalist";
import { Editorial } from "./editorial";
import { Terminal } from "./terminal";

export type TemplateMeta = {
  /** Stored as template_id in PortfolioContent. Must stay a valid slug. */
  id: string;
  name: string;
  tagline: string;
  bestFor: string;
  swatches: string[];
  Component: ComponentType<{ content: PortfolioContent }>;
};

export const templates: TemplateMeta[] = [
  {
    id: "editorial",
    name: "Editorial",
    tagline: "Magazine-style layout with big serif type.",
    bestFor: "Writers, designers and anyone whose story matters as much as the work.",
    swatches: ["#f6f1e7", "#1b1a17", "#b3400f"],
    Component: Editorial,
  },
  {
    id: "terminal",
    name: "Terminal",
    tagline: "A shell window that introduces you one command at a time.",
    bestFor: "Developers, data and security folks, and open-source contributors.",
    swatches: ["#070b08", "#7ee787", "#f2cc60"],
    Component: Terminal,
  },
  {
    id: "bento",
    name: "Bento",
    tagline: "A playful grid of colourful cards.",
    bestFor: "Product designers, creators and people with lots of small projects.",
    swatches: ["#ffd9ec", "#cfe3ff", "#ffe9a8"],
    Component: Bento,
  },
  {
    id: "brutalist",
    name: "Brutalist",
    tagline: "Loud, high-contrast and impossible to forget.",
    bestFor: "Artists, students and anyone who wants to stand out in a pile of CVs.",
    swatches: ["#ffe24a", "#0a0a0a", "#ff6fb5"],
    Component: Brutalist,
  },
  {
    id: "blocky",
    name: "Blocky",
    tagline: "A pixel-block world inspired by sandbox games.",
    bestFor: "Gamers, streamers, game devs and anyone who wants a fun, playful portfolio.",
    swatches: ["#5fb04a", "#7a5230", "#9fd6f7"],
    Component: Blocky,
  },
  {
    id: "aurora",
    name: "Aurora",
    tagline: "Dark glass and soft gradient light.",
    bestFor: "Product, AI and startup people who want a modern, polished feel.",
    swatches: ["#07060f", "#6d3bff", "#22d3ee"],
    Component: Aurora,
  },
];

export function getTemplate(id: string): TemplateMeta | undefined {
  return templates.find((template) => template.id === id);
}
