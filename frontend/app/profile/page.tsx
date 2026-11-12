import type { Metadata } from "next";
import StudioHeader from "../studio-header";
import Profile from "./profile";

export const metadata: Metadata = { title: "Your profile | Portfolabs", robots: { index: false } };

export default function ProfilePage() {
  return (
    <>
      <StudioHeader />
      <Profile />
    </>
  );
}
