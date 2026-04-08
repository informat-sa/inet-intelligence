"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Users, Shield, ChevronRight, Sparkles,
  UserCheck, UserX, Mail, ArrowLeft,
  Database, Layers, Activity,
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

        {/* ── Users list ──────────────────────────────────────────────── */}
        {!loading && users.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Usuarios del sistema
            </h2>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="card overflow-hidden"
            >
              <div className="divide-y divide-slate-50 dark:divide-slate-800">
                {users.slice(0, 8).map((u, i) => {
                  const isPending  = !!u.inviteToken;
                  const isInactive = !u.isActive;
                  return (
                    <motion.div
                      key={u.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.28 + i * 0.04 }}
                      className="flex items-center gap-3 px-5 py-3.5"
                    >
                      {/* Avatar */}
                      <div className="w-8 h-8 rounded-full flex items-center justify-center
                                      text-xs font-bold text-white flex-shrink-0"
                           style={{ backgroundColor: "#0F1E35" }}>
                        {u.name?.charAt(0)?.toUpperCase() ?? u.email.charAt(0).toUpperCase()}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                          {u.name ?? u.email}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">{u.email}</p>
                      </div>
                      {/* Módulos */}
                      <span className="text-[10px] text-slate-400 hidden sm:block flex-shrink-0">
                        {(u.modulePermissions ?? []).filter(m => m.enabled).length} módulos
                      </span>
                      {/* Estado */}
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                        isPending  ? "bg-amber-50 text-amber-600 dark:bg-amber-500/10" :
                        isInactive ? "bg-slate-100 text-slate-400 dark:bg-slate-800" :
                                     "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"
                      }`}>
                        {isPending ? "Pendiente" : isInactive ? "Inactivo" : "Activo"}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
              {users.length > 8 && (
                <div className="px-5 py-3 border-t border-slate-50 dark:border-slate-800">
                  <button
                    onClick={() => router.push("/admin/users")}
                    className="text-[11px] text-brand-blue hover:underline font-medium"
                  >
                    Ver los {users.length - 8} usuarios restantes →
                  </button>
                </div>
              )}
            </motion.div>
          </section>
        )}

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
