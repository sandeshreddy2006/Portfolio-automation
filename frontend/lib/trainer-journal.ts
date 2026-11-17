import type { PortfolioProject, TrainerGame } from "./portfolio";

export const encounters = {
  train: {
    title: "The Last Train", project: "Trip2gether", badge: "Conductor", guide: "Stationmaster",
    description: "Read the group vote, untangle their schedule, and get everyone to the station before departure.",
    signature: "Group polls and itinerary conflict warnings",
    fieldNote: "A warning can surface the conflict while leaving the final decision with the group.",
    repo: "https://github.com/sandeshreddy2006/trip2gether",
    color: "#df884f", position: [2, 2],
  },
  cinema: {
    title: "Starlight Cinema", project: "Film Foodie", badge: "Marquee", guide: "Ticket clerk",
    description: "Check the watchlist, shortlist a screening, and rebook when a friend says they’ll be late.",
    signature: "Showtime discovery and saved plans",
    fieldNote: "Treating a plan as a saved object lets one change leave the rest of the evening intact.",
    repo: "https://github.com/sandeshreddy2006/Film-Foodie", website: "https://thefilmfoodie.com",
    color: "#c47cb5", position: [9, 2],
  },
  market: {
    title: "Market Observatory", project: "Stock Pilot", badge: "Research", guide: "Observatory researcher",
    description: "Rewind a fictional market session and find a filing that leaked into an earlier forecast.",
    signature: "Point-in-time SEC facts and chronological XGBoost evaluation",
    fieldNote: "A fiscal period ending and a filing becoming public are two different events.",
    repo: "https://github.com/sandeshreddy2006/Stock-Pilot", website: "https://stockpilotadvisor.com",
    color: "#7b9ac6", position: [2, 6],
  },
  workshop: {
    title: "Portfolio Workshop", project: "Portfolabs", badge: "Publisher", guide: "Mira Tan",
    description: "Correct a résumé import, pick a design, and publish a miniature portfolio into the town.",
    signature: "Separate draft and published versions",
    fieldNote: "A stable address can point to a published snapshot while the owner keeps editing privately.",
    repo: "https://github.com/sandeshreddy2006/Portfolio-automation", website: "https://www.portfolabs.com",
    color: "#d5be67", position: [9, 6],
  },
} satisfies Record<TrainerGame, {
  title: string; project: string; badge: string; guide: string; description: string; signature: string; fieldNote: string;
  repo: string; website?: string; color: string; position: [number, number];
}>;

export const trainerGames = Object.keys(encounters) as TrainerGame[];
export const starterProjects: PortfolioProject[] = trainerGames.map((id) => {
  const encounter = encounters[id];
  return {
    title: encounter.project, description: encounter.signature, trainer_game: id,
    url: "website" in encounter ? encounter.website : encounter.repo,
  };
});
