"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  History, Search, MessageSquare, ArrowLeft,
  Clock, Database, Trash2, ChevronRight,
  CalendarDays, Filter, X,
} from "lucide-react";
import { useChatStore } from "@/store/chat";
import { ERP_MODULES, formatRelativeTime, cn } from "@/lib/utils";

// Helper: get module color from prefix
function moduleColor(prefix: string) {
  return ERP_MODULES.find((m) => m.prefix === prefix)?.color ?? "#94a3b8";
}
function moduleName(prefix: string) {
  return ERP_MODULES.find((m) => m.prefix === prefix)?.name ?? prefix;
}

export default function HistoryPage() {
  const router = useRouter();
  const { conversations, setActiveConversation, deleteConversation, messages } = useChatStore();

  const [search, setSearch]         = useState("");
  const [filterModule, setFilter]   = useState<string | null>(null);
  const [confirmDelete, setConfirm] = useState<string | null>(null);

  // All modules that appear in any conversation
  const allModules = useMemo(() => {
    const mods = new Set<string>();
    conversations.forEach((c) => c.modulesUsed.forEach((m) => mods.add(m)));
    return Array.from(mods).sort();
  }, [conversations]);

  const filtered = useMemo(() =>
    conversations.filter((c) => {
      const matchSearch = c.title.toLowerCase().includes(search.toLowerCase());
      const matchModule = filterModule ? c.modulesUsed.includes(filterModule) : true;
      return matchSearch && matchModule;
    }),
    [conversations, search, filterModule]
  );

  // Group conversations by day
  const grouped = useMemo(() => {
    const groups: { label: string; items: typeof conversations }[] = [];
    const today     = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const dayLabel = (d: Date) => {
      const t = new Date(today.toDateString());
      const y = new Date(yesterday.toDateString());
      const cd = new Date(d.toDateString());
      if (cd.getTime() === t.getTime())  return "Hoy";
      if (cd.getTime() === y.getTime())  return "Ayer";
      return cd.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });
    };

    const seen = new Map<string, number>();
    for (const conv of filtered) {
      const label = dayLabel(new Date(conv.updatedAt));
      if (!seen.has(label)) {
        seen.set(label, groups.length);
        groups.push({ label, items: [] });
      }
      groups[seen.get(label)!].items.push(conv);
    }
    return groups;
  }, [filtered]);

  function openConversation(id: string) {
    setActiveConversation(id);
    router.push("/dashboard");
  }

  function handleDelete(id: string) {
    deleteConversation(id);
    setConfirm(null);
  }

  return (
    <div className="min-h-screen bg-surface dark:bg-slate-950">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/dashboard")}
              className="p-2 text-slate-400 hover:text-brand-blue hover:bg-brand-blue/8
                         rounded-lg transition-all duration-200"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-slate-600 to-slate-800 rounded-xl
                              flex items-center justify-center shadow-sm">
                <History className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-900 dark:text-white leading-none">
                  Historial de consultas
                </h1>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {conversations.length} conversación{conversations.length !== 1 ? "es" : ""} guardada{conversations.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">

        {/* ── Search + filter bar ───────────────────────────────────── */}
        <div className="flex gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar en historial…"
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700
                         rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-700 dark:text-slate-200
                         placeholder:text-slate-400 focus:outline-none focus:ring-2
                         focus:ring-brand-blue/30 focus:border-brand-blue transition-all"
            />
            {search && (
              <button onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Module filter */}
          {allModules.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              {allModules.slice(0, 8).map((m) => (
                <button
                  key={m}
                  onClick={() => setFilter(filterModule === m ? null : m)}
                  className={cn(
                    "text-[11px] font-semibold px-2.5 py-1 rounded-full transition-all",
                    filterModule === m
                      ? "text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  )}
                  style={filterModule === m ? { backgroundColor: moduleColor(m) } : {}}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Empty state ────────────────────────────────────────────── */}
        {conversations.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24 text-center gap-4"
          >
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl
                            flex items-center justify-center">
              <MessageSquare className="w-7 h-7 text-slate-400" />
            </div>
            <div>
              <p className="font-semibold text-slate-700 dark:text-slate-200">
                Sin conversaciones aún
              </p>
              <p className="text-sm text-slate-400 mt-1">
                Tus consultas al ERP aparecerán aquí.
              </p>
            </div>
            <button
              onClick={() => router.push("/dashboard")}
              className="flex items-center gap-2 bg-brand-blue hover:bg-brand-navy text-white
                         text-sm font-semibold px-4 py-2 rounded-xl transition-all shadow-sm"
            >
              Hacer primera consulta
              <ChevronRight className="w-4 h-4" />
            </button>
          </motion.div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">
            Sin resultados para &ldquo;{search}&rdquo;
            {filterModule && ` en módulo ${filterModule}`}
          </div>
        ) : (
          /* ── Grouped list ──────────────────────────────────────────── */
          grouped.map((group, gi) => (
            <div key={group.label}>
              <div className="flex items-center gap-2 mb-2.5">
                <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {group.label}
                </p>
                <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
              </div>
              <div className="space-y-2">
                {group.items.map((conv, i) => {
                  const msgCount  = (messages[conv.id] ?? []).length;
                  const isDeleting = confirmDelete === conv.id;

                  return (
                    <motion.div
                      key={conv.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: gi * 0.04 + i * 0.03 }}
                      className={cn(
                        "card p-4 cursor-pointer group hover:shadow-card-hover hover:-translate-y-0.5",
                        "transition-all duration-200",
                        isDeleting && "ring-2 ring-red-400 dark:ring-red-500"
                      )}
                      onClick={() => !isDeleting && openConversation(conv.id)}
                    >
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className="w-8 h-8 rounded-xl bg-brand-blue/10 dark:bg-brand-blue/20
                                        flex items-center justify-center flex-shrink-0 mt-0.5">
                          <MessageSquare className="w-3.5 h-3.5 text-brand-blue" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 dark:text-white
                                       truncate group-hover:text-brand-blue transition-colors">
                            {conv.title}
                          </p>
                          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            {/* Time */}
                            <span className="flex items-center gap-1 text-[11px] text-slate-400">
                              <Clock className="w-3 h-3" />
                              {formatRelativeTime(conv.updatedAt)}
                            </span>
                            {/* Message count */}
                            {msgCount > 0 && (
                              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                                <MessageSquare className="w-3 h-3" />
                                {Math.ceil(msgCount / 2)} {Math.ceil(msgCount / 2) === 1 ? "pregunta" : "preguntas"}
                              </span>
                            )}
                            {/* Module tags */}
                            {conv.modulesUsed.length > 0 && (
                              <div className="flex items-center gap-1 flex-wrap">
                                {conv.modulesUsed.slice(0, 4).map((m) => (
                                  <span
                                    key={m}
                                    title={moduleName(m)}
                                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                                    style={{
                                      backgroundColor: moduleColor(m) + "22",
                                      color: moduleColor(m),
                                    }}
                                  >
                                    {m}
                                  </span>
                                ))}
                                {conv.modulesUsed.length > 4 && (
                                  <span className="text-[10px] text-slate-400">
                                    +{conv.modulesUsed.length - 4}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {isDeleting ? (
                            <>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(conv.id); }}
                                className="text-xs font-semibold text-red-600 bg-red-50
                                           dark:bg-red-500/10 px-2.5 py-1 rounded-lg
                                           hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                              >
                                Eliminar
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setConfirm(null); }}
                                className="text-xs text-slate-500 px-2.5 py-1 rounded-lg
                                           hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              >
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={(e) => { e.stopPropagation(); setConfirm(conv.id); }}
                                className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400
                                           hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10
                                           rounded-lg transition-all duration-150"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                              <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600
                                                        group-hover:text-brand-blue group-hover:translate-x-0.5
                                                        transition-all duration-200" />
                            </>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))
        )}

        {/* ── Stats footer ───────────────────────────────────────────── */}
        {conversations.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-center gap-6 py-4 text-xs text-slate-400"
          >
            <span className="flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              {conversations.length} conversaciones
            </span>
            <span className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" />
              {allModules.length} módulos consultados
            </span>
          </motion.div>
        )}

      </div>
    </div>
  );
}
