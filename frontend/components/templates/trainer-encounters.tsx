"use client";

import { useEffect, useState } from "react";
import type { TrainerGame } from "@/lib/portfolio";
import styles from "./trainer-journal.module.css";

type Finish = () => void;
export type TownPortfolio = { name: string; headline: string; theme: string };

function Train({ finish }: { finish: Finish }) {
  const [stop, setStop] = useState("market");
  const [dinner, setDinner] = useState(30);
  const [clock, setClock] = useState<number | null>(null);
  const duration = stop === "market" ? 27 : 18;
  const arrival = dinner + 25 + 12;
  const conflict = dinner < duration;
  const end = conflict ? dinner : Math.min(arrival, 76);
  const finished = clock !== null && clock >= end;
  useEffect(() => {
    if (clock === null || finished) return;
    const timer = window.setTimeout(() => setClock(Math.min(clock + 5, end)), 85);
    return () => window.clearTimeout(timer);
  }, [clock, end, finished]);
  const time = (minute: number) => `${6 + Math.floor(minute / 60)}:${String(minute % 60).padStart(2, "0")} p.m.`;
  return (
    <>
      <p><strong>Group vote</strong> · Night market 2, museum 1. Both start at 6. Dinner takes 25 minutes and the station is 12 minutes away. The train leaves at 7:15.</p>
      <label>First stop<select value={stop} onChange={(event) => { setStop(event.target.value); setClock(null); }}>
        <option value="market">Night market · 27 min</option><option value="museum">Museum · 18 min</option>
      </select></label>
      <label>Dinner starts at {time(dinner)}<input type="range" min="10" max="55" step="1" value={dinner}
        onChange={(event) => { setDinner(Number(event.target.value)); setClock(null); }} /></label>
      <div className={styles.timeline} aria-hidden="true">
        <span style={{ width: `${duration / 76 * 100}%` }} />
        <span style={{ left: `${dinner / 76 * 100}%`, width: `${25 / 76 * 100}%` }} />
        <i style={{ left: `${(clock ?? 0) / 76 * 100}%` }} />
      </div>
      <p role="status">{clock === null ? "Set the plan, then replay it." : !finished ? time(clock)
        : conflict ? "Dinner overlaps the first stop. Move it later or pick a shorter stop."
          : arrival > 75 ? "You missed the train. Rewind and try an earlier dinner." : `You reached the platform at ${time(arrival)}.`}</p>
      <button type="button" onClick={() => setClock(0)}>{clock === null ? "Run itinerary" : "Replay itinerary"}</button>
      {finished && !conflict && arrival <= 75 && <button type="button" onClick={finish}>Collect Conductor badge</button>}
    </>
  );
}

const screenings = [
  { time: "6:20", theater: "Starlight", movie: "Moon Harbor" },
  { time: "7:00", theater: "Riverside", movie: "Paper Planet" },
  { time: "7:30", theater: "Starlight", movie: "Moon Harbor" },
];
function Cinema({ finish }: { finish: Finish }) {
  const [onlyFavorite, setOnlyFavorite] = useState(false);
  const [saved, setSaved] = useState<number | null>(null);
  const [delayed, setDelayed] = useState(false);
  const complete = delayed && saved === 2;
  return (
    <>
      <p><strong>Watchlist</strong> · Moon Harbor. <strong>Favorite theater</strong> · Starlight. Pick an early screening and save it for the group.</p>
      <label className={styles.check}><input type="checkbox" checked={onlyFavorite} onChange={(event) => setOnlyFavorite(event.target.checked)} /> Favorite theater only</label>
      <div className={styles.choices}>
        {screenings.map(({ time, theater, movie }, index) => (!onlyFavorite || theater === "Starlight") && (
          <button type="button" key={time} aria-pressed={saved === index} onClick={() => setSaved(index)}>{time} · {movie} · {theater}</button>
        ))}
      </div>
      <p role="status">{complete ? "You kept the same movie and theater. Your updated ticket is ready."
        : delayed ? "Lee now arrives at 7:15. Swap the screening and keep the original movie and theater."
          : saved === 0 ? "6:20 screening saved to the shortlist." : "Start with the first Moon Harbor screening at Starlight."}</p>
      {saved === 0 && !delayed && <button type="button" onClick={() => setDelayed(true)}>Read incoming message</button>}
      {complete && <button type="button" onClick={finish}>Print ticket and collect badge</button>}
    </>
  );
}

