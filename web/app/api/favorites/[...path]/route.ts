/**
 * Generic proxy for /api/favorites/* → NestJS /favorites/*
 * Forwards Authorization header for JWT validation.
 */
import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

async function proxy(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const upstreamUrl = `${API_URL}/favorites/${path.join('/')}`;
  const authHeader = req.headers.get('Authorization');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(authHeader ? { Authorization: authHeader } : {}),
  };

  const body = req.method !== 'GET' && req.method !== 'HEAD'
    ? await req.text()
    : undefined;

  const upstream = await fetch(upstreamUrl, {
    method:  req.method,
    headers,
    body,
  });

  const data = await upstream.json().catch(() => ({}));
  return NextResponse.json(data, { status: upstream.status });
}

export const GET    = proxy;
export const POST   = proxy;
export const DELETE = proxy;
