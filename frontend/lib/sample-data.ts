import type { PortfolioContent } from "./portfolio";

export type SampleVariant = "full" | "sparse";

export const sampleVariants: SampleVariant[] = ["full", "sparse"];

const full: PortfolioContent = {
  template_id: "",
  name: "Alex Morgan",
  headline: "Product designer & front-end developer",
  bio: "I design and build small, careful interfaces for people who are tired of clutter. Right now I'm finishing a degree in interaction design and freelancing for early-stage teams.\n\nI care about the last 10%: empty states, loading states, and the words on the button. Most of what I've learned came from shipping something, watching someone get confused by it, and fixing it.",
  projects: [
    {
      title: "Tidepool",
      description:
        "A habit tracker that rewards consistency instead of streaks. I designed the system and built the web app in React. 2,000 people used it in the first month and I learned how much an onboarding screen can lose you.",
      url: "https://example.com/tidepool",
    },
    {
      title: "Field Notes",
      description:
        "An offline-first notes app for researchers working without a signal. My part was the sync engine and the conflict UI.",
      url: "https://example.com/field-notes",
    },
    {
      title: "Plantpal Rebrand",
      description:
        "Identity, packaging and a landing page for a houseplant subscription. Sales of the starter box rose after the relaunch.",
      url: "https://example.com/plantpal",
    },
    {
      title: "Commute Map",
      description:
        "A weekend experiment that draws your daily commute as a poster. Built with SVG and a lot of trial and error.",
      url: "https://example.com/commute-map",
    },
    {
      title: "Open-source: a11y-lint",
      description:
        "A tiny CLI that flags colour-contrast problems in design tokens. Two merged contributions from strangers so far.",
      url: "https://example.com/a11y-lint",
    },
  ],
  links: [
    { label: "GitHub", url: "https://github.com/example" },
    { label: "LinkedIn", url: "https://www.linkedin.com/in/example" },
    { label: "Read.cv", url: "https://read.cv/example" },
    { label: "Dribbble", url: "https://dribbble.com/example" },
  ],
};

// A brand-new user who has only typed a name. Every template must still look intentional.
const sparse: PortfolioContent = {
  template_id: "",
  name: "Sam Rivera",
  headline: "",
  bio: "",
  projects: [],
  links: [],
};

export function getSample(variant: SampleVariant, templateId: string): PortfolioContent {
  return { ...(variant === "sparse" ? sparse : full), template_id: templateId };
}
