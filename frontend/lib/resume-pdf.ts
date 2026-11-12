import { suggestResumeDetails } from "./resume";

export const maxResumeBytes = 5 * 1024 * 1024;

export async function importResume(file: File) {
  if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
    throw new Error("Choose a PDF résumé.");
  }
  if (file.size === 0 || file.size > maxResumeBytes) {
    throw new Error("Choose a PDF that is 5 MB or smaller.");
  }

  const data = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(data.subarray(0, 5)) !== "%PDF-") {
    throw new Error("That file isn’t a valid PDF.");
  }

  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url,
  ).href;

  const loading = pdfjs.getDocument({ data, useWasm: false, useWorkerFetch: false, disableFontFace: true });
  try {
    const pdf = await loading.promise;
    if (pdf.numPages > 10) throw new Error("Choose a résumé that is 10 pages or fewer.");

    const pages: string[] = [];
    const urls: string[] = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const { items } = await page.getTextContent();
      let text = "";
      let previousY: number | undefined;
      for (const item of items) {
        if (!("str" in item)) continue;
        const y = item.transform[5];
        if (text && !text.endsWith("\n") && previousY !== undefined && Math.abs(y - previousY) > 3) {
          text += "\n";
        }
        text += item.str + (item.hasEOL ? "\n" : " ");
        previousY = y;
      }
      pages.push(text);
      for (const annotation of await page.getAnnotations()) {
        if (typeof annotation.url === "string" && /^https?:\/\//i.test(annotation.url)) {
          urls.push(annotation.url);
        }
      }
      page.cleanup();
    }

    const text = pages.join("\n");
    if (!text.trim()) throw new Error("This PDF has no selectable text. Export a text PDF from your résumé editor and try again.");
    return suggestResumeDetails(text, urls);
  } finally {
    await loading.destroy();
  }
}
