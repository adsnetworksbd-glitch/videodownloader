const ADMIN_TOKEN_KEY = "gateway.admin_token";

export function getAdminToken(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(ADMIN_TOKEN_KEY) || "";
}

export function setAdminToken(token: string): void {
  window.localStorage.setItem(ADMIN_TOKEN_KEY, token || "");
}

export async function apiFetch<T = unknown>(
  path: string,
  { method = "GET", body, admin = false }: { method?: string; body?: unknown; admin?: boolean } = {}
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (admin) headers["X-Admin-Token"] = getAdminToken();
  const response = await fetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 204) return null as T;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = (data as { detail?: unknown } | null)?.detail;
    throw new Error((typeof detail === "string" ? detail : null) || `Request failed (${response.status})`);
  }
  return data as T;
}
