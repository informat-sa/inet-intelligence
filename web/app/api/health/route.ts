import { NextRequest } from 'next/server';

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function GET(_req: NextRequest) {
  try {
    const res = await fetch(`${API_URL}/health`, { cache: 'no-store' });
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch {
    return Response.json({ status: 'error', db: false, llm: false }, { status: 503 });
  }
}
