import { prepareImage, type ImageKind } from "./image";
import type { PortfolioDetail, PortfolioSummary, ProfileContent, ProfileDetails } from "./portfolio";

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function describe(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail[0]) {
    const { loc, msg } = detail[0] as { loc?: unknown[]; msg?: string };
    const field = String(loc?.at(-1) ?? "").replace(/_/g, " ");
    return field ? `Check the "${field}" field: ${msg}` : (msg ?? "Check the details you entered.");
  }
  return "Something went wrong. Please try again.";
}

async function call<T>(path: string, method = "GET", body?: unknown, base = "/api/portfolios"): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      method,
      cache: "no-store",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Could not reach the server. Check your connection and try again.", 0);
  }
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(describe(data?.detail), response.status);
  return data as T;
}

export async function uploadImage(file: File, kind: ImageKind): Promise<string> {
  const blob = await prepareImage(file, kind);
  let response: Response;
  try {
    response = await fetch(`/api/uploads?kind=${kind}`, {
      method: "POST", headers: { "Content-Type": blob.type }, body: blob, cache: "no-store",
    });
  } catch {
    throw new ApiError("Could not reach the server. Check your connection and try again.", 0);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(describe(data?.detail), response.status);
  return data.url as string;
}

export const portfolios = {
  list: () => call<PortfolioSummary[]>(""),
  create: (slug: string, draft_content: unknown) => call<PortfolioDetail>("", "POST", { slug, draft_content }),
  get: (slug: string) => call<PortfolioDetail>(`/${slug}`),
  save: (slug: string, draft_content: unknown, base_revision: number) =>
    call<PortfolioDetail>(`/${slug}`, "PUT", { draft_content, base_revision }),
  rename: (slug: string, newSlug: string) => call<PortfolioDetail>(`/${slug}/address`, "PATCH", { slug: newSlug }),
  publish: (slug: string) => call<PortfolioDetail>(`/${slug}/publish`, "POST"),
  unpublish: (slug: string) => call<PortfolioDetail>(`/${slug}/unpublish`, "POST"),
  remove: (slug: string) => call<void>(`/${slug}`, "DELETE"),
};


export const profile = {
  get: () => call<ProfileDetails>("", "GET", undefined, "/api/profile"),
  save: (content: ProfileContent) => call<ProfileDetails>("", "PUT", content, "/api/profile"),
  removeResume: () => call<void>("/resume", "DELETE", undefined, "/api/profile"),
  async uploadResume(file: File): Promise<string> {
    const response = await fetch("/api/profile/resume", {
      method: "POST", cache: "no-store", headers: { "Content-Type": "application/pdf" }, body: file,
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new ApiError(describe(result?.detail), response.status);
    return result.resume_id as string;
  },
};