const marketDates = ["Mar 31", "Apr 15", "May 3", "May 6", "May 7"];
const replay = [100, 103, 98, 102, 101];
function Market({ finish }: { finish: Finish }) {
  const [date, setDate] = useState(1);
  const [fixed, setFixed] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  return (
    <>
      <p>The model used a March-quarter filing in its April 15 forecast. Move the date dial to check when the filing became public. This is a fictional replay.</p>
      <label>Observation date · {marketDates[date]}<input type="range" min="0" max="4" value={date} onChange={(event) => setDate(Number(event.target.value))} /></label>
      <div className={styles.choices} aria-label="Market replay">
        {replay.slice(0, date + 1).map((price, index) => <span key={index}>{marketDates[index]} <strong>{price}</strong></span>)}
      </div>
      <p role="status">{date < 2 ? "SEC filing · Sealed" : "SEC filing · Public May 3, after the April 15 forecast."}</p>
      {date >= 2 && !fixed && <button type="button" onClick={() => setFixed(true)}>Use public filing date</button>}
      {fixed && <p>The April forecast now excludes the filing. Step ahead to May 7 to compare a flat baseline with the corrected model.</p>}
      {fixed && date === 4 && !reviewed && <button type="button" onClick={() => setReviewed(true)}>Compare forecasts</button>}
      {reviewed && <><p>May 7 actual: <strong>101</strong>. Flat baseline: 102 (error 1). Replay XGBoost forecast: 100.7 (error 0.3).</p><button type="button" onClick={finish}>Collect Research badge</button></>}
    </>
  );
}

export function MiniPortfolio({ portfolio }: { portfolio: TownPortfolio }) {
  return (
    <div className={styles.miniSite} data-theme={portfolio.theme}>
      <small>{portfolio.theme} · Published version</small><strong>{portfolio.name}</strong><span>{portfolio.headline}</span>
    </div>
  );
}

function Workshop({ finish, published, publish }: { finish: Finish; published: TownPortfolio | null; publish: (value: TownPortfolio) => void }) {
  const [company, setCompany] = useState("West District");
  const [headline, setHeadline] = useState(published?.headline ?? "Product designer");
  const [theme, setTheme] = useState(published?.theme ?? "Cinema");
  return (
    <>
      <p>The résumé import read the location as the employer. The original lists <strong>Signal Studio</strong> as the company and West District as the location.</p>
      <label>Imported company<select value={company} onChange={(event) => setCompany(event.target.value)}>
        <option>West District</option><option>Signal Studio</option>
      </select></label>
      <label>Draft headline<input value={headline} maxLength={75} onChange={(event) => setHeadline(event.target.value)} /></label>
      <label>Design<select value={theme} onChange={(event) => setTheme(event.target.value)}><option>Cinema</option><option>Desktop</option><option>Terminal</option></select></label>
      <button type="button" disabled={company !== "Signal Studio" || !headline.trim()} onClick={() => publish({ name: "Sandesh", headline: headline.trim(), theme })}>
        {published ? "Publish update" : "Publish mini portfolio"}
      </button>
      {published && <MiniPortfolio portfolio={published} />}
      {published && <button type="button" onClick={finish}>Collect Publisher badge</button>}
    </>
  );
}

export function TrainerEncounter({ game, finish, published, publish }: {
  game: TrainerGame; finish: Finish; published: TownPortfolio | null; publish: (value: TownPortfolio) => void;
}) {
  return (
    <div className={styles.challenge}>
      {game === "train" && <Train finish={finish} />}
      {game === "cinema" && <Cinema finish={finish} />}
      {game === "market" && <Market finish={finish} />}
      {game === "workshop" && <Workshop finish={finish} published={published} publish={publish} />}
    </div>
  );
}
