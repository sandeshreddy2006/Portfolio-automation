import type { Metadata } from "next";
import PreviewFrame from "./preview-frame";

export const metadata: Metadata = { title: "Preview", robots: { index: false } };

export default function PreviewFramePage() {
  return <PreviewFrame />;
}
