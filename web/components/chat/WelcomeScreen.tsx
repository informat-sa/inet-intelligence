"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, TrendingUp, Package, CreditCard, Users, FileText, Truck,
  BookOpen, ShoppingCart, Building, Ship,
  Landmark, Receipt, FileSearch, ShoppingBag,
  Boxes, Settings, Wallet, Wheat, Headphones,
  ChevronRight, ChevronLeft, X, TrendingDown, Minus,
  BarChart2, FileCheck, UserCheck, Trophy, Ticket, Percent,
} from "lucide-react";
import { ERP_MODULES, cn, formatCurrency } from "@/lib/utils";
import { useChatStore } from "@/store/chat";
import { getKpis, type KpiData } from "@/lib/api";

const ICON_MAP: Record<string, React.ElementType> = {
  TrendingUp, Package, CreditCard, Users, FileText, Truck,
  BookOpen, ShoppingCart, Building, Ship,
  Landmark, Receipt, FileSearch, ShoppingBag,
  Boxes, Settings, Wallet, Wheat, Headphones,
};

const MESES = [
  "enero","febrero","marzo","abril","mayo","junio",
  "julio","agosto","septiembre","octubre","noviembre","diciembre",
];

interface Props { onQuestion: (q: string) => void }

// ── Contador animado ──────────────────────────────────────────────────────────
function AnimatedNumber({ value, prefix = "", suffix = "", duration = 1200 }: {
  value: number; prefix?: string; suffix?: string; duration?: number;
}) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef   = useRef<number>(0);

  useEffect(() => {
    if (value === 0) { setDisplay(0); return; }
    startRef.current = null;
    const animate = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed  = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  const formatted = prefix === "$"
    ? formatCurrency(display)
    : display.toLocaleString("es-CL");

  return <span>{prefix === "$" ? formatted : `${prefix}${formatted}${suffix}`}</span>;
}

// ── Sparkline SVG ─────────────────────────────────────────────────────────────
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null;

  const W = 100;
  const H = 32;
  const pad = 2;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  // Map data to SVG coordinates
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (W - pad * 2);
    const y = pad + (1 - (v - min) / range) * (H - pad * 2);
    return [x, y] as [number, number];
  });

  // Build smooth bezier path
  const pathD = pts.reduce((acc, [x, y], i) => {
    if (i === 0) return `M${x},${y}`;
    const [px, py] = pts[i - 1];
    const cpx = (px + x) / 2;
    return `${acc} C${cpx},${py} ${cpx},${y} ${x},${y}`;
  }, "");

  // Area fill path (close below)
  const areaD = `${pathD} L${pts[pts.length - 1][0]},${H} L${pts[0][0]},${H} Z`;

  const gradId = `sg-${color.replace("#", "")}`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height: 32 }}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Area fill */}
      <path d={areaD} fill={`url(#${gradId})`} />
      {/* Line */}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />
      {/* Last point dot */}
      <circle
        cx={pts[pts.length - 1][0]}
        cy={pts[pts.length - 1][1]}
        r="2.5"
        fill={color}
        opacity="0.9"
      />
    </svg>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({
  icon: Icon, label, value, prefix, suffix, variacion, sublabel, color, delay, onClick,
  sparkData,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  variacion?: number | null;
  sublabel?: string;
  color: string;
  delay: number;
  onClick?: () => void;
  sparkData?: number[];
}) {
  const hasVar   = variacion !== null && variacion !== undefined;
  const isUp     = hasVar && variacion! > 0;
  const isDown   = hasVar && variacion! < 0;
  const isFlat   = hasVar && variacion === 0;
  const hasSpark = sparkData && sparkData.length >= 2;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      onClick={onClick}
      className={cn(
        "relative bg-white dark:bg-slate-900 rounded-2xl p-5",
        "border border-slate-100 dark:border-slate-800",
        "shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden",
        onClick && "cursor-pointer hover:-translate-y-0.5"
      )}
    >
      <div className="absolute top-0 left-6 right-6 h-0.5 rounded-full opacity-60"
           style={{ backgroundColor: color }} />

      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
             style={{ backgroundColor: `${color}18` }}>
          <Icon className="w-4.5 h-4.5" style={{ color }} />
        </div>

        {hasVar && (
          <div className={cn(
            "flex items-center gap-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-full",
            isUp   && "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
            isDown && "bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400",
            isFlat && "bg-slate-100 dark:bg-slate-800 text-slate-400",
          )}>
            {isUp   && <TrendingUp   className="w-3 h-3" />}
            {isDown && <TrendingDown className="w-3 h-3" />}
            {isFlat && <Minus        className="w-3 h-3" />}
            {isUp ? "+" : ""}{variacion}%
          </div>
        )}
      </div>

      <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className="text-2xl font-extrabold text-slate-900 dark:text-white leading-tight">
        <AnimatedNumber value={value} prefix={prefix} suffix={suffix} />
      </div>
      {sublabel && (
        <div className="text-[11px] text-slate-400 mt-1 truncate">{sublabel}</div>
      )}

      {/* Sparkline — shown when trend data is available */}
      {hasSpark && (
        <div className="mt-3 -mx-1">
          <Sparkline data={sparkData!} color={color} />
        </div>
      )}
    </motion.div>
  );
}

