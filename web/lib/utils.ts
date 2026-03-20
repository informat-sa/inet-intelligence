import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ERP_Module } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number, decimals = 0): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-CL").format(value);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit", month: "2-digit", year: "numeric",
  }).format(new Date(date));
}

export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins}m`;
  if (hours < 24) return `hace ${hours}h`;
  if (days < 7) return `hace ${days}d`;
  return formatDate(date);
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 11);
}

export function detectCurrency(value: string): boolean {
  return /precio|monto|total|valor|costo|saldo|deuda|factura|importe/i.test(value);
}

export const ERP_MODULES: ERP_Module[] = [
  {
    prefix: "VFA", name: "Ventas", description: "Facturación, órdenes y clientes",
    icon: "TrendingUp", color: "#0EA5E9", tableCount: 55, attributeCount: 336,
    exampleQuestions: [
      "¿Cuánto vendí este mes comparado con el año pasado?",
      "¿Cuáles son mis 10 clientes con más ventas?",
      "¿Qué productos tuvieron mayor crecimiento este trimestre?",
    ],
  },
  {
    prefix: "CCC", name: "Cobranzas", description: "Cuentas por cobrar y cartera",
    icon: "CreditCard", color: "#F59E0B", tableCount: 21, attributeCount: 223,
    exampleQuestions: [
      "¿Qué facturas llevan más de 90 días sin pago?",
      "¿Cuál es mi cartera vencida total hoy?",
      "¿Cuáles son mis 5 clientes con mayor deuda?",
    ],
  },
  {
    prefix: "EXI", name: "Inventario", description: "Stock, bodegas y movimientos",
    icon: "Package", color: "#8B5CF6", tableCount: 69, attributeCount: 486,
    exampleQuestions: [
      "¿Qué productos están bajo el stock mínimo?",
      "¿Cuáles son los artículos sin movimiento en 6 meses?",
      "¿Cuántas unidades de harina tengo en bodega Pudahuel?",
    ],
  },
  {
    prefix: "ADQ", name: "Compras", description: "Adquisiciones y proveedores",
    icon: "ShoppingCart", color: "#10B981", tableCount: 33, attributeCount: 859,
    exampleQuestions: [
      "¿Cuánto compré a cada proveedor este año?",
      "¿Qué órdenes de compra están pendientes de recepción?",
      "¿Cuál es mi proveedor más caro de materias primas?",
    ],
  },
  {
    prefix: "IMP", name: "Importaciones", description: "Internación y costeo aduanero",
    icon: "Ship", color: "#06B6D4", tableCount: 84, attributeCount: 1158,
    exampleQuestions: [
      "¿Qué carpetas de importación están abiertas?",
      "¿Cuánto costó la internación del último embarque?",
      "¿Cuáles son los productos con mayor gasto en derechos aduaneros?",
    ],
  },
  {
    prefix: "REM", name: "Remuneraciones", description: "Sueldos, AFP e ISAPRE",
    icon: "Users", color: "#EC4899", tableCount: 61, attributeCount: 466,
    exampleQuestions: [
      "¿Cuántos trabajadores hay en cada sucursal?",
      "¿Cuál fue el costo total de remuneraciones este mes?",
      "¿Qué departamento tiene mayor gasto en horas extra?",
    ],
  },
  {
    prefix: "CON", name: "Contabilidad", description: "Mayor, balances y cierres",
    icon: "BookOpen", color: "#6366F1", tableCount: 47, attributeCount: 435,
    exampleQuestions: [
      "¿Cuál es el resultado del ejercicio a la fecha?",
      "¿Cómo está mi flujo de caja proyectado este mes?",
      "¿Cuáles son las cuentas con mayor movimiento este período?",
    ],
  },
  {
    prefix: "AFF", name: "Activo Fijo", description: "Bienes, deprecación y bajas",
    icon: "Building", color: "#D97706", tableCount: 50, attributeCount: 851,
    exampleQuestions: [
      "¿Cuáles son los activos con mayor depreciación acumulada?",
      "¿Qué bienes se incorporaron este año?",
      "¿Cuánto vale el activo fijo neto total?",
    ],
  },
  {
    prefix: "SII", name: "SII / DTE", description: "Documentos tributarios electrónicos",
    icon: "FileText", color: "#EF4444", tableCount: 31, attributeCount: 190,
    exampleQuestions: [
      "¿Cuántas facturas electrónicas emití hoy?",
      "¿Qué documentos tienen rechazo del SII?",
      "¿Cuál es el IVA débito del mes?",
    ],
  },
  {
    prefix: "DDI", name: "Despacho", description: "Guías, rutas y distribución",
    icon: "Truck", color: "#14B8A6", tableCount: 29, attributeCount: 291,
    exampleQuestions: [
      "¿Qué despachos están pendientes de hoy?",
      "¿Cuántas guías emití esta semana?",
      "¿Cuál es la ruta con más entregas?",
    ],
  },
  {
    prefix: "BAN", name: "Bancos", description: "Cuentas bancarias y movimientos",
    icon: "Landmark", color: "#0369A1", tableCount: 4, attributeCount: 28,
    exampleQuestions: [
      "¿Cuál es el saldo de mis cuentas bancarias hoy?",
      "¿Qué cheques están pendientes de cobro?",
      "¿Cuántos depósitos recibí esta semana?",
    ],
  },
  {
    prefix: "EGR", name: "Egresos", description: "Pagos a proveedores y egresos",
    icon: "Receipt", color: "#DC2626", tableCount: 11, attributeCount: 67,
    exampleQuestions: [
      "¿Cuánto pagué a proveedores este mes?",
      "¿Qué egresos están pendientes de autorización?",
      "¿Cuál fue el total de gastos por forma de pago?",
    ],
  },
  {
    prefix: "COT", name: "Cotizaciones", description: "Cotizaciones de proveedores",
    icon: "FileSearch", color: "#7C3AED", tableCount: 1, attributeCount: 1,
    exampleQuestions: [
      "¿Qué cotizaciones de proveedores están vigentes?",
      "¿Cuál es la cotización más barata para este artículo?",
      "¿Cuántas cotizaciones recibí este mes?",
    ],
  },
  {
    prefix: "PED", name: "Pedidos", description: "Pedidos y órdenes de clientes",
    icon: "ShoppingBag", color: "#059669", tableCount: 3, attributeCount: 64,
    exampleQuestions: [
      "¿Qué pedidos están pendientes de entrega?",
      "¿Cuántos pedidos no atendidos tengo hoy?",
      "¿Qué cliente tiene más pedidos pendientes?",
    ],
  },
  {
    prefix: "PRO", name: "Producción", description: "Órdenes de producción, fórmulas y maestro de artículos",
    icon: "Boxes", color: "#0891B2", tableCount: 55, attributeCount: 641,
    exampleQuestions: [
      "¿Qué órdenes de producción están abiertas hoy?",
      "¿Cuánto costó la producción este mes?",
      "¿Cuáles son los productos más fabricados en el trimestre?",
    ],
  },
  {
    prefix: "FIN", name: "Finanzas", description: "Líneas de crédito, condiciones financieras y pago",
    icon: "Wallet", color: "#047857", tableCount: 9, attributeCount: 199,
    exampleQuestions: [
      "¿Cuáles son las líneas de crédito disponibles?",
      "¿Qué créditos otorgados están vigentes?",
      "¿Cuáles son las condiciones de pago activas?",
    ],
  },
  {
    prefix: "ATE", name: "Atención Clientes", description: "Atención, ofertas y servicio al cliente",
    icon: "Headphones", color: "#DB2777", tableCount: 19, attributeCount: 346,
    exampleQuestions: [
      "¿Qué clientes tienen atenciones pendientes?",
      "¿Cuáles son los productos en oferta hoy?",
      "¿Cuántas atenciones registré esta semana?",
    ],
  },
  {
    prefix: "PAR", name: "Parámetros", description: "Configuración y tablas maestras del sistema",
    icon: "Settings", color: "#64748B", tableCount: 45, attributeCount: 162,
    exampleQuestions: [
      "¿Cuáles son las sucursales configuradas en el sistema?",
      "¿Qué monedas tiene habilitadas el sistema?",
      "¿Cuáles son los parámetros de aprobación de documentos?",
    ],
  },
  {
    prefix: "GAN", name: "Granos (Molinero)", description: "Módulo vertical para industria molinera y granos",
    icon: "Wheat", color: "#92400E", tableCount: 14, attributeCount: 1,
    exampleQuestions: [
      "¿Cuáles son los lotes de materia prima disponibles?",
      "¿Qué auditorías de producción están registradas?",
      "¿Cuántos procesos de molienda hay activos?",
    ],
  },
];
