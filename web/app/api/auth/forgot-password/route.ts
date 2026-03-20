import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const upstream = await fetch(`${API_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await upstream.json().catch(() => ({ ok: true }));
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    // If API unreachable, return ok to avoid email enumeration
    return NextResponse.json({ ok: true });
  }
}
