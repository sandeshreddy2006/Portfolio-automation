import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
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
