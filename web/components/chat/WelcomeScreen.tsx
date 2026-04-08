"use client";
import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Sparkles, ArrowRight, Clock, TrendingUp, Package,
  CreditCard, Users, FileText, Truck, BookOpen,
  ShoppingCart, Building, Ship, Landmark, Receipt,
  FileSearch, ShoppingBag, Boxes, Settings, Wallet,
  Wheat, Headphones, MessageSquare,
} from "lucide-react";
import { useChatStore } from "@/store/chat";
import { ERP_MODULES } from "@/lib/utils";

const ICON_MAP: Record<string, React.ElementType> = {
  TrendingUp, Package, CreditCard, Users, FileText, Truck,
  BookOpen, ShoppingCart, Building, Ship, Landmark, Receipt,
  FileSearch, ShoppingBag, Boxes, Settings, Wallet, Wheat, Headphones,
};

interface Props { onQuestion: (q: string) => void }

// ── Preguntas sugeridas por módulo ────────────────────────────────────────────
const SUGGESTED: Record<string, { label: string; q: string }[]> = {
  VFA: [
    { label: "Ventas del mes",        q: "¿Cuáles son las ventas netas de este mes comparadas con el mes anterior?" },
    { label: "Top 10 clientes",       q: "¿Cuáles son los 10 clientes con mayor facturación este mes?" },
    { label: "Documentos pendientes", q: "¿Qué facturas están pendientes de pago esta semana?" },
  ],
  CCC: [
    { label: "Deuda vencida",         q: "¿Cuánto me deben los clientes con deuda vencida hoy?" },
    { label: "Morosidad crítica",     q: "¿Qué clientes llevan más de 60 días sin pagar?" },
  ],
  REM: [
    { label: "Empleados activos",     q: "¿Cuántos empleados están activos este mes?" },
    { label: "Costo de nómina",       q: "¿Cuál es el total de haberes del último período de liquidaciones?" },
    { label: "Ausentismo",            q: "¿Cuántos días de descuento por inasistencia hubo este mes?" },
  ],
  CON: [
    { label: "Resultado del período", q: "¿Cuál es el resultado financiero del período actual?" },
    { label: "Cuentas por cuadrar",   q: "¿Qué comprobantes contables están pendientes de procesar?" },
  ],
  EXI: [
    { label: "Stock crítico",         q: "¿Qué productos tienen stock por debajo del mínimo?" },
    { label: "Valorización bodega",   q: "¿Cuál es el valor total del inventario en bodega central?" },
  ],
  ADQ: [
    { label: "OC pendientes",         q: "¿Qué órdenes de compra están pendientes de recibir?" },
    { label: "Gastos del mes",        q: "¿Cuánto se ha gastado en compras este mes por proveedor?" },
  ],
  BAN: [
    { label: "Saldo bancario",        q: "¿Cuál es el saldo actual de cada cuenta bancaria?" },
    { label: "Cheques emitidos",      q: "¿Qué cheques están emitidos y pendientes de cobro?" },
  ],
  AFF: [
    { label: "Depreciación",          q: "¿Cuánto se ha depreciado en activos fijos este año?" },
    { label: "Bienes por categoría",  q: "¿Cuál es el valor bruto de activos fijos por categoría?" },
  ],
  SII: [
    { label: "IVA del período",       q: "¿Cuál es el IVA débito y crédito del mes actual?" },
    { label: "Libro de ventas",       q: "¿Cuántos DTE se emitieron este mes por tipo de documento?" },
  ],
  IMP: [
    { label: "Carpetas activas",      q: "¿Qué carpetas de importación están en proceso?" },
    { label: "Costos internación",    q: "¿Cuál es el costo total de internación del último trimestre?" },
  ],
};

const FALLBACK = [
  { label: "¿Qué puedo consultar?",  q: "¿Qué tipo de consultas puedo hacer sobre mi empresa?" },
  { label: "Ventas del mes",         q: "¿Cuáles son las ventas de este mes?" },
  { label: "Clientes con deuda",     q: "¿Cuánto me deben los clientes?" },
  { label: "Estado del inventario",  q: "¿Qué productos tienen bajo stock?" },
];

