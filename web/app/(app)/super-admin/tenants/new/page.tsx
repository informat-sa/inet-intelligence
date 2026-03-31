"use client";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Building2, Server, Database,
  CheckCircle2, XCircle, Loader2, Save,
  AlertTriangle, ChevronDown, ChevronUp,
  Eye, EyeOff,
} from "lucide-react";
import { createTenant } from "@/lib/api";
import { ERP_MODULES, cn } from "@/lib/utils";

const ALL_MODULE_PREFIXES = ERP_MODULES.map((m) => m.prefix);
const DEFAULT_MODULES     = ["VFA", "CCC", "ADQ", "EXI", "PRO", "REM", "CON", "SII"];

interface FormState {
  slug:           string;
  name:           string;
  taxId:          string;
  dbServer:       string;
  dbPort:         string;
  dbDatabase:     string;
  dbUser:         string;
  dbPassword:     string;
  dbEncrypt:      boolean;
  enabledModules: string[];
}

const EMPTY: FormState = {
  slug: "", name: "", taxId: "",
  dbServer: "", dbPort: "1433", dbDatabase: "INET_STD",
  dbUser: "", dbPassword: "", dbEncrypt: false,
  enabledModules: DEFAULT_MODULES,
};

function toSlug(name: string) {
  return name.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-");
}

