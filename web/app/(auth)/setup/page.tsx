"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Sparkles, Building, User, Lock, ArrowRight, CheckCircle2, Info } from "lucide-react";
import { login } from "@/lib/api";
import { useChatStore } from "@/store/chat";
import type { User as UserType } from "@/types";

interface SetupForm {
  companyName: string;
  adminName: string;
  adminEmail: string;
  password: string;
  confirmPassword: string;
}

export default function SetupPage() {
  const router = useRouter();
  const { setUser } = useChatStore();

  const [form, setForm] = useState<SetupForm>({
    companyName: "",
    adminName: "",
    adminEmail: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Check if we're in demo mode (setup-check returns demoMode: true)
  useState(() => {
    fetch("/api/auth/setup-check")
      .then((r) => r.json())
      .then((d) => {
        if (d.demoMode || !d.needsSetup) setIsDemoMode(true);
      })
      .catch(() => setIsDemoMode(true));
  });

  function update(key: keyof SetupForm, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    if (error) setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (form.password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    setLoading(true);
    try {
      if (isDemoMode) {
        // Demo mode: just log in with the provided credentials
        const { access_token, user: p } = await login(form.adminEmail, form.password);
        const user: UserType = {
          id:         p.sub ?? "demo-user-id",
          name:       form.adminName || (p.name ?? form.adminEmail.split("@")[0]),
          email:      form.adminEmail,
          empresa:    form.companyName || (p.tenantName ?? "Mi Empresa"),
          role:       "admin",
          modules:    p.allowedModules ?? [],
          tenantId:   p.tenantId ?? null,
          tenantSlug: p.tenantSlug ?? "demo",
        };
        localStorage.setItem("inet_token", access_token);
        setUser(user);
        router.push("/dashboard");
      } else {
        // Real mode: POST /auth/setup to create first super_admin
        const res = await fetch("/api/auth/setup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyName: form.companyName,
            adminName:   form.adminName,
            adminEmail:  form.adminEmail,
            password:    form.password,
          }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({})) as { message?: string };
          throw new Error(d.message ?? "Error al configurar el sistema");
        }
        // After setup, log in
        const { access_token, user: p } = await login(form.adminEmail, form.password);
        const user: UserType = {
          id:         p.sub,
          name:       form.adminName,
          email:      form.adminEmail,
          empresa:    form.companyName,
          role:       "super_admin",
          modules:    p.allowedModules ?? [],
          tenantId:   p.tenantId ?? null,
          tenantSlug: p.tenantSlug ?? "main",
        };
        localStorage.setItem("inet_token", access_token);
        setUser(user);
        router.push("/dashboard");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-navy via-brand-blue to-sky-500
                    flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl
                          flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">I-NET Intelligence</h1>
          <p className="text-white/70 text-sm mt-1">
            {isDemoMode ? "Acceso demo — ingresa con cualquier credencial" : "Configura tu workspace"}
          </p>
        </div>

        {/* Demo mode notice */}
        {isDemoMode && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 flex items-start gap-2.5 bg-white/15 backdrop-blur-sm border
                       border-white/30 text-white text-xs rounded-xl px-4 py-3"
          >
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Modo demo activo.</strong> No hay base de datos configurada.
              Puedes ingresar con cualquier correo y contraseña para explorar la aplicación.
            </span>
          </motion.div>
        )}

        {/* Form card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-8">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6">
            {isDemoMode ? "Comenzar demo" : "Crear cuenta de administrador"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Company name */}
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                Nombre de la empresa
              </label>
              <div className="relative">
                <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={form.companyName}
                  onChange={(e) => update("companyName", e.target.value)}
                  placeholder={isDemoMode ? "Empresa Demo SpA" : "Mi Empresa Ltda."}
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 dark:border-slate-700
                             rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white
                             placeholder:text-slate-400 focus:outline-none focus:ring-2
                             focus:ring-brand-blue/30 focus:border-brand-blue transition-all"
                />
              </div>
            </div>

            {/* Admin name */}
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                Tu nombre
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={form.adminName}
                  onChange={(e) => update("adminName", e.target.value)}
                  placeholder="Nombre Apellido"
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 dark:border-slate-700
                             rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white
                             placeholder:text-slate-400 focus:outline-none focus:ring-2
                             focus:ring-brand-blue/30 focus:border-brand-blue transition-all"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                Correo electrónico
              </label>
              <input
                type="email"
                required
                value={form.adminEmail}
                onChange={(e) => update("adminEmail", e.target.value)}
                placeholder={isDemoMode ? "cualquier@correo.cl" : "admin@miempresa.cl"}
                className="w-full px-4 py-2.5 text-sm border border-slate-200 dark:border-slate-700
                           rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white
                           placeholder:text-slate-400 focus:outline-none focus:ring-2
                           focus:ring-brand-blue/30 focus:border-brand-blue transition-all"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  required
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  placeholder={isDemoMode ? "cualquier contraseña" : "Mínimo 8 caracteres"}
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 dark:border-slate-700
                             rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white
                             placeholder:text-slate-400 focus:outline-none focus:ring-2
                             focus:ring-brand-blue/30 focus:border-brand-blue transition-all"
                />
              </div>
            </div>

            {/* Confirm password */}
            {!isDemoMode && (
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                  Confirmar contraseña
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={form.confirmPassword}
                    onChange={(e) => update("confirmPassword", e.target.value)}
                    placeholder="Repite la contraseña"
                    className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 dark:border-slate-700
                               rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white
                               placeholder:text-slate-400 focus:outline-none focus:ring-2
                               focus:ring-brand-blue/30 focus:border-brand-blue transition-all"
                  />
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10
                            border border-red-200 dark:border-red-500/30 rounded-xl px-4 py-2.5">
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !form.adminEmail || !form.password}
              className="w-full flex items-center justify-center gap-2 bg-brand-blue hover:bg-brand-navy
                         disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold
                         py-3 rounded-xl transition-all duration-200 shadow-sm hover:shadow-glow mt-2"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : isDemoMode ? (
                <>Explorar demo <ArrowRight className="w-4 h-4" /></>
              ) : (
                <>Crear workspace <CheckCircle2 className="w-4 h-4" /></>
              )}
            </button>
          </form>

          {/* Back to login */}
          <p className="text-center text-xs text-slate-400 mt-5">
            ¿Ya tienes cuenta?{" "}
            <button
              onClick={() => router.push("/login")}
              className="text-brand-blue hover:underline font-medium"
            >
              Iniciar sesión
            </button>
          </p>
        </div>

        {/* Features strip */}
        {!isDemoMode && (
          <div className="grid grid-cols-3 gap-3 mt-6">
            {[
              { label: "19 módulos ERP", sub: "Todos incluidos" },
              { label: "Multi-usuario", sub: "Roles y permisos" },
              { label: "Tiempo real", sub: "SQL en segundos" },
            ].map(({ label, sub }) => (
              <div key={label} className="text-center">
                <div className="text-white font-semibold text-sm">{label}</div>
                <div className="text-white/60 text-[10px] mt-0.5">{sub}</div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
