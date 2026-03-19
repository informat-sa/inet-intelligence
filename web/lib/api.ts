import type { StreamChunk, Conversation } from "@/types";

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
  return request<{ access_token: string; user: unknown }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

// ─── Query (streaming) ────────────────────────────────────────────────────────
export async function* streamQuery(
  question: string,
  empresaId: string,
  conversationId?: string
): AsyncGenerator<StreamChunk> {
  const token = typeof window !== "undefined" ? localStorage.getItem("inet_token") : null;

  // Call the Next.js proxy route (same origin — no CORS)
  const res = await fetch(`${BASE}/query/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ question, empresaId, conversationId }),
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

// ─── History ─────────────────────────────────────────────────────────────────
export async function getHistory(empresaId: string): Promise<Conversation[]> {
  return request<Conversation[]>(`/history?empresaId=${empresaId}`);
}

// ─── Health ───────────────────────────────────────────────────────────────────
export async function healthCheck(): Promise<{ status: string; db: boolean; llm: boolean }> {
  return request("/health");
}
