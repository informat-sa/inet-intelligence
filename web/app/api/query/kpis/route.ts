import { NextRequest } from 'next/server';

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function GET(req: NextRequest) {
  try {
    const token  = req.headers.get('authorization') ?? '';
    const search = req.nextUrl.search; // preserva ?year=&month=
    const res = await fetch(`${API_URL}/query/kpis${search}`, {
      headers: { Authorization: token },
      cache: 'no-store',
    });
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch {
    return Response.json({ demo: true, periodo: 'Demo', year: new Date().getFullYear(),
      month: new Date().getMonth() + 1, ventasMes: 0, ventasMesAnterior: 0,
      variacionPct: 0, documentos: 0, clientesActivos: 0, ticketPromedio: 0,
      margenBruto: null, mejorCliente: null, top10Clientes: [], top10Productos: [] }, { status: 200 });
  }
}
