import type { StreamChunk, PortalUser, Favorite, Tenant, JwtPayload, AccessibleTenant } from "@/types";

/**
 * All requests go through Next.js API routes (/api/...) which proxy
 * server-side to the NestJS backend on localhost:3001.
 * This avoids CORS issues in the browser preview environment.
 */
const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("inet_token") : null;
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? "Request failed");
  }
  return res.json();
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export async function login(email: string, password: string) {
  return request<{
    access_token:      string;
    user:              JwtPayload & { name?: string; empresa?: string; modules?: string[] };
    accessibleTenants: AccessibleTenant[];
  }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function getMe() {
  return request<{
    sub: string; email: string; role: string;
    tenantId: string | null; tenantSlug: string | null; tenantName: string | null;
    allowedModules: string[];
  }>("/auth/me");
}

export async function acceptInvite(token: string, name: string, password: string) {
  return request<{ access_token: string }>("/auth/invite/accept", {
    method: "POST",
    body: JSON.stringify({ token, name, password }),
  });
}

/** Step 1: request a password reset email. Always returns { ok: true } */
export async function forgotPassword(email: string) {
  return request<{ ok: true }>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

/** Step 2: apply new password using the reset token */
export async function resetPassword(token: string, password: string) {
  return request<{ ok: true }>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}

/**
 * Switch tenant context — returns a new JWT scoped to the selected company.
 * Requires an existing authenticated session (JWT in localStorage).
 */
export async function selectTenant(tenantId: string) {
  return request<{
    access_token:      string;
    user:              { id: string; name: string; email: string; empresa: string; modules: string[]; role: string; tenantId: string; tenantSlug: string };
    accessibleTenants: AccessibleTenant[];
  }>("/auth/select-tenant", {
    method: "POST",
    body: JSON.stringify({ tenantId }),
  });
}

// ─── Query (streaming) ────────────────────────────────────────────────────────
export async function* streamQuery(
  question: string,
  conversationId?: string,
  /** When set, skip auto-detection and use exactly these module prefixes */
  forcedModules?: string[]
): AsyncGenerator<StreamChunk> {
  const token = typeof window !== "undefined" ? localStorage.getItem("inet_token") : null;

  const body: Record<string, unknown> = { question, conversationId };
  if (forcedModules?.length) body.forcedModules = forcedModules;

  // Call the Next.js proxy route (same origin — no CORS)
  const res = await fetch(`${BASE}/query/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) throw new Error("Stream failed");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const chunk: StreamChunk = JSON.parse(line.slice(6));
          yield chunk;
        } catch { /* skip malformed */ }
      }
    }
  }
}

// ─── Users (Admin panel) ──────────────────────────────────────────────────────
export async function listUsers(): Promise<PortalUser[]> {
  return request<PortalUser[]>("/users");
}

export async function inviteUser(data: {
  email: string;
  name?: string;
  modulePermissions: string[];
}): Promise<PortalUser> {
  return request<PortalUser>("/users/invite", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getUserPermissions(userId: string): Promise<{ modulePrefix: string; enabled: boolean }[]> {
  return request<{ modulePrefix: string; enabled: boolean }[]>(`/users/${userId}/permissions`);
}

export async function setUserPermissions(userId: string, modules: string[]): Promise<void> {
  return request<void>(`/users/${userId}/permissions`, {
    method: "PUT",
    body: JSON.stringify({ modules }),
  });
}

export async function deactivateUser(userId: string): Promise<void> {
  return request<void>(`/users/${userId}`, { method: "DELETE" });
}

export async function resendInvite(userId: string): Promise<void> {
  return request<void>(`/users/${userId}/resend-invite`, { method: "POST" });
}

// ─── Favorites ────────────────────────────────────────────────────────────────
export async function getFavorites(): Promise<Favorite[]> {
  return request<Favorite[]>("/favorites");
}

export async function saveFavorite(data: {
  title: string;
  question: string;
  modulesHint?: string[];
}): Promise<Favorite> {
  return request<Favorite>("/favorites", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteFavorite(id: string): Promise<void> {
  return request<void>(`/favorites/${id}`, { method: "DELETE" });
}

// ─── Tenants (SuperAdmin) ─────────────────────────────────────────────────────
export async function listTenants(): Promise<Tenant[]> {
  return request<Tenant[]>("/tenants");
}

// ─── Schema (module explorer) ─────────────────────────────────────────────────
export interface SchemaTableAttr {
  name:   string;
  title:  string;
  type:   string;
  length: number;
  dec:    number;
  desc:   string | null;
}
export interface SchemaTableDetail {
  name:           string;
  description:    string;
  attributeCount: number;
  attributes:     SchemaTableAttr[];
}
export interface SchemaModuleDetail {
  prefix:         string;
  name:           string;
  description:    string;
  keywords:       string[];
  tableCount:     number;
  attributeCount: number;
  tables:         SchemaTableDetail[];
}

export async function getSchemaModule(prefix: string): Promise<SchemaModuleDetail> {
  return request<SchemaModuleDetail>(`/schema/modules/${prefix}`);
}

// ─── Health ───────────────────────────────────────────────────────────────────
export async function healthCheck(): Promise<{ status: string; db: boolean; llm: boolean }> {
  return request("/health");
}
