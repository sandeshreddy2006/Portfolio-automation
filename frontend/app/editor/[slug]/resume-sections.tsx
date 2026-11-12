import { MAX_RESUME_ENTRIES, type PortfolioCredential, type PortfolioExperience } from "@/lib/portfolio";
import styles from "../../studio.module.css";

function replaceRow<T>(rows: T[], index: number, values: Partial<T>) {
  return rows.map((row, position) => position === index ? { ...row, ...values } : row);
}

export default function ResumeSections({ experience, credentials, onExperience, onCredentials }: {
  experience: PortfolioExperience[];
  credentials: PortfolioCredential[];
  onExperience: (rows: PortfolioExperience[]) => void;
  onCredentials: (rows: PortfolioCredential[]) => void;
}) {
  return (
    <>
      <section id="sec-experience" className={styles.group}>
        <h2>Work experience <span>({experience.length}/{MAX_RESUME_ENTRIES})</span></h2>
        {experience.map((job, index) => (
          <fieldset className={styles.row} key={index}>
            <legend>Position {index + 1}</legend>
            <label>Role<input value={job.role} maxLength={120} onChange={(event) => onExperience(replaceRow(experience, index, { role: event.target.value }))} /></label>
            <label>Company<input value={job.company} maxLength={120} onChange={(event) => onExperience(replaceRow(experience, index, { company: event.target.value }))} /></label>
            <label>Dates<input value={job.dates} maxLength={100} placeholder="Jan 2024 – Present" onChange={(event) => onExperience(replaceRow(experience, index, { dates: event.target.value }))} /></label>
            <label>Description<textarea value={job.description} maxLength={4000} rows={3} onChange={(event) => onExperience(replaceRow(experience, index, { description: event.target.value }))} /></label>
            <div className={styles.actions}>
              <button type="button" className={styles.danger} onClick={() => onExperience(experience.filter((_, position) => position !== index))}>Remove position</button>
            </div>
          </fieldset>
        ))}
        <button type="button" className={styles.secondary} disabled={experience.length >= MAX_RESUME_ENTRIES}
          onClick={() => onExperience([...experience, { role: "", company: "", dates: "", description: "" }])}>
          Add position
        </button>
      </section>
      <section id="sec-credentials" className={styles.group}>
        <h2>Licenses &amp; certifications <span>({credentials.length}/{MAX_RESUME_ENTRIES})</span></h2>
        {credentials.map((credential, index) => (
          <fieldset className={styles.row} key={index}>
            <legend>Credential {index + 1}</legend>
            <label>Title<input value={credential.title} maxLength={120} onChange={(event) => onCredentials(replaceRow(credentials, index, { title: event.target.value }))} /></label>
            <label>Issuing organization<input value={credential.issuer} maxLength={120} onChange={(event) => onCredentials(replaceRow(credentials, index, { issuer: event.target.value }))} /></label>
            <label>Dates<input value={credential.date} maxLength={100} onChange={(event) => onCredentials(replaceRow(credentials, index, { date: event.target.value }))} /></label>
            <label>Credential URL<input type="url" value={credential.url ?? ""} maxLength={2083} onChange={(event) => onCredentials(replaceRow(credentials, index, { url: event.target.value }))} /></label>
            <div className={styles.actions}>
              <button type="button" className={styles.danger} onClick={() => onCredentials(credentials.filter((_, position) => position !== index))}>Remove credential</button>
            </div>
          </fieldset>
        ))}
        <button type="button" className={styles.secondary} disabled={credentials.length >= MAX_RESUME_ENTRIES}
          onClick={() => onCredentials([...credentials, { title: "", issuer: "", date: "", url: "" }])}>
          Add license or certification
        </button>
      </section>
    </>
  );
}
