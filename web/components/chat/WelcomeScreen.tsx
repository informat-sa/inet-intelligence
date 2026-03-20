"use client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, TrendingUp, Package, CreditCard, Users, FileText, Truck,
  BookOpen, ShoppingCart, Building, Ship,
  Landmark, Receipt, FileSearch, ShoppingBag,
  Boxes, Settings, Wallet, Wheat, Headphones,
  ChevronRight, X,
} from "lucide-react";
import { ERP_MODULES, cn } from "@/lib/utils";
import { useChatStore } from "@/store/chat";

const ICON_MAP: Record<string, React.ElementType> = {
  TrendingUp, Package, CreditCard, Users, FileText, Truck,
  BookOpen, ShoppingCart, Building, Ship,
  Landmark, Receipt, FileSearch, ShoppingBag,
  Boxes, Settings, Wallet, Wheat, Headphones,
};

interface Props { onQuestion: (q: string) => void }

// ── State A: módulo activo → vista enfocada ───────────────────────────────────
function ModuleFocusView({
  prefix,
  onQuestion,
  onClear,
}: {
  prefix: string;
  onQuestion: (q: string) => void;
  onClear: () => void;
}) {
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
      {/* Hero del módulo */}
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
          <div
            className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase
                        tracking-widest px-3 py-1 rounded-full mb-3"
            style={{ backgroundColor: `${mod.color}15`, color: mod.color }}
          >
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: mod.color }} />
            Módulo activo
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-2">
            {mod.name}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm mx-auto">
            {mod.description}. Hazme una pregunta y consulto el ERP directamente.
          </p>
        </motion.div>
      </div>

      {/* Preguntas sugeridas */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="w-full space-y-2.5 mb-8"
      >
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
                       hover:border-brand-blue/40 hover:shadow-md
                       transition-all duration-200 cursor-pointer"
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0
                         opacity-70 group-hover:opacity-100 transition-opacity"
              style={{ backgroundColor: `${mod.color}15` }}
            >
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

      {/* Cambiar módulo */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
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

// ── State B: sin módulo → selector de módulos ─────────────────────────────────
function ModulePickerView({
  onSelectModule,
}: {
  onSelectModule: (prefix: string) => void;
}) {
  const user = useChatStore((s) => s.user);
  const allowedPrefixes = user?.modules ?? [];
  const visibleModules = allowedPrefixes.length > 0
    ? ERP_MODULES.filter((m) => allowedPrefixes.includes(m.prefix))
    : ERP_MODULES;

  const totalTables = visibleModules.reduce((sum, m) => sum + m.tableCount, 0);
  const totalAttrs  = visibleModules.reduce((sum, m) => sum + m.attributeCount, 0);

  return (
    <motion.div
      key="module-picker"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center px-4 pt-10 pb-12 max-w-3xl mx-auto w-full"
    >
      {/* Saludo */}
      <div className="text-center mb-8">
        <div className="w-14 h-14 bg-gradient-to-br from-brand-blue to-brand-navy rounded-2xl
                        flex items-center justify-center mx-auto mb-4 shadow-glow">
          <Sparkles className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          Hola{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs">
          Elige un módulo para enfocarte en él, o escribe tu consulta directamente.
        </p>
      </div>

      {/* Grid de módulos — click SELECCIONA como contexto activo */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full mb-8">
        {visibleModules.map((mod, i) => {
          const Icon = ICON_MAP[mod.icon] ?? Sparkles;
          return (
            <motion.button
              key={mod.prefix}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + i * 0.04 }}
              onClick={() => onSelectModule(mod.prefix)}
              className="group text-left p-4 bg-white dark:bg-slate-900 rounded-2xl
                         border border-slate-100 dark:border-slate-800
                         hover:border-brand-blue/40 hover:shadow-md hover:-translate-y-0.5
                         transition-all duration-200 cursor-pointer"
            >
              <div className="flex items-center justify-between mb-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${mod.color}15` }}
                >
                  <Icon className="w-4 h-4" style={{ color: mod.color }} />
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 opacity-0 group-hover:opacity-100
                                         group-hover:translate-x-0.5 transition-all" />
              </div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100 mb-1">
                {mod.name}
              </p>
              <p className="text-[10px] text-slate-400 leading-relaxed truncate">
                {mod.description}
              </p>
            </motion.button>
          );
        })}
      </div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex items-center gap-8 text-center"
      >
        {[
          { value: visibleModules.length.toString(), label: "módulos activos" },
          { value: totalTables.toLocaleString("es-CL"), label: "tablas disponibles" },
          { value: totalAttrs.toLocaleString("es-CL"), label: "atributos" },
        ].map(({ value, label }) => (
          <div key={label}>
            <div className="text-lg font-bold text-brand-navy dark:text-brand-mid">{value}</div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">{label}</div>
          </div>
        ))}
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
        <ModulePickerView
          key="picker"
          onSelectModule={(prefix) => setActiveModule(prefix)}
        />
      )}
    </AnimatePresence>
  );
}
