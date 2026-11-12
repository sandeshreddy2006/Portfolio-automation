import type { NextRequest } from "next/server";
import { acceptedCookiePreference, cookiePreferenceName } from "@/lib/cookie-preference";

export const authHeaders = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

export function allowsAuthCookies(request: NextRequest) {
  return request.cookies.get(cookiePreferenceName)?.value === acceptedCookiePreference;
}

const authCookieNames = ["session", "challenge", "oauth"].flatMap((name) => [
    `portfolabs_${name}`,
    `__Host-portfolabs_${name}`,
]);

export function authCookieHeader(request: NextRequest, signingOut = false) {
  if (!signingOut && !allowsAuthCookies(request)) return "";
  return authCookieNames.flatMap((name) => {
    const value = request.cookies.get(name)?.value;
    return value && /^[\w.-]+$/.test(value) ? [`${name}=${value}`] : [];
  }).join("; ");
}

export function signedOutHeaders(request: NextRequest) {
  const headers = new Headers(authHeaders);
  for (const name of authCookieNames) {
    const secure = request.nextUrl.protocol === "https:";
    if (name.startsWith("__Host-") && !secure) continue;
    headers.append("Set-Cookie", `${name}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`);
  }
  return headers;
}

export function backendAuthUrl(endpoint: string) {
  const base = process.env.BACKEND_URL ||
    (process.env.NODE_ENV === "development" ? "http://127.0.0.1:8000" : "");
  return base ? new URL(`/api/auth/${endpoint}`, base) : null;
}
