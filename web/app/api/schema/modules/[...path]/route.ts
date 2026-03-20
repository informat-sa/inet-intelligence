import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

/** Proxy: GET /api/schema/modules          → GET /schema/modules
 *         GET /api/schema/modules/:prefix  → GET /schema/modules/:prefix */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const authHeader  = req.headers.get('Authorization');
  const { path }    = await params;
  const suffix      = path?.join('/') ?? '';
  const upstream   = await fetch(`${API_URL}/schema/modules/${suffix}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    cache: 'no-store',
  });
  const data = await upstream.json().catch(() => ({}));
  return NextResponse.json(data, { status: upstream.status });
}