export default function NewTenantPage() {
  const router = useRouter();
  const [form, setForm]             = useState<FormState>(EMPTY);
  const [errors, setErrors]         = useState<Partial<Record<keyof FormState, string>>>({});
  const [saving, setSaving]         = useState(false);
  const [saveError, setSaveError]   = useState<string | null>(null);
  const [saveOk, setSaveOk]         = useState(false);
  const [showPassword, setShowPass] = useState(false);
  const [showModules, setShowMods]  = useState(true);

  const set = useCallback((k: keyof FormState, v: unknown) => {
    setForm((p) => ({ ...p, [k]: v }));
    setErrors((p) => ({ ...p, [k]: undefined }));
    setSaveOk(false);
  }, []);

  function handleNameChange(v: string) {
    set("name", v);
    if (!form.slug) set("slug", toSlug(v));
  }

  function toggleModule(prefix: string) {
    const mods = form.enabledModules.includes(prefix)
      ? form.enabledModules.filter((m) => m !== prefix)
      : [...form.enabledModules, prefix];
    set("enabledModules", mods);
  }

  function validate(): boolean {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim())     e.name       = "El nombre es requerido";
    if (!form.slug.trim())     e.slug       = "El slug es requerido";
    if (!/^[a-z0-9-]+$/.test(form.slug)) e.slug = "Solo letras minúsculas, números y guiones";
    if (!form.dbServer.trim()) e.dbServer   = "El servidor es requerido";
    if (!form.dbDatabase.trim()) e.dbDatabase = "La base de datos es requerida";
    if (!form.dbUser.trim())   e.dbUser     = "El usuario es requerido";
    if (!form.dbPassword.trim()) e.dbPassword = "La contraseña es requerida";
    const port = parseInt(form.dbPort);
    if (isNaN(port) || port < 1 || port > 65535) e.dbPort = "Puerto inválido (1–65535)";
    if (form.enabledModules.length === 0) e.enabledModules = "Habilita al menos un módulo";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    setSaveError(null);
    try {
      await createTenant({
        slug:           form.slug,
        name:           form.name,
        taxId:          form.taxId || undefined,
        dbServer:       form.dbServer,
        dbPort:         parseInt(form.dbPort),
        dbDatabase:     form.dbDatabase,
        dbUser:         form.dbUser,
        dbPassword:     form.dbPassword,
        dbEncrypt:      form.dbEncrypt,
        enabledModules: form.enabledModules,
      });
      setSaveOk(true);
      setTimeout(() => router.push("/super-admin"), 700);
    } catch (err: any) {
      setSaveError(err.message ?? "Error al crear la empresa");
    } finally {
      setSaving(false);
    }
  }

  function Field({ label, value, onChange, placeholder, required, error, hint, type = "text" }: {
    label: string; value: string; onChange: (v: string) => void;
    placeholder?: string; required?: boolean; error?: string; hint?: string; type?: string;
  }) {
    return (
      <div>
        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className={cn(
            "w-full border rounded-xl px-3.5 py-2.5 text-sm bg-white dark:bg-slate-900",
            "text-slate-900 dark:text-white placeholder:text-slate-400",
            "focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-400",
            "dark:border-slate-700 transition-all duration-200",
            error ? "border-red-400 dark:border-red-500" : "border-slate-200"
          )}
        />
        {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}
        {hint && !error && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface dark:bg-slate-950">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <button onClick={() => router.push("/super-admin")}
            className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50
                       dark:hover:bg-violet-500/10 rounded-lg transition-all">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-violet-700 rounded-xl
                            flex items-center justify-center shadow-sm">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 dark:text-white leading-none">
                Nueva empresa
              </h1>
              <p className="text-[11px] text-slate-400 mt-0.5">Registro de nuevo cliente</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">

        {/* Company info */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-6 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-4 h-4 text-violet-500" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Información de la empresa</h2>
          </div>
          <Field label="Nombre" value={form.name} onChange={handleNameChange}
            placeholder="Ferretería Central SpA" required error={errors.name} />
          <Field label="Slug (URL-safe)" value={form.slug}
            onChange={(v) => set("slug", v.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
            placeholder="ferreteria-central" required
            hint="Solo letras minúsculas, números y guiones" error={errors.slug} />
          <Field label="RUT empresa" value={form.taxId} onChange={(v) => set("taxId", v)}
            placeholder="76.543.210-K" hint="Opcional" />
        </motion.div>

        {/* SQL Server */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }} className="card p-6 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Server className="w-4 h-4 text-blue-500" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Conexión SQL Server (INET ERP)</h2>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Field label="Servidor" value={form.dbServer} onChange={(v) => set("dbServer", v)}
                placeholder="192.168.1.100" required error={errors.dbServer} />
            </div>
            <Field label="Puerto" value={form.dbPort} onChange={(v) => set("dbPort", v)}
              placeholder="1433" error={errors.dbPort} />
          </div>
          <Field label="Base de datos" value={form.dbDatabase} onChange={(v) => set("dbDatabase", v)}
            placeholder="INET_STD" required error={errors.dbDatabase} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Usuario SQL" value={form.dbUser} onChange={(v) => set("dbUser", v)}
              placeholder="sa" required error={errors.dbUser} />
            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                Contraseña<span className="text-red-500 ml-0.5">*</span>
              </label>
              <div className="flex">
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.dbPassword}
                  onChange={(e) => set("dbPassword", e.target.value)}
                  placeholder="Contraseña SQL" autoComplete="new-password"
                  className={cn(
                    "flex-1 border rounded-xl rounded-r-none px-3.5 py-2.5 text-sm",
                    "bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400",
                    "focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-400",
                    "dark:border-slate-700 transition-all",
                    errors.dbPassword ? "border-red-400" : "border-slate-200"
                  )}
                />
                <button type="button" onClick={() => setShowPass(!showPassword)}
                  className="border border-l-0 border-slate-200 dark:border-slate-700
                             rounded-xl rounded-l-none px-3 text-slate-400 hover:text-slate-600
                             bg-white dark:bg-slate-900 transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.dbPassword && <p className="text-[11px] text-red-500 mt-1">{errors.dbPassword}</p>}
            </div>
          </div>
          {/* Encrypt toggle */}
          <div className="flex items-center gap-3 pt-1">
            <button onClick={() => set("dbEncrypt", !form.dbEncrypt)}
              className={cn(
                "relative w-9 h-5 rounded-full transition-all duration-300 flex-shrink-0",
                form.dbEncrypt ? "bg-blue-500" : "bg-slate-300 dark:bg-slate-600"
              )}>
              <span className={cn(
                "absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-300",
                form.dbEncrypt ? "left-[18px]" : "left-0.5"
              )} />
            </button>
            <span className="text-xs text-slate-600 dark:text-slate-400">Cifrar conexión TLS (Encrypt=true)</span>
          </div>
        </motion.div>

        {/* Modules */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }} className="card overflow-hidden">
          <button onClick={() => setShowMods(!showModules)}
            className="w-full flex items-center justify-between p-5 hover:bg-slate-50
                       dark:hover:bg-slate-800/40 transition-colors">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-violet-500" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Módulos habilitados</h2>
              <span className={cn(
                "text-[11px] font-semibold px-2 py-0.5 rounded-full",
                form.enabledModules.length > 0
                  ? "bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-300"
                  : "bg-red-100 dark:bg-red-500/20 text-red-600"
              )}>
                {form.enabledModules.length} / {ALL_MODULE_PREFIXES.length}
              </span>
            </div>
            {showModules ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>
          <AnimatePresence>
            {showModules && (
              <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                <div className="px-5 pb-5">
                  <div className="flex gap-2 mb-4">
                    <button onClick={() => set("enabledModules", ALL_MODULE_PREFIXES)}
                      className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline">
                      Seleccionar todos
                    </button>
                    <span className="text-slate-300 dark:text-slate-600">|</span>
                    <button onClick={() => set("enabledModules", [])}
                      className="text-xs font-medium text-slate-500 hover:underline">
                      Deseleccionar todos
                    </button>
                    <span className="text-slate-300 dark:text-slate-600">|</span>
                    <button onClick={() => set("enabledModules", DEFAULT_MODULES)}
                      className="text-xs font-medium text-slate-500 hover:underline">
                      Predeterminados
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {ERP_MODULES.map((mod) => {
                      const enabled = form.enabledModules.includes(mod.prefix);
                      return (
                        <button key={mod.prefix} onClick={() => toggleModule(mod.prefix)}
                          className={cn(
                            "flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all",
                            enabled
                              ? "border-violet-300 dark:border-violet-500/50 bg-violet-50 dark:bg-violet-500/10"
                              : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                          )}>
                          <div className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: enabled ? mod.color : "#cbd5e1" }} />
                          <div className="min-w-0">
                            <p className={cn(
                              "text-[11px] font-semibold truncate",
                              enabled ? "text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400"
                            )}>{mod.prefix}</p>
                            <p className="text-[10px] text-slate-400 truncate">{mod.name}</p>
                          </div>
                          {enabled && <CheckCircle2 className="w-3.5 h-3.5 text-violet-500 flex-shrink-0 ml-auto" />}
                        </button>
                      );
                    })}
                  </div>
                  {errors.enabledModules && (
                    <p className="text-[11px] text-red-500 mt-2 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />{errors.enabledModules}
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Save */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex items-center justify-between gap-4 pb-8">
          <button onClick={() => router.push("/super-admin")}
            className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
            Cancelar
          </button>
          <div className="flex items-center gap-3">
            <AnimatePresence>
              {saveError && (
                <motion.div initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                  className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
                  <XCircle className="w-3.5 h-3.5" />{saveError}
                </motion.div>
              )}
              {saveOk && (
                <motion.div initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                  className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />Empresa creada
                </motion.div>
              )}
            </AnimatePresence>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white
                         text-sm font-semibold px-5 py-2.5 rounded-xl transition-all shadow-sm
                         hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" />
                : saveOk ? <CheckCircle2 className="w-4 h-4" />
                : <Save className="w-4 h-4" />}
              Crear empresa
            </button>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
