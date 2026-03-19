/**
 * Next.js API Route — Proxy for /query/stream
 *
 * The browser can't reach localhost:3001 directly in the preview environment,
 * so we proxy the request server-side. The browser calls /api/query/stream
 * (same origin), and this route forwards it to the NestJS API on port 3001.
 */

import { NextRequest } from 'next/server';

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function POST(req: NextRequest) {
  const body = await req.text();

  // Forward the request to the NestJS backend (server-to-server, no CORS)
  const upstream = await fetch(`${API_URL}/query/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body,
  });

  if (!upstream.ok || !upstream.body) {
    return new Response(
      JSON.stringify({ error: 'Upstream API error', status: upstream.status }),
      { status: upstream.status, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Pass the SSE stream through to the browser
  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
