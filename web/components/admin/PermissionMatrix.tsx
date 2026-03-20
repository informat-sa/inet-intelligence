"use client";
import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { ERP_MODULES } from "@/lib/utils";
import { setUserPermissions } from "@/lib/api";

interface Props {
  userId:         string;
  tenantModules:  string[];   // modules enabled for this tenant
  enabledModules: string[];   // modules currently enabled for this user
  onSaved: (enabled: string[]) => void;
}

export function PermissionMatrix({ userId, tenantModules, enabledModules, onSaved }: Props) {
  const [selected, setSelected] = useState<string[]>(enabledModules);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);

  const available = ERP_MODULES.filter((m) => tenantModules.includes(m.prefix));
  const dirty = JSON.stringify([...selected].sort()) !== JSON.stringify([...enabledModules].sort());

  function toggle(prefix: string) {
    setSelected((prev) =>
      prev.includes(prefix) ? prev.filter((p) => p !== prefix) : [...prev, prefix]
    );
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await setUserPermissions(userId, selected);
      setSaved(true);
      onSaved(selected);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      /* error handled by parent if needed */
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
          Permisos de módulos
        </h3>
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="flex items-center gap-2 bg-brand-blue hover:bg-brand-navy text-white
                     text-xs font-semibold px-3.5 py-2 rounded-xl transition-all duration-200
                     disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {saving
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Save className="w-3.5 h-3.5" />
          }
          {saved ? "Guardado ✓" : "Guardar cambios"}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {available.map((mod) => {
          const on = selected.includes(mod.prefix);
          return (
            <button
              key={mod.prefix}
              type="button"
              onClick={() => toggle(mod.prefix)}
              className={`relative flex flex-col items-start gap-1 p-3 rounded-xl border
                          text-left transition-all duration-150
                          ${on
                            ? "border-brand-blue bg-brand-blue/8 dark:bg-brand-blue/12"
                            : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                          }`}
            >
              {/* Toggle dot */}
              <div className={`absolute top-2.5 right-2.5 w-2 h-2 rounded-full
                               ${on ? "bg-brand-blue" : "bg-slate-300 dark:bg-slate-600"}`} />
              <span className={`text-xs font-bold ${on ? "text-brand-blue dark:text-brand-mid" : "text-slate-400"}`}>
                {mod.prefix}
              </span>
              <span className={`text-xs leading-tight ${on ? "text-slate-700 dark:text-slate-200" : "text-slate-500"}`}>
                {mod.name}
              </span>
            </button>
          );
        })}
      </div>

      {selected.length === 0 && (
        <p className="text-xs text-amber-500 mt-3 bg-amber-50 dark:bg-amber-500/10
                      border border-amber-200 dark:border-amber-500/20 rounded-xl px-3 py-2">
          Sin módulos activos — el usuario no podrá hacer consultas.
        </p>
      )}
    </div>
  );
}
