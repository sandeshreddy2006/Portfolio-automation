"use client";

import { usePathname } from "next/navigation";

export function Credits() {
  return <span>© 2026 Portfolabs · Built by Sandesh Reddy Patlolla and Suhas Nethi</span>;
}

export default function SiteCredits() {
  const pathname = usePathname();
  if (pathname === "/preview-frame" || pathname.startsWith("/p/") || pathname.includes("/frame/")) return null;
  return <footer className="platform-credits page-width"><Credits /></footer>;
}
