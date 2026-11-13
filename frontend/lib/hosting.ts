import { ApiError } from "./api";

export type DnsRecord = { type: string; name: string; value: string };
export type Domain = { hostname: string; active: boolean; attached: boolean; records: DnsRecord[] };
export type Deployment = { connection_id: string; status: string; url: string | null; error: string | null };
export type Hosting = {
  domains_available: boolean;
  deploy_available: boolean;
  domain: Domain | null;
  connections: { id: string; label: string }[];
  deployments: Deployment[];
};

async function call<T>(path: string, method = "GET", body?: object): Promise<T> {
  const response = await fetch(`/api/hosting/${path}`, {
    method, cache: "no-store",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(typeof data?.detail === "string" ? data.detail : "The hosting request couldn’t be completed.", response.status);
  return data as T;
}

export const hosting = {
  settings: (slug: string) => call<Hosting>(`portfolios/${slug}`),
  connectDomain: (slug: string, hostname: string) => call<Domain>(`portfolios/${slug}/domain`, "POST", { hostname }),
  verifyDomain: (slug: string) => call<Domain>(`portfolios/${slug}/domain/verify`, "POST"),
  removeDomain: (slug: string) => call<void>(`portfolios/${slug}/domain`, "DELETE"),
  connectVercel: (slug: string) => call<{ url: string }>(`portfolios/${slug}/vercel/connect`, "POST"),
  deploy: (slug: string, connection_id: string) => call<Deployment>(`portfolios/${slug}/vercel/deploy`, "POST", { connection_id }),
  status: (slug: string, id: string) => call<Deployment>(`portfolios/${slug}/vercel/status?connection_id=${encodeURIComponent(id)}`),
  disconnect: (id: string) => call<void>(`vercel/connections/${id}`, "DELETE"),
};
