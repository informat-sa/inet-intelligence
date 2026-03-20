"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, User, CheckSquare, Square, Send, Loader2 } from "lucide-react";
import { ERP_MODULES } from "@/lib/utils";
import { inviteUser } from "@/lib/api";
import type { PortalUser } from "@/types";

interface Props {
  tenantModules: string[];       // modules enabled for this tenant
  onClose: ()  => void;
  onCreated: (user: PortalUser) => void;
}

export function InviteUserDialog({ tenantModules, onClose, onCreated }: Props) {
  const [email, setEmail]       = useState("");
  const [name, setName]         = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const availableModules = ERP_MODULES.filter((m) => tenantModules.includes(m.prefix));

  function toggleModule(prefix: string) {
    setSelected((prev) =>
      prev.includes(prefix) ? prev.filter((p) => p !== prefix) : [...prev, prefix]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const created = await inviteUser({
        email,
        name: name || undefined,
        modulePermissions: selected,
      });
      onCreated(created);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al invitar usuario");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100
                   dark:border-slate-800 w-full max-w-md"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <h2 className="font-bold text-slate-900 dark:text-white">Invitar usuario</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100
                       dark:hover:bg-slate-800 rounded-lg transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
              Correo electrónico *
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@empresa.cl"
                required
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl
                           pl-9 pr-3 py-2.5 text-sm text-slate-700 dark:text-slate-200
                           bg-slate-50 dark:bg-slate-800 placeholder:text-slate-400
                           focus:outline-none focus:ring-2 focus:ring-brand-blue/30
                           transition-all duration-200"
              />
            </div>
          </div>

          {/* Name (optional) */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
              Nombre (opcional)
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ana González"
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl
                           pl-9 pr-3 py-2.5 text-sm text-slate-700 dark:text-slate-200
                           bg-slate-50 dark:bg-slate-800 placeholder:text-slate-400
                           focus:outline-none focus:ring-2 focus:ring-brand-blue/30
                           transition-all duration-200"
              />
            </div>
          </div>

          {/* Module permissions */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
              Módulos que puede consultar
            </label>
            <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1">
              {availableModules.map((mod) => {
                const on = selected.includes(mod.prefix);
                return (
                  <button
                    key={mod.prefix}
                    type="button"
                    onClick={() => toggleModule(mod.prefix)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium
                                border transition-all duration-150 text-left
                                ${on
                                  ? "border-brand-blue bg-brand-blue/8 text-brand-blue dark:text-brand-mid"
                                  : "border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300"
                                }`}
                  >
                    {on
                      ? <CheckSquare className="w-3.5 h-3.5 flex-shrink-0" />
                      : <Square className="w-3.5 h-3.5 flex-shrink-0" />
                    }
                    <span className="truncate">{mod.name}</span>
                  </button>
                );
              })}
            </div>
            {selected.length === 0 && (
              <p className="text-[11px] text-amber-500 mt-1.5">
                Sin módulos seleccionados el usuario no podrá hacer consultas.
              </p>
            )}
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-500 bg-red-50 dark:bg-red-500/10 border border-red-200
                          dark:border-red-500/20 rounded-xl px-3 py-2.5">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700
                         text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50
                         dark:hover:bg-slate-800 transition-all duration-200 font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !email}
              className="flex-1 py-2.5 rounded-xl bg-brand-blue hover:bg-brand-navy text-white
                         text-sm font-semibold transition-all duration-200
                         disabled:opacity-60 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Enviar invitación
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
