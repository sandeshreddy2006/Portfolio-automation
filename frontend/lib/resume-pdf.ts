import { suggestResumeDetails, type ResumeLine } from "./resume";

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

    const lines: ResumeLine[] = [];
    const unmatchedLinks: ResumeLine[] = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const { items } = await page.getTextContent();
      const pageLines: (ResumeLine & { y: number; left: number; right: number })[] = [];
      let current: (typeof pageLines)[number] | undefined;
      for (const item of items) {
        if (!("str" in item)) continue;
        const [, , , , x, y] = item.transform;
        if (item.str.trim()) {
          if (!current || Math.abs(y - current.y) > 3) {
            current = { text: "", y, left: x, right: x + item.width };
            pageLines.push(current);
          }
          const gap = x - current.right;
          current.text += (current.text ? (gap > Math.max(12, item.height * 1.5) ? "\t" : " ") : "") + item.str;
          current.left = Math.min(current.left, x);
          current.right = Math.max(current.right, x + item.width);
        }
        if (item.hasEOL) current = undefined;
      }
      for (const annotation of await page.getAnnotations()) {
        if (typeof annotation.url !== "string" || !/^https?:\/\//i.test(annotation.url)) continue;
        const { url, rect } = annotation;
        if (!Array.isArray(rect) || rect.length !== 4) {
          unmatchedLinks.push({ text: "", urls: [url] });
          continue;
        }
        const [left, bottom, right, top] = rect as number[];
        const target = pageLines.filter((line) => line.y >= bottom - 4 && line.y <= top + 2
          && line.left <= right + 3 && line.right >= left - 3)
          .sort((first, second) => Math.abs(first.y - bottom) - Math.abs(second.y - bottom))[0];
        if (target) (target.urls ??= []).push(url);
        else unmatchedLinks.push({ text: "", urls: [url] });
      }
      lines.push(...pageLines);
      page.cleanup();
    }

    if (!lines.some(({ text }) => text.trim())) {
      throw new Error("This PDF has no selectable text. Export a text PDF from your résumé editor and try again.");
    }
    return suggestResumeDetails(lines, unmatchedLinks);
  } finally {
    await loading.destroy();
  }
}
