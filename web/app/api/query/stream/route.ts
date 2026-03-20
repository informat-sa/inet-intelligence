/**
 * Next.js API Route — Proxy for /query/stream
 * Forwards Authorization header so JWT is validated by NestJS.
 */
import { NextRequest } from 'next/server';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const authHeader = req.headers.get('Authorization');

  const upstream = await fetch(`${API_URL}/query/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    body,
  });

  if (!upstream.ok || !upstream.body) {
    return new Response(
      JSON.stringify({ error: 'Upstream API error', status: upstream.status }),
      { status: upstream.status, headers: { 'Content-Type': 'application/json' } },
    );
  }

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
