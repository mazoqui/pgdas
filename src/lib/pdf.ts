/**
 * The statement's text in reading order, whitespace collapsed - read in the browser.
 * The file never leaves the page: no upload, no storage, and the pdf.js worker is
 * bundled with the app (no CDN).
 */
import { PgdasError } from "./pgdas";

const MAX_PAGES = 20;
const MAX_BYTES = 10 * 1024 * 1024;

export const extractPdfText = async (file: File): Promise<string> => {
  if (file.size > MAX_BYTES) throw new PgdasError("pgdas_unreadable");
  // Loaded on the first file, so the page itself opens fast.
  const pdfjs = await import("pdfjs-dist");
  if (import.meta.env.MODE === "single") {
    // The single-file build has no other file to start a worker from, and Chrome refuses
    // a module worker from a blob: URL on a page opened from disk (file://). Loaded here,
    // the worker's code runs on the page itself, which pdf.js picks up from this global.
    // Vite drops this branch from the other build, and the other branch from this one.
    (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker ??= await import("pdfjs-dist/build/pdf.worker.min.mjs");
  } else if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    const { default: url } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = url;
  }

  const task = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    disableFontFace: true,
    verbosity: 0,
  });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > MAX_PAGES) throw new PgdasError("pgdas_unreadable");
    const pages: string[] = [];
    for (let number = 1; number <= pdf.numPages; number += 1) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
    }
    return pages.join(" ").replace(/\s+/g, " ").trim();
  } catch (error) {
    if (error instanceof PgdasError) throw error;
    throw new PgdasError("pgdas_unreadable");
  } finally {
    await task.destroy();
  }
};
