"use client";
import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Search, ChevronDown, ChevronRight,
  Database, Layers, Hash, Type, Calendar, ToggleLeft,
  Sparkles, TableProperties, MessageSquarePlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ERP_MODULES } from "@/lib/utils";
import { getSchemaModule } from "@/lib/api";
import type { SchemaModuleDetail, SchemaTableDetail } from "@/lib/api";

// ── Type badge helpers ────────────────────────────────────────────────────────
function TypeBadge({ type, length, dec }: { type: string; length: number; dec: number }) {
  const t = (type ?? "").toLowerCase();
  const isNum  = t === "n" || t === "numeric";
  const isStr  = t === "c" || t === "string" || t === "varchar" || t === "vchar";
  const isDate = t === "d" || t === "date" || t === "a" || t === "datetime";
  const isBool = t === "b" || t === "boolean";

  const label = isNum  ? (dec > 0 ? `N${length}.${dec}` : `N${length}`)
              : isStr  ? `C${length}`
              : isDate ? (t === "a" || t === "datetime" ? "DATETIME" : "DATE")
              : isBool ? "BIT"
              : length > 0 ? `C${length}` : "VC";

  const Icon = isNum ? Hash : isDate ? Calendar : isBool ? ToggleLeft : Type;

  const colors = isNum  ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400"
               : isDate ? "bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400"
               : isBool ? "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400"
               : "bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400";

  return (
    <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium", colors)}>
      <Icon className="w-2.5 h-2.5 flex-shrink-0" />
      {label}
    </span>
  );
}

