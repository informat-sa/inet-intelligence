"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Users, Shield, ChevronRight, Sparkles,
  UserCheck, UserX, Mail, ArrowLeft,
  Database, Layers, Activity, TrendingUp,
} from "lucide-react";
import { useChatStore } from "@/store/chat";
import { listUsers } from "@/lib/api";
import { ERP_MODULES } from "@/lib/utils";
import type { PortalUser } from "@/types";

export default function AdminPage() {
  const router = useRouter();
  const user   = useChatStore((s) => s.user);
  const [users, setUsers]  = useState<PortalUser[]>([]);
  const [loading, setLoad] = useState(true);

  useEffect(() => {
    listUsers()
      .then(setUsers)
      .catch(() => setUsers([]))
      .finally(() => setLoad(false));
  }, []);

  const active   = users.filter((u) => u.isActive && !u.inviteToken).length;
  const pending  = users.filter((u) => u.inviteToken).length;
  const inactive = users.filter((u) => !u.isActive).length;
  const total    = users.length;

  // Module distribution: count how many users have access to each module
  const moduleStats = ERP_MODULES.map((mod) => {
    const count = users.filter((u) =>
      (u.modulePermissions ?? []).some((mp) => mp.modulePrefix === mod.prefix && mp.enabled)
    ).length;
    return { ...mod, userCount: count, pct: total > 0 ? Math.round((count / total) * 100) : 0 };
  })
    .sort((a, b) => b.userCount - a.userCount)
    .slice(0, 10); // top 10 modules by user count

  // System totals
  const totalTables = ERP_MODULES.reduce((s, m) => s + m.tableCount, 0);
  const totalAttrs  = ERP_MODULES.reduce((s, m) => s + m.attributeCount, 0);

  return (
    <div className="min-h-screen bg-surface dark:bg-slate-950">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <button
            onClick={() => router.push("/dashboard")}
            className="p-2 text-slate-400 hover:text-brand-blue hover:bg-brand-blue/8
                       rounded-lg transition-all duration-200"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-brand-blue to-brand-navy rounded-xl
                            flex items-center justify-center shadow-sm">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 dark:text-white leading-none">
                Panel de administración
              </h1>
              <p className="text-[11px] text-slate-400 mt-0.5">{user?.empresa}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {/* ── User stats ──────────────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Usuarios
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { icon: Users,     label: "Total",             value: total,    color: "text-brand-blue",  bg: "bg-brand-blue/10" },
              { icon: UserCheck, label: "Activos",           value: active,   color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
              { icon: Mail,      label: "Invit. pendientes", value: pending,  color: "text-amber-600",   bg: "bg-amber-50 dark:bg-amber-500/10" },
              { icon: UserX,     label: "Inactivos",         value: inactive, color: "text-slate-500",   bg: "bg-slate-100 dark:bg-slate-800" },
            ].map(({ icon: Icon, label, value, color, bg }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="card p-5"
              >
                <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center mb-3`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                  {loading ? "—" : value}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">{label}</div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── System stats ────────────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Sistema ERP
          </h2>
          <div className="grid grid-cols-3 gap-4">
            {[
              { icon: Layers,    label: "Módulos registrados", value: ERP_MODULES.length, color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-500/10" },
              { icon: Database,  label: "Tablas disponibles",  value: totalTables.toLocaleString("es-CL"), color: "text-brand-blue", bg: "bg-brand-blue/10" },
              { icon: Activity,  label: "Atributos mapeados",  value: totalAttrs.toLocaleString("es-CL"),  color: "text-teal-600",  bg: "bg-teal-50 dark:bg-teal-500/10" },
            ].map(({ icon: Icon, label, value, color, bg }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.05 }}
                className="card p-5"
              >
                <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center mb-3`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white">{value}</div>
                <div className="text-xs text-slate-400 mt-0.5">{label}</div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── Module distribution chart ────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5" />
            Módulos por cobertura de tablas
          </h2>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="card p-5"
          >
            <p className="text-[11px] text-slate-400 mb-4">
              Los 10 módulos con más tablas disponibles en la KB de tu ERP.
            </p>
            <div className="space-y-2.5">
              {moduleStats.map((mod) => {
                // bar width proportional to tableCount vs max
                const maxTables = Math.max(...ERP_MODULES.map((m) => m.tableCount));
                const barPct = Math.round((mod.tableCount / maxTables) * 100);
                return (
                  <div key={mod.prefix} className="flex items-center gap-3">
                    {/* Module name */}
                    <div className="w-28 text-xs text-slate-600 dark:text-slate-300 font-medium truncate flex-shrink-0">
                      {mod.name}
                    </div>
                    {/* Bar */}
                    <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${barPct}%` }}
                        transition={{ duration: 0.6, ease: "easeOut", delay: 0.3 }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: mod.color }}
                      />
                    </div>
                    {/* Count */}
                    <div className="w-16 text-right flex-shrink-0">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                        {mod.tableCount}
                      </span>
                      <span className="text-[10px] text-slate-400 ml-1">tablas</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </section>

        {/* ── All modules grid ─────────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Todos los módulos ({ERP_MODULES.length})
          </h2>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="card p-5"
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ERP_MODULES.map((mod) => (
                <div
                  key={mod.prefix}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl
                             bg-slate-50 dark:bg-slate-800/50"
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: mod.color }}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                      {mod.name}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {mod.prefix} · {mod.tableCount}t · {mod.attributeCount.toLocaleString("es-CL")}a
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* ── Quick actions ────────────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Acciones rápidas
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <motion.button
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              onClick={() => router.push("/admin/users")}
              className="card p-5 text-left hover:shadow-card-hover hover:-translate-y-0.5
                         transition-all duration-200 group flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-brand-blue/10 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5 text-brand-blue" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Gestionar usuarios</p>
                  <p className="text-xs text-slate-400 mt-0.5">Invitar, editar permisos, desactivar</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-brand-blue
                                       group-hover:translate-x-0.5 transition-all duration-200" />
            </motion.button>

            <motion.button
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              onClick={() => router.push("/dashboard")}
              className="card p-5 text-left hover:shadow-card-hover hover:-translate-y-0.5
                         transition-all duration-200 group flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-violet-500/10 rounded-xl flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Ir al chat</p>
                  <p className="text-xs text-slate-400 mt-0.5">Consultar tu ERP en lenguaje natural</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-violet-600
                                       group-hover:translate-x-0.5 transition-all duration-200" />
            </motion.button>
          </div>
        </section>

      </div>
    </div>
  );
}
