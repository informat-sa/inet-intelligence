"use client";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, UserCheck, UserX, Mail, Clock } from "lucide-react";
import { useChatStore } from "@/store/chat";
import { listUsers } from "@/lib/api";
import { PermissionMatrix } from "@/components/admin/PermissionMatrix";
import type { PortalUser } from "@/types";

interface Props {
  params: Promise<{ id: string }>;
}

export default function UserDetailPage({ params }: Props) {
  const { id }  = use(params);
  const router  = useRouter();
  const currentUser = useChatStore((s) => s.user);

  const [user, setUser]       = useState<PortalUser | null>(null);
  const [loading, setLoading] = useState(true);

  const tenantModules = currentUser?.modules ?? [];

  useEffect(() => {
    listUsers()
      .then((all) => setUser(all.find((u) => u.id === id) ?? null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface dark:bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-brand-blue" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-surface dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 mb-4">Usuario no encontrado.</p>
          <button
            onClick={() => router.push("/admin/users")}
            className="text-brand-blue text-sm hover:underline"
          >
            Volver a usuarios
          </button>
        </div>
      </div>
    );
  }

  const enabledModules = user.modulePermissions
    .filter((p) => p.enabled)
    .map((p) => p.modulePrefix);

  return (
    <div className="min-h-screen bg-surface dark:bg-slate-950">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <button
            onClick={() => router.push("/admin/users")}
            className="p-2 text-slate-400 hover:text-brand-blue hover:bg-brand-blue/8
                       rounded-lg transition-all duration-200"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white">
              {user.name || user.email}
            </h1>
            <p className="text-[11px] text-slate-400 mt-0.5">Permisos de módulos</p>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-5">
        {/* User card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-5"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-blue to-brand-navy
                            flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
              {(user.name?.[0] ?? user.email[0]).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-800 dark:text-slate-100">
                {user.name || "Sin nombre"}
              </p>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                <Mail className="w-3 h-3" />
                {user.email}
              </div>
            </div>
            <div>
              {user.inviteToken ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold
                                 bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400
                                 px-2.5 py-1 rounded-full">
                  <Clock className="w-3 h-3" />
                  Invitación pendiente
                </span>
              ) : user.isActive ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold
                                 bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400
                                 px-2.5 py-1 rounded-full">
                  <UserCheck className="w-3 h-3" />
                  Activo
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold
                                 bg-slate-100 dark:bg-slate-800 text-slate-500 px-2.5 py-1 rounded-full">
                  <UserX className="w-3 h-3" />
                  Inactivo
                </span>
              )}
            </div>
          </div>
        </motion.div>

        {/* Permission Matrix */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <PermissionMatrix
            userId={user.id}
            tenantModules={tenantModules}
            enabledModules={enabledModules}
            onSaved={(newModules) => {
              setUser({
                ...user,
                modulePermissions: newModules.map((m) => ({ modulePrefix: m, enabled: true })),
              });
            }}
          />
        </motion.div>
      </div>
    </div>
  );
}
