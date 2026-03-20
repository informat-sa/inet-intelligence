"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  UserCheck, UserX, Clock, MoreVertical,
  Settings, Trash2, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { deactivateUser, resendInvite } from "@/lib/api";
import type { PortalUser } from "@/types";

interface Props {
  users:     PortalUser[];
  onUpdate:  (users: PortalUser[]) => void;
}

function StatusBadge({ user }: { user: PortalUser }) {
  if (user.inviteToken) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold
                       bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400
                       px-2 py-0.5 rounded-full">
        <Clock className="w-2.5 h-2.5" />
        Invitación pendiente
      </span>
    );
  }
  if (user.isActive) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold
                       bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400
                       px-2 py-0.5 rounded-full">
        <UserCheck className="w-2.5 h-2.5" />
        Activo
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold
                     bg-slate-100 dark:bg-slate-800 text-slate-500
                     px-2 py-0.5 rounded-full">
      <UserX className="w-2.5 h-2.5" />
      Inactivo
    </span>
  );
}

export function UserTable({ users, onUpdate }: Props) {
  const router  = useRouter();
  const [menu, setMenu] = useState<string | null>(null);

  async function handleDeactivate(userId: string) {
    await deactivateUser(userId);
    onUpdate(users.map((u) => u.id === userId ? { ...u, isActive: false } : u));
    setMenu(null);
  }

  async function handleResend(userId: string) {
    await resendInvite(userId);
    setMenu(null);
  }

  if (users.length === 0) {
    return (
      <div className="card p-12 text-center">
        <UserCheck className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
        <p className="text-sm text-slate-400">No hay usuarios aún. ¡Invita al primero!</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-100 dark:border-slate-800">
            <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider
                           px-5 py-3">Usuario</th>
            <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider
                           px-3 py-3">Rol</th>
            <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider
                           px-3 py-3">Estado</th>
            <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider
                           px-3 py-3">Módulos</th>
            <th className="px-3 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
          {users.map((u) => (
            <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
              {/* User info */}
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-blue to-brand-navy
                                  flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {(u.name?.[0] ?? u.email[0]).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {u.name || "—"}
                    </p>
                    <p className="text-[11px] text-slate-400">{u.email}</p>
                  </div>
                </div>
              </td>

              {/* Role */}
              <td className="px-3 py-3.5">
                <span className={cn(
                  "text-xs font-medium px-2 py-0.5 rounded-full",
                  u.role === "admin"
                    ? "bg-brand-blue/10 text-brand-blue dark:text-brand-mid"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                )}>
                  {u.role === "admin" ? "Admin" : "Usuario"}
                </span>
              </td>

              {/* Status */}
              <td className="px-3 py-3.5">
                <StatusBadge user={u} />
              </td>

              {/* Module count */}
              <td className="px-3 py-3.5">
                <span className="text-xs text-slate-500">
                  {u.modulePermissions.filter((p) => p.enabled).length} módulos
                </span>
              </td>

              {/* Actions */}
              <td className="px-3 py-3.5 relative">
                <div className="flex items-center gap-1 justify-end">
                  <button
                    onClick={() => router.push(`/admin/users/${u.id}`)}
                    className="p-1.5 text-slate-400 hover:text-brand-blue hover:bg-brand-blue/8
                               rounded-lg transition-all duration-150"
                    title="Editar permisos"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => setMenu(menu === u.id ? null : u.id)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100
                                 dark:hover:bg-slate-800 rounded-lg transition-all duration-150"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                    {menu === u.id && (
                      <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-800
                                      border border-slate-100 dark:border-slate-700 rounded-xl
                                      shadow-lg z-10 py-1 min-w-[160px]">
                        {u.inviteToken && (
                          <button
                            onClick={() => handleResend(u.id)}
                            className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-600
                                       dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Reenviar invitación
                          </button>
                        )}
                        {u.isActive && !u.inviteToken && (
                          <button
                            onClick={() => handleDeactivate(u.id)}
                            className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-500
                                       hover:bg-red-50 dark:hover:bg-red-500/10"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Desactivar usuario
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
