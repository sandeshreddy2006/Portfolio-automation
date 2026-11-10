/** Base URL of the FastAPI service, for server-side code only. */
export function backendBase(): string | null {
  return (
    process.env.BACKEND_URL ||
    (process.env.NODE_ENV === "development" ? "http://127.0.0.1:8000" : "") ||
    null
  );
}

export function backendUrl(path: string): URL | null {
  const base = backendBase();
  return base ? new URL(path, base) : null;
}
