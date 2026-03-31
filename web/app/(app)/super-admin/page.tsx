"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Building2, Plus, ArrowLeft, CheckCircle2, XCircle,
  Server, Database, ChevronRight, Loader2,
  Wifi, WifiOff, Shield, Users,
  RefreshCw,
} from "lucide-react";
import { listTenants, testTenantConnection } from "@/lib/api";
import { ERP_MODULES } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { TenantDetail } from "@/types";

export default function SuperAdminPage() {
  const router  = useRouter();
  const [tenants, setTenants]           = useState<TenantDetail[]>([]);
  const [loading, setLoading]           = useState(true);
  const [testing, setTesting]           = useState<string | null>(null);
  const [pingResults, setPingResults]   = useState<Record<string, { success: boolean; ms?: number }>>({});

  useEffect(() => {
    listTenants()
      .then(setTenants)
      .catch(() => setTenants([]))
      .finally(() => setLoading(false));
  }, []);

  async function handleTest(id: string) {
    setTesting(id);
    try {
      const res = await testTenantConnection(id);
      setPingResults((prev) => ({ ...prev, [id]: res }));
    } finally {
      setTesting(null);
    }
  }

  const active   = tenants.filter((t) => t.isActive).length;
  const inactive = tenants.filter((t) => !t.isActive).length;

  return (
    <div className="min-h-screen bg-surface dark:bg-slate-950">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/dashboard")}
              className="p-2 text-slate-400 hover:text-brand-blue hover:bg-brand-blue/8
                         rounded-lg transition-all duration-200"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-violet-700 rounded-xl
                              flex items-center justify-center shadow-sm">
                <Building2 className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-900 dark:text-white leading-none">
                  Super Admin
                </h1>
                <p className="text-[11px] text-slate-400 mt-0.5">Gestión de empresas clientes</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => router.push("/super-admin/tenants/new")}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white
                       text-sm font-semibold px-4 py-2 rounded-xl transition-all duration-200
                       shadow-sm hover:shadow-md"
          >
            <Plus className="w-4 h-4" />
            Nueva empresa
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* ── Stats ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: Building2, label: "Total empresas",  value: tenants.length, color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-500/10" },
            { icon: CheckCircle2, label: "Activas",      value: active,         color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
            { icon: XCircle,   label: "Inactivas",       value: inactive,       color: "text-slate-500",   bg: "bg-slate-100 dark:bg-slate-800" },
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

        {/* ── Tenant table ──────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="card overflow-hidden"
        >
          {loading ? (
            <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Cargando empresas…</span>
            </div>
          ) : tenants.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
              <div className="w-16 h-16 bg-violet-50 dark:bg-violet-500/10 rounded-2xl
                              flex items-center justify-center">
                <Building2 className="w-7 h-7 text-violet-400" />
              </div>
              <div>
                <p className="font-semibold text-slate-700 dark:text-slate-200">
                  No hay empresas registradas
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  Crea la primera empresa para comenzar.
                </p>
              </div>
              <button
                onClick={() => router.push("/super-admin/tenants/new")}
                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700
                           text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all"
              >
                <Plus className="w-4 h-4" />
                Nueva empresa
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="text-left text-[11px] font-semibold text-slate-400 uppercase
                                 tracking-wider px-5 py-3">
                    Empresa
                  </th>
                  <th className="text-left text-[11px] font-semibold text-slate-400 uppercase
                                 tracking-wider px-5 py-3 hidden md:table-cell">
                    Servidor SQL
                  </th>
                  <th className="text-left text-[11px] font-semibold text-slate-400 uppercase
                                 tracking-wider px-5 py-3">
                    Módulos
                  </th>
                  <th className="text-left text-[11px] font-semibold text-slate-400 uppercase
                                 tracking-wider px-5 py-3">
                    Estado
                  </th>
                  <th className="text-right text-[11px] font-semibold text-slate-400 uppercase
                                 tracking-wider px-5 py-3">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {tenants.map((t, i) => {
                  const ping = pingResults[t.id];
                  return (
                    <motion.tr
                      key={t.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.05 * i }}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Company name */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-400
                                          to-violet-600 flex items-center justify-center
                                          text-white text-xs font-bold flex-shrink-0">
                            {t.name[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white">
                              {t.name}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {t.slug}{t.taxId ? ` · ${t.taxId}` : ""}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* SQL Server */}
                      <td className="px-5 py-4 hidden md:table-cell">
                        <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                          <Server className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="font-mono text-xs truncate max-w-[160px]">
                            {t.dbServer}:{t.dbPort}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-400 mt-0.5">
                          <Database className="w-3 h-3 flex-shrink-0" />
                          <span className="font-mono text-[11px] truncate max-w-[160px]">
                            {t.dbDatabase}
                          </span>
                        </div>
                      </td>

                      {/* Modules */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-slate-900 dark:text-white">
                            {t.enabledModules.length}
                          </span>
                          <span className="text-xs text-slate-400">
                            / {ERP_MODULES.length} módulos
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1 max-w-[160px]">
                          {t.enabledModules.slice(0, 5).map((m) => (
                            <span
                              key={m}
                              className="text-[10px] bg-violet-50 dark:bg-violet-500/10
                                         text-violet-600 dark:text-violet-300 px-1.5 py-0.5
                                         rounded font-medium"
                            >
                              {m}
                            </span>
                          ))}
                          {t.enabledModules.length > 5 && (
                            <span className="text-[10px] text-slate-400">
                              +{t.enabledModules.length - 5}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status + ping */}
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1.5">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full w-fit",
                              t.isActive
                                ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                            )}
                          >
                            {t.isActive ? (
                              <><CheckCircle2 className="w-3 h-3" />Activa</>
                            ) : (
                              <><XCircle className="w-3 h-3" />Inactiva</>
                            )}
                          </span>
                          {ping && (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full w-fit",
                                ping.success
                                  ? "bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400"
                                  : "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400"
                              )}
                            >
                              {ping.success ? (
                                <><Wifi className="w-3 h-3" />SQL OK {ping.ms && `${ping.ms}ms`}</>
                              ) : (
                                <><WifiOff className="w-3 h-3" />Sin conexión</>
                              )}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleTest(t.id)}
                            disabled={testing === t.id}
                            title="Probar conexión SQL"
                            className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50
                                       dark:hover:bg-teal-500/10 rounded-lg transition-all duration-200
                                       disabled:opacity-50"
                          >
                            {testing === t.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RefreshCw className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => router.push(`/super-admin/tenants/${t.id}`)}
                            className="flex items-center gap-1.5 bg-violet-50 dark:bg-violet-500/10
                                       hover:bg-violet-100 dark:hover:bg-violet-500/20
                                       text-violet-600 dark:text-violet-300 text-xs font-semibold
                                       px-3 py-1.5 rounded-lg transition-all duration-200"
                          >
                            Editar
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </motion.div>

        {/* ── Informat info ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card p-5 flex items-center gap-4 bg-gradient-to-r from-violet-50
                     to-indigo-50 dark:from-violet-500/5 dark:to-indigo-500/5
                     border-violet-100 dark:border-violet-500/20"
        >
          <div className="w-10 h-10 bg-violet-100 dark:bg-violet-500/20 rounded-xl
                          flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-violet-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              Acceso Super Admin — Informat
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Desde este panel puedes crear y configurar empresas clientes. Cada empresa
              tiene su propio SQL Server INET ERP, usuarios y permisos de módulos.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 flex-shrink-0">
            <Users className="w-3.5 h-3.5" />
            <span>{tenants.reduce((_, __) => _ + 1, 0)} empresas</span>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
