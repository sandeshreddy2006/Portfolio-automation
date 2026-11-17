export type TemplateInfo = {
  /** Stored as template_id in PortfolioContent. Must stay a valid slug and match TEMPLATE_IDS in backend/app/portfolios.py. */
  id: string;
  name: string;
  tagline: string;
  bestFor: string;
  swatches: string[];
  adminOnly?: boolean;
};

export const templateInfo: TemplateInfo[] = [
  {
    id: "editorial",
    name: "Editorial",
    tagline: "Magazine-style layout with big serif type.",
    bestFor: "Writers, designers and anyone whose story matters as much as the work.",
    swatches: ["#f6f1e7", "#1b1a17", "#b3400f"],
  },
  {
    id: "terminal",
    name: "Terminal",
    tagline: "A shell window that introduces you one command at a time.",
    bestFor: "Developers, data and security folks, and open-source contributors.",
    swatches: ["#070b08", "#7ee787", "#f2cc60"],
  },
  {
    id: "bento",
    name: "Bento",
    tagline: "A playful grid of colourful cards.",
    bestFor: "Product designers, creators and people with lots of small projects.",
    swatches: ["#ffd9ec", "#cfe3ff", "#ffe9a8"],
  },
  {
    id: "brutalist",
    name: "Brutalist",
    tagline: "Loud, high-contrast and impossible to forget.",
    bestFor: "Artists, students and anyone who wants to stand out in a pile of CVs.",
    swatches: ["#ffe24a", "#0a0a0a", "#ff6fb5"],
  },
  {
    id: "blocky",
    name: "Blocky",
    tagline: "A pixel-block world inspired by sandbox games.",
    bestFor: "Gamers, streamers, game devs and anyone who wants a fun, playful portfolio.",
    swatches: ["#5fb04a", "#7a5230", "#9fd6f7"],
  },
  {
    id: "aurora",
    name: "Aurora",
    tagline: "Dark glass and soft gradient light.",
    bestFor: "Product, AI and startup people who want a modern, polished feel.",
    swatches: ["#07060f", "#6d3bff", "#22d3ee"],
  },
  {
    id: "storefront",
    name: "Storefront",
    tagline: "An Amazon-inspired storefront with a product-grid layout.",
    bestFor: "Designers, makers and people with a catalogue of projects.",
    swatches: ["#131921", "#ffbf69", "#e8ecec"],
  },
  {
    id: "cinema",
    name: "Cinema",
    tagline: "A Netflix-inspired layout with a featured project and a scrollable shelf.",
    bestFor: "Filmmakers, game developers and anyone with strong project visuals.",
    swatches: ["#141414", "#ff3340", "#601b30"],
  },
  {
    id: "desktop",
    name: "Desktop",
    tagline: "A retro workspace with draggable windows and a working taskbar.",
    bestFor: "Developers, designers and anyone who wants visitors to explore their work.",
    swatches: ["#34195e", "#8775f2", "#35a8ef"],
  },
  {
    id: "trainer-journal",
    name: "Trainer Journal",
    tagline: "A walkable pixel town with playable project encounters.",
    bestFor: "The Portfolabs admin’s personal portfolio.",
    swatches: ["#b8e3f7", "#fff8db", "#dc5b4d"],
    adminOnly: true,
  },
];

export const publicTemplateInfo = templateInfo.filter((template) => !template.adminOnly);