// ── Skeleton KPI ──────────────────────────────────────────────────────────────
function KpiSkeleton() {
  return (
    <div className="w-full space-y-4 mb-6">
      {/* Selector skeleton */}
      <div className="h-9 w-48 mx-auto bg-slate-100 dark:bg-slate-800 rounded-full animate-pulse" />
      {/* Cards skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 w-full">
        {[0,1,2,3].map((i) => (
          <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl p-5
                                  border border-slate-100 dark:border-slate-800 animate-pulse">
            <div className="w-9 h-9 bg-slate-100 dark:bg-slate-800 rounded-xl mb-3" />
            <div className="h-3 w-20 bg-slate-100 dark:bg-slate-800 rounded mb-2" />
            <div className="h-7 w-28 bg-slate-100 dark:bg-slate-800 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Selector de Mes/Año ───────────────────────────────────────────────────────
function MonthSelector({
  year, month, onChange,
}: {
  year: number; month: number; onChange: (y: number, m: number) => void;
}) {
  const now     = new Date();
  const isActual = year === now.getFullYear() && month === (now.getMonth() + 1);

  const prev = () => {
    if (month === 1) onChange(year - 1, 12);
    else onChange(year, month - 1);
  };
  const next = () => {
    // No permitir ir más allá del mes actual
    if (isActual) return;
    if (month === 12) onChange(year + 1, 1);
    else onChange(year, month + 1);
  };

  return (
    <div className="flex items-center justify-center gap-2 mb-5">
      <button
        onClick={prev}
        className="w-8 h-8 flex items-center justify-center rounded-full
                   bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700
                   hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
      >
        <ChevronLeft className="w-4 h-4 text-slate-500" />
      </button>

      <div className="flex items-center gap-2 px-4 py-1.5 rounded-full
                      bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700
                      shadow-sm min-w-[160px] justify-center">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 capitalize">
          {MESES[month - 1]} {year}
        </span>
        {isActual && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full
                           bg-brand-blue/10 text-brand-blue">
            Actual
          </span>
        )}
      </div>

      <button
        onClick={next}
        disabled={isActual}
        className={cn(
          "w-8 h-8 flex items-center justify-center rounded-full",
          "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700",
          "transition-colors shadow-sm",
          isActual
            ? "opacity-30 cursor-not-allowed"
            : "hover:bg-slate-50 dark:hover:bg-slate-700"
        )}
      >
        <ChevronRight className="w-4 h-4 text-slate-500" />
      </button>
    </div>
  );
}

// ── Tabla Top 10 ─────────────────────────────────────────────────────────────
function Top10Table({
  title, icon: Icon, color, rows, onQuestion, delay,
}: {
  title: string;
  icon: React.ElementType;
  color: string;
  rows: { nombre: string; monto: number }[];
  onQuestion: (q: string) => void;
  delay: number;
}) {
  if (!rows || rows.length === 0) return null;
  const max = rows[0]?.monto ?? 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100
                 dark:border-slate-800 shadow-sm overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b
                      border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
               style={{ backgroundColor: `${color}18` }}>
            <Icon className="w-4 h-4" style={{ color }} />
          </div>
          <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</span>
        </div>
        <button
          onClick={() => onQuestion(`Dame el detalle del ${title.toLowerCase()}`)}
          className="text-[11px] text-brand-blue hover:underline font-medium"
        >
          Ver detalle →
        </button>
      </div>

      {/* Rows */}
      <div className="divide-y divide-slate-50 dark:divide-slate-800">
        {rows.map((r, i) => {
          const pct = max > 0 ? (r.monto / max) * 100 : 0;
          return (
            <div
              key={i}
              className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50
                         dark:hover:bg-slate-800/50 transition-colors"
            >
              {/* Rank */}
              <span className={cn(
                "text-[11px] font-bold w-5 text-center flex-shrink-0",
                i === 0 && "text-amber-500",
                i === 1 && "text-slate-400",
                i === 2 && "text-orange-400",
                i > 2    && "text-slate-300 dark:text-slate-600",
              )}>
                {i + 1}
              </span>

              {/* Nombre + barra */}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate mb-1">
                  {r.nombre || "—"}
                </div>
                <div className="h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ delay: delay + 0.1 + i * 0.04, duration: 0.5, ease: "easeOut" }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: color }}
                  />
                </div>
              </div>

              {/* Monto */}
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex-shrink-0 text-right">
                {formatCurrency(r.monto)}
              </span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ── Vista con módulo activo ───────────────────────────────────────────────────
function ModuleFocusView({
  prefix, onQuestion, onClear,
}: { prefix: string; onQuestion: (q: string) => void; onClear: () => void }) {
  const mod = ERP_MODULES.find((m) => m.prefix === prefix);
  if (!mod) return null;
  const Icon = ICON_MAP[mod.icon] ?? Sparkles;

  return (
    <motion.div
      key="module-focus"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center px-4 pt-12 pb-10 max-w-2xl mx-auto w-full"
    >
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.05, type: "spring", stiffness: 280 }}
          className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-lg"
          style={{ backgroundColor: `${mod.color}18`, border: `2px solid ${mod.color}30` }}
        >
          <Icon className="w-10 h-10" style={{ color: mod.color }} />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase
                          tracking-widest px-3 py-1 rounded-full mb-3"
               style={{ backgroundColor: `${mod.color}15`, color: mod.color }}>
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: mod.color }} />
            Módulo activo
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-2">{mod.name}</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm mx-auto">
            {mod.description}. Hazme una pregunta y consulto tu INET directamente.
          </p>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                  className="w-full space-y-2.5 mb-8">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3 text-center">
          Consultas frecuentes de este módulo
        </p>
        {mod.exampleQuestions.map((q, i) => (
          <motion.button
            key={q}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.18 + i * 0.07 }}
            onClick={() => onQuestion(q)}
            className="w-full text-left group flex items-center gap-3 px-5 py-4 rounded-2xl
                       bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700
                       hover:border-brand-blue/40 hover:shadow-md transition-all duration-200 cursor-pointer"
          >
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 opacity-70
                            group-hover:opacity-100 transition-opacity"
                 style={{ backgroundColor: `${mod.color}15` }}>
              <Sparkles className="w-3.5 h-3.5" style={{ color: mod.color }} />
            </div>
            <span className="flex-1 text-sm text-slate-700 dark:text-slate-200 font-medium">
              &ldquo;{q}&rdquo;
            </span>
            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-brand-blue
                                     group-hover:translate-x-0.5 transition-all flex-shrink-0" />
          </motion.button>
        ))}
      </motion.div>

      <motion.button
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
        onClick={onClear}
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600
                   dark:hover:text-slate-300 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
        Ver todos los módulos
      </motion.button>
    </motion.div>
  );
}