// ── Table card ────────────────────────────────────────────────────────────────
function TableCard({ table, query, defaultOpen }: {
  table: SchemaTableDetail;
  query: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  const filtered = useMemo(() => {
    if (!query) return table.attributes;
    const q = query.toLowerCase();
    return table.attributes.filter(
      (a) => a.name.toLowerCase().includes(q) || (a.title ?? "").toLowerCase().includes(q)
    );
  }, [table.attributes, query]);

  const matchesHeader = !query
    || table.name.toLowerCase().includes(query.toLowerCase())
    || table.description.toLowerCase().includes(query.toLowerCase());

  if (!matchesHeader && filtered.length === 0) return null;

  return (
    <motion.div
      layout
      className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden
                 bg-white dark:bg-slate-900/60 shadow-sm"
    >
      {/* Header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left
                   hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <div className="w-8 h-8 bg-brand-blue/10 rounded-lg flex items-center justify-center flex-shrink-0">
          <TableProperties className="w-4 h-4 text-brand-blue" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 font-mono">
            {table.name}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
            {table.description}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
            {table.attributeCount} col.
          </span>
          {open
            ? <ChevronDown className="w-4 h-4 text-slate-400" />
            : <ChevronRight className="w-4 h-4 text-slate-400" />
          }
        </div>
      </button>

      {/* Columns grid */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
          >
            <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-3">
              {filtered.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Sin coincidencias</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                  {filtered.map((attr) => (
                    <div
                      key={attr.name}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg
                                 bg-slate-50 dark:bg-slate-800/50"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono font-medium text-slate-700 dark:text-slate-200 truncate">
                          {attr.name.includes(".") ? attr.name.split(".").pop() : attr.name}
                        </p>
                        {attr.title && (
                          <p className="text-[10px] text-slate-400 truncate">{attr.title}</p>
                        )}
                      </div>
                      <TypeBadge type={attr.type} length={attr.length} dec={attr.dec} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ModuleDetailPage() {
  const { prefix } = useParams<{ prefix: string }>();
  const router     = useRouter();

  const [mod,     setMod]     = useState<SchemaModuleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [search,  setSearch]  = useState("");

  // Static metadata for icon + color
  const meta = ERP_MODULES.find((m) => m.prefix === prefix?.toUpperCase());

  useEffect(() => {
    if (!prefix) return;
    setLoading(true);
    getSchemaModule(prefix.toUpperCase())
      .then(setMod)
      .catch(() => setError("No se pudo cargar la información del módulo."))
      .finally(() => setLoading(false));
  }, [prefix]);

  const filteredTables = useMemo(() => {
    if (!mod) return [];
    if (!search) return mod.tables;
    const q = search.toLowerCase();
    return mod.tables.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.attributes.some(
          (a) => a.name.toLowerCase().includes(q) || (a.title ?? "").toLowerCase().includes(q)
        )
    );
  }, [mod, search]);

  function handleAskAboutModule() {
    // Navigate to dashboard pre-seeding the question
    const question = encodeURIComponent(
      `¿Qué información hay en el módulo ${mod?.name ?? prefix}? Dame un resumen de las tablas principales.`
    );
    router.push(`/dashboard?q=${question}`);
  }

  const accentColor = meta?.color ?? "#3B82F6";

  return (
    <div className="min-h-screen bg-surface dark:bg-slate-950">
      {/* ── Header ── */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800
                         px-6 py-4 sticky top-0 z-10 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 text-slate-400 hover:text-brand-blue hover:bg-brand-blue/8
                       rounded-lg transition-all duration-200"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          {/* Module icon */}
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${accentColor}20` }}
          >
            <Database className="w-4 h-4" style={{ color: accentColor }} />
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-slate-900 dark:text-white leading-none truncate">
              {mod?.name ?? meta?.name ?? prefix?.toUpperCase()}
            </h1>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Módulo {prefix?.toUpperCase()} · Explorador de tablas
            </p>
          </div>

          {/* Ask about module button */}
          {mod && (
            <button
              onClick={handleAskAboutModule}
              className="hidden sm:flex items-center gap-2 bg-brand-blue hover:bg-brand-navy
                         text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all
                         shadow-[0_0_16px_rgba(46,117,182,0.3)]"
            >
              <MessageSquarePlus className="w-3.5 h-3.5" />
              Consultar módulo
            </button>
          )}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* ── Module overview card ── */}
        {(mod || meta) && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-6"
          >
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
              {mod?.description ?? meta?.name}
            </p>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-brand-blue/10 rounded-lg flex items-center justify-center">
                  <Layers className="w-4 h-4 text-brand-blue" />
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-900 dark:text-white leading-none">
                    {mod?.tableCount ?? meta?.tableCount ?? "—"}
                  </p>
                  <p className="text-[11px] text-slate-400">tablas</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-violet-500/10 rounded-lg flex items-center justify-center">
                  <Hash className="w-4 h-4 text-violet-600" />
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-900 dark:text-white leading-none">
                    {mod?.attributeCount?.toLocaleString("es-CL") ?? meta?.attributeCount?.toLocaleString("es-CL") ?? "—"}
                  </p>
                  <p className="text-[11px] text-slate-400">atributos</p>
                </div>
              </div>
            </div>

            {/* Mobile ask button */}
            {mod && (
              <button
                onClick={handleAskAboutModule}
                className="sm:hidden mt-4 w-full flex items-center justify-center gap-2
                           bg-brand-blue text-white text-sm font-semibold py-2.5 rounded-xl"
              >
                <MessageSquarePlus className="w-4 h-4" />
                Consultar módulo en el chat
              </button>
            )}
          </motion.div>
        )}

        {/* ── Search ── */}
        {mod && !loading && (
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar tabla o columna..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700
                         rounded-xl pl-10 pr-4 py-3 text-sm text-slate-900 dark:text-white
                         placeholder:text-slate-400 focus:outline-none focus:ring-2
                         focus:ring-brand-blue/40 focus:border-brand-blue transition-all
                         [color-scheme:dark]"
            />
            {search && (
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                {filteredTables.length} tabla{filteredTables.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 bg-slate-100 dark:bg-slate-800/50 rounded-2xl animate-pulse" />
            ))}
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div className="card p-8 text-center">
            <Database className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">{error}</p>
            <p className="text-slate-400 text-xs mt-1">
              Asegúrate de que el servidor API está en ejecución.
            </p>
          </div>
        )}

        {/* ── Tables list ── */}
        {!loading && !error && mod && (
          <div className="space-y-2">
            {filteredTables.length === 0 ? (
              <div className="card p-8 text-center">
                <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">Sin resultados para &ldquo;{search}&rdquo;</p>
              </div>
            ) : (
              filteredTables.map((table, i) => (
                <motion.div
                  key={table.name}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.3) }}
                >
                  <TableCard
                    table={table}
                    query={search}
                    defaultOpen={!!search && filteredTables.length <= 5}
                  />
                </motion.div>
              ))
            )}
          </div>
        )}

        {/* ── CTA footer ── */}
        {!loading && !error && mod && filteredTables.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="card p-5 flex flex-col sm:flex-row items-center gap-4"
          >
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                ¿Listo para consultar este módulo?
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Escribe una pregunta en lenguaje natural y obtén resultados en segundos.
              </p>
            </div>
            <button
              onClick={handleAskAboutModule}
              className="flex items-center gap-2 bg-brand-blue hover:bg-brand-navy text-white
                         text-sm font-semibold px-5 py-2.5 rounded-xl transition-all
                         shadow-[0_0_16px_rgba(46,117,182,0.3)] whitespace-nowrap"
            >
              <Sparkles className="w-4 h-4" />
              Consultar en el chat
            </button>
          </motion.div>
        )}

      </div>
    </div>
  );
}
