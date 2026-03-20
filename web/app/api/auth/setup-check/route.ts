import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

export async function GET() {
  try {
    const upstream = await fetch(`${API_URL}/auth/setup-check`, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });
    const data = await upstream.json().catch(() => ({ needsSetup: false }));
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    // If API is unreachable, assume no setup needed (demo mode)
    return NextResponse.json({ needsSetup: false, demoMode: true });
  }
}
