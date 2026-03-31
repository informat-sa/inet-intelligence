"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Building2, Server, Database, Key,
  CheckCircle2, XCircle, Loader2, Save, Wifi,
  WifiOff, AlertTriangle, ChevronDown, ChevronUp,
  Eye, EyeOff,
} from "lucide-react";
import { createTenant, updateTenant, getTenant, testTenantConnection } from "@/lib/api";
import { ERP_MODULES, cn } from "@/lib/utils";
import type { TenantDetail } from "@/types";

// ── All available module prefixes ────────────────────────────────────────────
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
  isActive:       boolean;
}

const EMPTY: FormState = {
  slug:           "",
  name:           "",
  taxId:          "",
  dbServer:       "",
  dbPort:         "1433",
  dbDatabase:     "INET_STD",
  dbUser:         "",
  dbPassword:     "",
  dbEncrypt:      false,
  enabledModules: DEFAULT_MODULES,
  isActive:       true,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function toSlug(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function InputField({
  label, value, onChange, placeholder, required, type = "text",
  hint, error, addon,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; required?: boolean; type?: string;
  hint?: string; error?: string; addon?: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div className="relative flex">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className={cn(
            "flex-1 border rounded-xl px-3.5 py-2.5 text-sm bg-white dark:bg-slate-900",
            "text-slate-900 dark:text-white placeholder:text-slate-400",
            "focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-400",
            "dark:border-slate-700 dark:focus:border-violet-500 transition-all duration-200",
            error
              ? "border-red-400 dark:border-red-500"
              : "border-slate-200",
            addon ? "rounded-r-none" : ""
          )}
        />
        {addon}
      </div>
      {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}
      {hint && !error && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function TenantFormPage() {
  const router  = useRouter();
  const params  = useParams();
  const tenantId = params?.id as string | undefined;
  const isNew   = !tenantId || tenantId === "new";

  const [form, setForm]               = useState<FormState>(EMPTY);
  const [errors, setErrors]           = useState<Partial<Record<keyof FormState, string>>>({});
  const [saving, setSaving]           = useState(false);
  const [loadingTenant, setLoadingTenant] = useState(!isNew);
  const [saveError, setSaveError]     = useState<string | null>(null);
  const [saveOk, setSaveOk]           = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Connection test state
  const [testing, setTesting]         = useState(false);
  const [pingResult, setPingResult]   = useState<{ success: boolean; message: string; ms?: number } | null>(null);

  // Accordion sections
  const [showModules, setShowModules] = useState(true);

  // ── Load existing tenant ─────────────────────────────────────────
  useEffect(() => {
    if (isNew) return;
    getTenant(tenantId!)
      .then((t: TenantDetail) => {
        setForm({
          slug:           t.slug,
          name:           t.name,
          taxId:          t.taxId ?? "",
          dbServer:       t.dbServer,
          dbPort:         String(t.dbPort),
          dbDatabase:     t.dbDatabase,
          dbUser:         t.dbUser,
          dbPassword:     "",          // never pre-filled
          dbEncrypt:      t.dbEncrypt,
          enabledModules: t.enabledModules,
          isActive:       t.isActive,
        });
      })
      .catch(() => setSaveError("No se pudo cargar la empresa."))
      .finally(() => setLoadingTenant(false));
  }, [isNew, tenantId]);

  const set = useCallback((k: keyof FormState, v: unknown) => {
    setForm((prev) => ({ ...prev, [k]: v }));
    setErrors((prev) => ({ ...prev, [k]: undefined }));
    setSaveOk(false);
    setPingResult(null);
  }, []);

  // Auto-generate slug from name (only in create mode and if slug not touched)
  function handleNameChange(v: string) {
    set("name", v);
    if (isNew && !form.slug) {
      set("slug", toSlug(v));
    }
  }

  function toggleModule(prefix: string) {
    const mods = form.enabledModules.includes(prefix)
      ? form.enabledModules.filter((m) => m !== prefix)
      : [...form.enabledModules, prefix];
    set("enabledModules", mods);
  }

  // ── Validation ─────────────────────────────────────────────────────
  function validate(): boolean {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim())     e.name      = "El nombre es requerido";
    if (!form.slug.trim())     e.slug      = "El slug es requerido";
    if (!/^[a-z0-9-]+$/.test(form.slug)) e.slug = "Solo letras minúsculas, números y guiones";
    if (!form.dbServer.trim()) e.dbServer  = "El servidor es requerido";
    if (!form.dbDatabase.trim()) e.dbDatabase = "La base de datos es requerida";
    if (!form.dbUser.trim())   e.dbUser    = "El usuario es requerido";
    if (isNew && !form.dbPassword.trim()) e.dbPassword = "La contraseña es requerida para empresas nuevas";
    const port = parseInt(form.dbPort);
    if (isNaN(port) || port < 1 || port > 65535) e.dbPort = "Puerto inválido (1-65535)";
    if (form.enabledModules.length === 0) e.enabledModules = "Habilita al menos un módulo";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── Save ────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    setSaveError(null);
    setSaveOk(false);
    try {
      const payload: Record<string, unknown> = {
        slug:           form.slug,
        name:           form.name,
        taxId:          form.taxId || undefined,
        dbServer:       form.dbServer,
        dbPort:         parseInt(form.dbPort),
        dbDatabase:     form.dbDatabase,
        dbUser:         form.dbUser,
        dbEncrypt:      form.dbEncrypt,
        enabledModules: form.enabledModules,
        isActive:       form.isActive,
      };
      if (form.dbPassword) payload.dbPassword = form.dbPassword;

      if (isNew) {
        await createTenant(payload as any);
      } else {
        await updateTenant(tenantId!, payload as any);
      }
      setSaveOk(true);
      setTimeout(() => router.push("/super-admin"), 800);
    } catch (err: any) {
      setSaveError(err.message ?? "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  // ── Test connection (only for existing tenants or after first save) ─
  async function handleTest() {
    if (isNew) return;
    setTesting(true);
    setPingResult(null);
    try {
      const res = await testTenantConnection(tenantId!);
      setPingResult(res);
    } finally {
      setTesting(false);
    }
  }

  // ── Loading state ───────────────────────────────────────────────────
  if (loadingTenant) {
    return (
      <div className="min-h-screen bg-surface dark:bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface dark:bg-slate-950">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <button
            onClick={() => router.push("/super-admin")}
            className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50
                       dark:hover:bg-violet-500/10 rounded-lg transition-all duration-200"
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
                {isNew ? "Nueva empresa" : form.name || "Editar empresa"}
              </h1>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {isNew ? "Registro de nuevo cliente" : `slug: ${form.slug}`}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">

        {/* ── Section: Company info ──────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-6 space-y-4"
        >
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-4 h-4 text-violet-500" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Información de la empresa
            </h2>
          </div>

          <InputField
            label="Nombre"
            value={form.name}
            onChange={handleNameChange}
            placeholder="Ferretería Central SpA"
            required
            error={errors.name}
          />
          <InputField
            label="Slug (URL-safe)"
            value={form.slug}
            onChange={(v) => set("slug", v.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
            placeholder="ferreteria-central"
            required
            hint="Solo letras minúsculas, números y guiones"
            error={errors.slug}
          />
          <InputField
            label="RUT empresa"
            value={form.taxId}
            onChange={(v) => set("taxId", v)}
            placeholder="76.543.210-K"
            hint="Opcional"
          />

          {/* Active toggle (only for editing) */}
          {!isNew && (
            <div className="flex items-center justify-between pt-1">
              <div>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Estado de la empresa
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Los usuarios de empresas inactivas no pueden ingresar
                </p>
              </div>
              <button
                onClick={() => set("isActive", !form.isActive)}
                className={cn(
                  "relative w-11 h-6 rounded-full transition-all duration-300",
                  form.isActive ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm",
                    "transition-all duration-300",
                    form.isActive ? "left-[22px]" : "left-0.5"
                  )}
                />
              </button>
            </div>
          )}
        </motion.div>

        {/* ── Section: SQL Server ────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="card p-6 space-y-4"
        >
          <div className="flex items-center gap-2 mb-1">
            <Server className="w-4 h-4 text-blue-500" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Conexión SQL Server (INET ERP)
            </h2>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <InputField
                label="Servidor"
                value={form.dbServer}
                onChange={(v) => set("dbServer", v)}
                placeholder="192.168.1.100"
                required
                error={errors.dbServer}
              />
            </div>
            <InputField
              label="Puerto"
              value={form.dbPort}
              onChange={(v) => set("dbPort", v)}
              placeholder="1433"
              error={errors.dbPort}
            />
          </div>

          <InputField
            label="Base de datos"
            value={form.dbDatabase}
            onChange={(v) => set("dbDatabase", v)}
            placeholder="INET_STD"
            required
            error={errors.dbDatabase}
          />

          <div className="grid grid-cols-2 gap-3">
            <InputField
              label="Usuario SQL"
              value={form.dbUser}
              onChange={(v) => set("dbUser", v)}
              placeholder="sa"
              required
              error={errors.dbUser}
            />
            {/* Password with eye toggle */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                Contraseña{isNew && <span className="text-red-500 ml-0.5">*</span>}
                {!isNew && <span className="text-slate-400 font-normal ml-1">(dejar vacío = no cambiar)</span>}
              </label>
              <div className="relative flex">
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.dbPassword}
                  onChange={(e) => set("dbPassword", e.target.value)}
                  placeholder={isNew ? "Contraseña SQL" : "••••••••"}
                  autoComplete="new-password"
                  className={cn(
                    "flex-1 border rounded-xl rounded-r-none px-3.5 py-2.5 text-sm",
                    "bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400",
                    "focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-400",
                    "dark:border-slate-700 transition-all duration-200",
                    errors.dbPassword ? "border-red-400" : "border-slate-200"
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="border border-l-0 border-slate-200 dark:border-slate-700
                             rounded-xl rounded-l-none px-3 text-slate-400
                             hover:text-slate-600 dark:hover:text-slate-300
                             bg-white dark:bg-slate-900 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.dbPassword && (
                <p className="text-[11px] text-red-500 mt-1">{errors.dbPassword}</p>
              )}
            </div>
          </div>

          {/* Encrypt toggle */}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={() => set("dbEncrypt", !form.dbEncrypt)}
              className={cn(
                "relative w-9 h-5 rounded-full transition-all duration-300 flex-shrink-0",
                form.dbEncrypt ? "bg-blue-500" : "bg-slate-300 dark:bg-slate-600"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm",
                  "transition-all duration-300",
                  form.dbEncrypt ? "left-[18px]" : "left-0.5"
                )}
              />
            </button>
            <span className="text-xs text-slate-600 dark:text-slate-400">
              Cifrar conexión TLS (Encrypt=true)
            </span>
          </div>

          {/* Test connection button — only for existing tenants */}
          {!isNew && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleTest}
                  disabled={testing}
                  className="flex items-center gap-2 border border-slate-200 dark:border-slate-700
                             text-slate-600 dark:text-slate-300 text-sm font-medium px-4 py-2
                             rounded-xl hover:border-teal-400 hover:text-teal-600
                             dark:hover:border-teal-500 dark:hover:text-teal-400
                             transition-all duration-200 disabled:opacity-50"
                >
                  {testing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Server className="w-4 h-4" />
                  )}
                  Probar conexión
                </button>
                <AnimatePresence>
                  {pingResult && (
                    <motion.div
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      className={cn(
                        "flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl",
                        pingResult.success
                          ? "bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400"
                          : "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400"
                      )}
                    >
                      {pingResult.success ? (
                        <Wifi className="w-3.5 h-3.5" />
                      ) : (
                        <WifiOff className="w-3.5 h-3.5" />
                      )}
                      {pingResult.message}
                      {pingResult.ms && ` · ${pingResult.ms}ms`}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </motion.div>

        {/* ── Section: Enabled modules ───────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card overflow-hidden"
        >
          <button
            onClick={() => setShowModules(!showModules)}
            className="w-full flex items-center justify-between p-5 hover:bg-slate-50
                       dark:hover:bg-slate-800/40 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-violet-500" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Módulos habilitados
              </h2>
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
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: "auto" }}
                exit={{ height: 0 }}
                className="overflow-hidden"
              >
                <div className="px-5 pb-5">
                  {/* Quick select buttons */}
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={() => set("enabledModules", ALL_MODULE_PREFIXES)}
                      className="text-xs font-medium text-violet-600 dark:text-violet-400
                                 hover:underline"
                    >
                      Seleccionar todos
                    </button>
                    <span className="text-slate-300 dark:text-slate-600">|</span>
                    <button
                      onClick={() => set("enabledModules", [])}
                      className="text-xs font-medium text-slate-500 hover:underline"
                    >
                      Deseleccionar todos
                    </button>
                    <span className="text-slate-300 dark:text-slate-600">|</span>
                    <button
                      onClick={() => set("enabledModules", DEFAULT_MODULES)}
                      className="text-xs font-medium text-slate-500 hover:underline"
                    >
                      Predeterminados
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {ERP_MODULES.map((mod) => {
                      const enabled = form.enabledModules.includes(mod.prefix);
                      return (
                        <button
                          key={mod.prefix}
                          onClick={() => toggleModule(mod.prefix)}
                          className={cn(
                            "flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left",
                            "transition-all duration-150",
                            enabled
                              ? "border-violet-300 dark:border-violet-500/50 bg-violet-50 dark:bg-violet-500/10"
                              : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                          )}
                        >
                          <div
                            className={cn(
                              "w-2 h-2 rounded-full flex-shrink-0",
                              enabled ? "bg-violet-500" : "bg-slate-300 dark:bg-slate-600"
                            )}
                            style={enabled ? { backgroundColor: mod.color } : {}}
                          />
                          <div className="min-w-0">
                            <p className={cn(
                              "text-[11px] font-semibold truncate",
                              enabled
                                ? "text-slate-900 dark:text-white"
                                : "text-slate-500 dark:text-slate-400"
                            )}>
                              {mod.prefix}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">{mod.name}</p>
                          </div>
                          {enabled && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-violet-500 flex-shrink-0 ml-auto" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {errors.enabledModules && (
                    <p className="text-[11px] text-red-500 mt-2 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {errors.enabledModules}
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── Save / error ───────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex items-center justify-between gap-4 pb-8"
        >
          <button
            onClick={() => router.push("/super-admin")}
            className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300
                       transition-colors"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-3">
            <AnimatePresence>
              {saveError && (
                <motion.div
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  {saveError}
                </motion.div>
              )}
              {saveOk && (
                <motion.div
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Guardado correctamente
                </motion.div>
              )}
            </AnimatePresence>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white
                         text-sm font-semibold px-5 py-2.5 rounded-xl transition-all duration-200
                         shadow-sm hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : saveOk ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isNew ? "Crear empresa" : "Guardar cambios"}
            </button>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