// ── Vista principal — KPIs + módulos ─────────────────────────────────────────
function DashboardView({ onSelectModule, onQuestion }: {
  onSelectModule: (prefix: string) => void;
  onQuestion: (q: string) => void;
}) {
  const user            = useChatStore((s) => s.user);
  const allowedPrefixes = user?.modules ?? [];
  const visibleModules  = allowedPrefixes.length > 0
    ? ERP_MODULES.filter((m) => allowedPrefixes.includes(m.prefix))
    : ERP_MODULES;

  // Período seleccionado — por defecto mes actual
  const today = new Date();
  const [selYear,  setSelYear]  = useState(today.getFullYear());
  const [selMonth, setSelMonth] = useState(today.getMonth() + 1);

  const [kpis, setKpis]       = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadKpis = (y: number, m: number) => {
    setLoading(true);
    setKpis(null);
    getKpis(y, m)
      .then(setKpis)
      .catch(() => setKpis(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadKpis(selYear, selMonth); }, []);

  const handlePeriodoChange = (y: number, m: number) => {
    setSelYear(y);
    setSelMonth(m);
    loadKpis(y, m);
  };

  const firstName = user?.name?.split(" ")[0] ?? "";

  const quickQuestions = [
    "¿Cuáles son las ventas de este mes?",
    "¿Cuánto me deben los clientes?",
    "¿Qué productos tienen bajo stock?",
  ];

  const hasKpis = !loading && kpis && !kpis.demo;

  return (
    <motion.div
      key="dashboard"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center px-4 pt-8 pb-12 max-w-4xl mx-auto w-full"
    >
      {/* Saludo */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-6 w-full"
      >
        <div className="w-12 h-12 bg-gradient-to-br from-brand-blue to-brand-navy rounded-2xl
                        flex items-center justify-center mx-auto mb-3 shadow-glow">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {firstName ? `Hola, ${firstName}` : "Buenos días"}
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          {hasKpis
            ? `Aquí está el resumen de ${kpis!.periodo}`
            : "¿En qué te puedo ayudar hoy?"}
        </p>
      </motion.div>

      {/* ── KPIs ── */}
      {loading ? (
        <KpiSkeleton />
      ) : hasKpis ? (
        <div className="w-full mb-6">
          {/* Selector mes/año */}
          <MonthSelector
            year={selYear}
            month={selMonth}
            onChange={handlePeriodoChange}
          />

          {/* Extraer series de tendencia para sparklines */}
          {(() => {
            const trend = kpis!.trend ?? [];
            const sparkVentas    = trend.map((t) => t.ventas);
            const sparkDocs      = trend.map((t) => t.documentos);
            const sparkClientes  = trend.map((t) => t.clientes);
            const sparkTicket    = trend.map((t) =>
              t.documentos > 0 ? Math.round(t.ventas / t.documentos) : 0
            );

            return (
              <>
          {/* Fila 1: 4 KPIs principales */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            <KpiCard
              icon={BarChart2}
              label="Ventas del mes"
              value={kpis!.ventasMes}
              prefix="$"
              variacion={kpis!.variacionPct}
              sublabel={`vs ${kpis!.ventasMesAnterior > 0 ? formatCurrency(kpis!.ventasMesAnterior) : "mes anterior"}`}
              color="#2E75B6"
              delay={0.05}
              sparkData={sparkVentas}
              onClick={() => onQuestion(`¿Cuáles son las ventas netas de ${kpis!.periodo}?`)}
            />
            <KpiCard
              icon={FileCheck}
              label="Documentos"
              value={kpis!.documentos}
              sublabel={`emitidos en ${kpis!.periodo}`}
              color="#8B5CF6"
              delay={0.1}
              sparkData={sparkDocs}
              onClick={() => onQuestion(`¿Cuántos documentos se emitieron en ${kpis!.periodo}?`)}
            />
            <KpiCard
              icon={UserCheck}
              label="Clientes activos"
              value={kpis!.clientesActivos}
              sublabel={`compraron en ${kpis!.periodo}`}
              color="#10B981"
              delay={0.15}
              sparkData={sparkClientes}
              onClick={() => onQuestion(`¿Quiénes son los clientes activos de ${kpis!.periodo}?`)}
            />
            <KpiCard
              icon={Trophy}
              label="Mejor cliente"
              value={kpis!.mejorCliente?.monto ?? 0}
              prefix="$"
              sublabel={kpis!.mejorCliente?.nombre ?? "—"}
              color="#F59E0B"
              delay={0.2}
              onClick={() => onQuestion(`¿Cuáles son los top 10 clientes de ${kpis!.periodo}?`)}
            />
          </div>

          {/* Fila 2: Ticket promedio + Margen bruto */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <KpiCard
              icon={Ticket}
              label="Ticket promedio"
              value={kpis!.ticketPromedio}
              prefix="$"
              sublabel="por documento emitido"
              color="#06B6D4"
              delay={0.25}
              sparkData={sparkTicket}
              onClick={() => onQuestion(`¿Cuál es el ticket promedio de ${kpis!.periodo}?`)}
            />
            {kpis!.margenBruto !== null ? (
              <KpiCard
                icon={Percent}
                label="Margen bruto"
                value={kpis!.margenBruto}
                suffix="%"
                sublabel="(ventas − costo venta)"
                color="#F43F5E"
                delay={0.3}
                onClick={() => onQuestion(`¿Cuál es el margen bruto de ${kpis!.periodo}?`)}
              />
            ) : (
              /* Sin datos de costo — placeholder */
              <div className="relative bg-white dark:bg-slate-900 rounded-2xl p-5
                              border border-dashed border-slate-200 dark:border-slate-700
                              flex items-center justify-center">
                <span className="text-xs text-slate-300 dark:text-slate-600">
                  Sin datos de costo
                </span>
              </div>
            )}
          </div>

          {/* ── Top 10 Clientes + Productos ── */}
          {(kpis!.top10Clientes.length > 0 || kpis!.top10Productos.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {kpis!.top10Clientes.length > 0 && (
                <Top10Table
                  title="Top 10 Clientes"
                  icon={Users}
                  color="#2E75B6"
                  rows={kpis!.top10Clientes}
                  onQuestion={onQuestion}
                  delay={0.35}
                />
              )}
              {kpis!.top10Productos.length > 0 && (
                <Top10Table
                  title="Top 10 Productos"
                  icon={Package}
                  color="#8B5CF6"
                  rows={kpis!.top10Productos}
                  onQuestion={onQuestion}
                  delay={0.4}
                />
              )}
            </div>
          )}
              </>
            );
          })()}
        </div>
      ) : (
        /* Sin datos */
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="w-full flex flex-wrap gap-2 justify-center mb-8"
        >
          {quickQuestions.map((q, i) => (
            <motion.button
              key={q}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 + i * 0.06 }}
              onClick={() => onQuestion(q)}
              className="flex items-center gap-2 text-sm bg-white dark:bg-slate-900
                         border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-full
                         hover:border-brand-blue/40 hover:shadow-sm transition-all duration-200"
            >
              <Sparkles className="w-3.5 h-3.5 text-brand-blue" />
              {q}
            </motion.button>
          ))}
        </motion.div>
      )}

      {/* ── Grid de módulos ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="w-full"
      >
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Explorar por módulo
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
          {visibleModules.map((mod, i) => {
            const Icon = ICON_MAP[mod.icon] ?? Sparkles;
            return (
              <motion.button
                key={mod.prefix}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.48 + i * 0.03 }}
                onClick={() => onSelectModule(mod.prefix)}
                className="group text-left p-3.5 bg-white dark:bg-slate-900 rounded-xl
                           border border-slate-100 dark:border-slate-800
                           hover:border-brand-blue/40 hover:shadow-md hover:-translate-y-0.5
                           transition-all duration-200 cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                       style={{ backgroundColor: `${mod.color}15` }}>
                    <Icon className="w-4 h-4" style={{ color: mod.color }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                      {mod.name}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate leading-tight mt-0.5">
                      {mod.description}
                    </p>
                  </div>
                  <ChevronRight className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100
                                           group-hover:translate-x-0.5 transition-all ml-auto flex-shrink-0" />
                </div>
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────
export function WelcomeScreen({ onQuestion }: Props) {
  const { activeModule, setActiveModule } = useChatStore();

  return (
    <AnimatePresence mode="wait">
      {activeModule ? (
        <ModuleFocusView
          key={activeModule}
          prefix={activeModule}
          onQuestion={onQuestion}
          onClear={() => setActiveModule(null)}
        />
      ) : (
        <DashboardView
          key="dashboard"
          onSelectModule={(prefix) => setActiveModule(prefix)}
          onQuestion={onQuestion}
        />
      )}
    </AnimatePresence>
  );
}
