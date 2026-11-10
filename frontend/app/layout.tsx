import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  // Lets relative share-image and canonical URLs resolve to full addresses.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.portfolabs.com"),
  title: "Portfolabs",
  applicationName: "Portfolabs",
  description: "Choose a template, add your work, and publish a portfolio you can share.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
