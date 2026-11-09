import type { NextRequest } from "next/server";

export const authHeaders = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

export function authCookieHeader(request: NextRequest) {
  return ["session", "challenge", "oauth"].flatMap((name) => [
    `portfolabs_${name}`,
    `__Host-portfolabs_${name}`,
  ]).flatMap((name) => {
    const value = request.cookies.get(name)?.value;
    return value && /^[\w.-]+$/.test(value) ? [`${name}=${value}`] : [];
  }).join("; ");
}

export function backendAuthUrl(endpoint: string) {
  const base = process.env.BACKEND_URL ||
    (process.env.NODE_ENV === "development" ? "http://127.0.0.1:8000" : "");
  return base ? new URL(`/api/auth/${endpoint}`, base) : null;
}
