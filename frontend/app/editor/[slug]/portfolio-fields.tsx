import { move } from "@/lib/profile";
import { encounters, starterProjects, trainerGames } from "@/lib/trainer-journal";
import type { ProfileContent, TrainerGame } from "@/lib/portfolio";
import BulletField from "../bullet-field";
import AssistButton from "./assist-button";
import ImageField from "./image-field";
import ResumeSections from "./resume-sections";
import styles from "../../studio.module.css";

const MAX_PROJECTS = 30;
const MAX_LINKS = 20;

export default function PortfolioFields({ content, template, disabled, update }: {
  content: ProfileContent; template: string; disabled: boolean; update: (patch: Partial<ProfileContent>) => void;
}) {
  return (
    <>
      <section id="sec-projects" className={styles.group}>
        <h2>Projects <span>({content.projects.length}/{MAX_PROJECTS})</span></h2>
        <p className={styles.hint}>For each one: what did you build, what was your part, and what did you learn?</p>
        {template === "trainer-journal" && content.projects.length === 0 && (
          <button type="button" className={styles.secondary} disabled={disabled}
            onClick={() => update({ projects: starterProjects })}>Add the four starter encounters</button>
        )}
        {content.projects.map((project, index) => (
          <fieldset key={index} className={styles.row}>
            <legend>Project {index + 1}</legend>
            <label>Title
              <input maxLength={120} value={project.title ?? ""}
                onChange={(event) => update({ projects: content.projects.map((item, at) => at === index ? { ...item, title: event.target.value } : item) })} />
            </label>
            <BulletField label="Description" rows={4} value={project.description ?? ""}
              onChange={(description) => update({ projects: content.projects.map((item, at) => at === index ? { ...item, description } : item) })} />
            <AssistButton task="project" text={project.description ?? ""} name={content.name} title={project.title ?? ""}
              onAccept={(text) => update({ projects: content.projects.map((item, at) => at === index ? { ...item, description: text } : item) })} />
            <label>Link (optional)
              <input type="url" inputMode="url" placeholder="https://" value={project.url ?? ""}
                onChange={(event) => update({ projects: content.projects.map((item, at) => at === index ? { ...item, url: event.target.value } : item) })} />
            </label>
            {template === "trainer-journal" && (
              <label>Trainer Journal encounter
                <select value={project.trainer_game ?? ""} disabled={disabled}
                  onChange={(event) => {
                    const trainer_game = (event.target.value || null) as TrainerGame | null;
                    update({ projects: content.projects.map((item, at) => at === index ? { ...item, trainer_game } : item) });
                  }}>
                  <option value="">Journal only</option>
                  {trainerGames.map((id) => <option key={id} value={id} disabled={content.projects.some((item, at) => at !== index && item.trainer_game === id)}>{encounters[id].title}</option>)}
                </select>
              </label>
            )}
            <ImageField label="Project image (optional)" kind="project" template={template} value={project.image}
              hint={template === "cinema" && index === 0
                ? "This image also becomes the Cinema backdrop. Leave it blank to use the default backdrop."
                : template === "cinema" || template === "storefront"
                  ? "Upload a cover image or leave it blank to show the project initials."
                  : undefined}
              framing={project.image_framing} disabled={disabled}
              onChange={(url, framing) => update({ projects: content.projects.map((item, at) => at === index ? { ...item, image: url, image_framing: framing } : item) })} />
            <div className={styles.rowActions}>
              <button type="button" aria-label={`Move project ${index + 1} up`} disabled={index === 0} onClick={() => update({ projects: move(content.projects, index, index - 1) })}>↑</button>
              <button type="button" aria-label={`Move project ${index + 1} down`} disabled={index === content.projects.length - 1} onClick={() => update({ projects: move(content.projects, index, index + 1) })}>↓</button>
              <button type="button" className={styles.danger} onClick={() => update({ projects: content.projects.filter((_, at) => at !== index) })}>Remove</button>
            </div>
          </fieldset>
        ))}
        <button type="button" className={styles.secondary} disabled={content.projects.length >= MAX_PROJECTS}
          onClick={() => update({ projects: [...content.projects, { title: "", description: "", url: "", image: null }] })}>
          Add a project
        </button>
      </section>

      <ResumeSections
        experience={content.experience ?? []}
        credentials={content.credentials ?? []}
        onExperience={(experience) => update({ experience })}
        onCredentials={(credentials) => update({ credentials })}
      />

      <section id="sec-links" className={styles.group}>
        <h2>Links <span>({content.links.length}/{MAX_LINKS})</span></h2>
        {content.links.map((link, index) => (
          <fieldset key={index} className={styles.row}>
            <legend>Link {index + 1}</legend>
            <div className={styles.fieldRow}>
              <label>Label
                <input maxLength={120} value={link.label} placeholder="GitHub"
                  onChange={(event) => update({ links: content.links.map((item, at) => at === index ? { ...item, label: event.target.value } : item) })} />
              </label>
              <label>Web address
                <input type="url" inputMode="url" placeholder="https://" value={link.url}
                  onChange={(event) => update({ links: content.links.map((item, at) => at === index ? { ...item, url: event.target.value } : item) })} />
              </label>
            </div>
            <div className={styles.rowActions}>
              <button type="button" aria-label={`Move link ${index + 1} up`} disabled={index === 0} onClick={() => update({ links: move(content.links, index, index - 1) })}>↑</button>
              <button type="button" aria-label={`Move link ${index + 1} down`} disabled={index === content.links.length - 1} onClick={() => update({ links: move(content.links, index, index + 1) })}>↓</button>
              <button type="button" className={styles.danger} onClick={() => update({ links: content.links.filter((_, at) => at !== index) })}>Remove</button>
            </div>
          </fieldset>
        ))}
        <button type="button" className={styles.secondary} disabled={content.links.length >= MAX_LINKS}
          onClick={() => update({ links: [...content.links, { label: "", url: "" }] })}>
          Add a link
        </button>
      </section>

    </>
  );
}
