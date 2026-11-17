import type { Metadata } from "next";
import StudioHeader from "../studio-header";
import Settings from "./settings";

export const metadata: Metadata = { title: "Settings | Portfolabs", robots: { index: false } };

export default function SettingsPage() {
  return (
    <>
      <StudioHeader />
      <Settings />
    </>
  );
}