function getHour(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

// ── Componente principal ──────────────────────────────────────────────────────
export function WelcomeScreen({ onQuestion }: Props) {
  const user          = useChatStore((s) => s.user);
  const conversations = useChatStore((s) => s.conversations);

  const firstName = user?.name?.split(" ")[0] ?? "";
  const modules   = user?.modules ?? [];

  // Preguntas sugeridas según módulos del usuario (máx. 5)
  const suggestions = useMemo(() => {
    const picks: { label: string; q: string; color: string; icon: React.ElementType }[] = [];
    for (const prefix of modules) {
      const mod   = ERP_MODULES.find((m) => m.prefix === prefix);
      const items = SUGGESTED[prefix];
      if (mod && items) {
        const Icon = ICON_MAP[mod.icon] ?? Sparkles;
        for (const item of items) {
          picks.push({ ...item, color: mod.color, icon: Icon });
          if (picks.length >= 5) break;
        }
      }
      if (picks.length >= 5) break;
    }
    if (picks.length === 0) {
      return FALLBACK.map((f) => ({ ...f, color: "#2E75B6", icon: Sparkles }));
    }
    return picks;
  }, [modules]);

  // Últimas 3 conversaciones
  const recent = useMemo(
    () => conversations.filter((c) => c.title && c.title !== "Nueva consulta").slice(0, 3),
    [conversations]
  );

  return (
    <div className="flex flex-col items-center justify-start px-4 pt-14 pb-12 max-w-2xl mx-auto w-full">

      {/* ── Saludo ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="text-center mb-10 w-full"
      >
        {/* Avatar */}
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg"
          style={{ backgroundColor: "#0F1E35" }}
        >
          <Sparkles className="w-6 h-6 text-white" />
        </div>

        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          {getHour()}{firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="text-slate-400 text-sm mt-2 max-w-sm mx-auto leading-relaxed">
          Pregúntame cualquier cosa sobre tu empresa.<br />
          Consulto tu INET en tiempo real.
        </p>
      </motion.div>

      {/* ── Preguntas sugeridas ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full mb-8"
      >
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3 pl-1">
          Consultas frecuentes
        </p>
        <div className="space-y-2">
          {suggestions.map(({ label, q, color, icon: Icon }, i) => (
            <motion.button
              key={q}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.12 + i * 0.06, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => onQuestion(q)}
              className="w-full group flex items-center gap-3.5 px-4 py-3.5
                         bg-white dark:bg-slate-900
                         border border-slate-100 dark:border-slate-800
                         hover:border-slate-300 dark:hover:border-slate-600
                         hover:shadow-sm rounded-xl transition-all duration-150 text-left"
            >
              {/* Icono */}
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-opacity"
                style={{ backgroundColor: `${color}15` }}
              >
                <Icon className="w-3.5 h-3.5" style={{ color }} />
              </div>

              {/* Texto */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200 truncate">
                  {label}
                </p>
                <p className="text-[11px] text-slate-400 truncate mt-0.5 leading-snug">
                  {q}
                </p>
              </div>

              {/* Arrow */}
              <ArrowRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600
                                     group-hover:text-slate-500 group-hover:translate-x-0.5
                                     transition-all flex-shrink-0" />
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* ── Conversaciones recientes ── */}
      {recent.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.35 }}
          className="w-full"
        >
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3 pl-1">
            Conversaciones recientes
          </p>
          <div className="space-y-1.5">
            {recent.map((conv, i) => (
              <motion.button
                key={conv.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.48 + i * 0.05 }}
                onClick={() => {
                  useChatStore.getState().setActiveConversation(conv.id);
                }}
                className="w-full group flex items-center gap-3 px-4 py-3
                           rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60
                           transition-colors duration-150 text-left"
              >
                <MessageSquare className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600
                                          group-hover:text-slate-400 flex-shrink-0" />
                <span className="flex-1 text-[13px] text-slate-500 dark:text-slate-400
                                 truncate group-hover:text-slate-700 dark:group-hover:text-slate-200
                                 transition-colors">
                  {conv.title}
                </span>
                <Clock className="w-3 h-3 text-slate-200 dark:text-slate-700
                                  group-hover:text-slate-300 flex-shrink-0" />
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
