import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

export async function GET(req: NextRequest) {
  const auth = req.headers.get('Authorization');
  const res = await fetch(`${API_URL}/conversations`, {
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { Authorization: auth } : {}),
    },
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ([]));
  return NextResponse.json(data, { status: res.status });
}
