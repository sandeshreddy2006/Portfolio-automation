import type { CSSProperties } from "react";
import type { ImageFilter, ImageFraming } from "./portfolio";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 3.9 * 1024 * 1024; // the server allows 4 MB

export type ImageKind = "avatar" | "project";
const MAX_SIDE: Record<ImageKind, number> = { avatar: 800, project: 1600 };

export const defaultFraming: ImageFraming = { x: 50, y: 50, zoom: 1, filter: "original" };

export const imageFilters: Record<ImageFilter, string> = {
  original: "none",
  monochrome: "grayscale(1)",
  warm: "sepia(.3) saturate(1.2)",
  cool: "sepia(.16) hue-rotate(165deg) saturate(.95)",
  vivid: "saturate(1.4) contrast(1.08)",
};

export function imageFramingStyle({ x, y, zoom, filter }: ImageFraming): CSSProperties {
  const position = `${x}% ${y}%`;
  return { objectPosition: position, transformOrigin: position, transform: `scale(${zoom})`, filter: imageFilters[filter] };
}

export function validateImageFile(file: File) {
  if (!ACCEPTED.includes(file.type)) throw new Error("Please choose a JPEG, PNG or WebP image.");
  if (file.size > MAX_SOURCE_BYTES) throw new Error("That image is too large. Please choose one under 25 MB.");
}

/** Shrinks a photo in the browser so uploads are small and fast. The server re-checks everything. */
export async function prepareImage(file: File, kind: ImageKind): Promise<Blob> {
  validateImageFile(file);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("That file couldn’t be read as an image.");
  }

  const scale = Math.min(1, MAX_SIDE[kind] / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser couldn’t process that image.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
  if (!blob) throw new Error("Your browser couldn’t process that image.");
  if (blob.size > MAX_UPLOAD_BYTES) throw new Error("That image is still too large after shrinking. Try a simpler one.");
  return blob;
}
