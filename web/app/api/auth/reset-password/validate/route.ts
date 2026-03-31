import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') ?? '';
  const upstream = await fetch(
    `${API_URL}/auth/reset-password/validate?token=${encodeURIComponent(token)}`,
    { method: 'GET', headers: { 'Content-Type': 'application/json' } }
  );
  const data = await upstream.json().catch(() => ({ valid: false }));
  return NextResponse.json(data, { status: upstream.status });
}
