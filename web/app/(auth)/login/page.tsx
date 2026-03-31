"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye, EyeOff, Sparkles, TrendingUp, Package, CreditCard,
  Users, Building2, AlertCircle, WifiOff, Clock, ShieldOff,
  Mail, Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/store/chat";
import { login } from "@/lib/api";
import type { User } from "@/types";

// ── Demo content ──────────────────────────────────────────────────────────────
const DEMO_MODULES = [
  { icon: TrendingUp, label: "Ventas",      color: "text-sky-500"    },
  { icon: Package,    label: "Inventario",  color: "text-violet-500" },
  { icon: CreditCard, label: "Cobranzas",   color: "text-amber-500"  },
  { icon: Users,      label: "RRHH",        color: "text-pink-500"   },
  { icon: Building2,  label: "Activo Fijo", color: "text-orange-500" },
];

const DEMO_QUESTIONS = [
  "¿Cuánto vendí este mes vs el año pasado?",
  "¿Qué clientes tienen deuda vencida mayor a 90 días?",
  "¿Qué productos están bajo el stock mínimo?",
  "¿Cuál fue el costo total de remuneraciones?",
  "¿Cuántas facturas electrónicas emití hoy?",
];

// ── Error classification ───────────────────────────────────────────────────────
interface LoginError {
  message: string;
  icon: React.ElementType;
  type: "credentials" | "inactive" | "ratelimit" | "network" | "generic";
}

function classifyError(err: unknown): LoginError {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  if (lower.includes("429") || lower.includes("too many") || lower.includes("throttl")) {
    return {
      message: "Demasiados intentos fallidos. Espera unos minutos antes de reintentar.",
      icon: Clock,
      type: "ratelimit",
    };
  }
  if (lower.includes("inactiv") || lower.includes("desactivad") || lower.includes("403")) {
    return {
      message: "Tu cuenta está inactiva. Contacta al administrador de tu empresa.",
      icon: ShieldOff,
      type: "inactive",
    };
  }
  if (
    lower.includes("401") || lower.includes("credencial") ||
    lower.includes("unauthorized") || lower.includes("contraseña") ||
    lower.includes("incorrect") || lower.includes("invalid")
  ) {
    return {
      message: "Correo o contraseña incorrectos. Verifica tus datos e inténtalo de nuevo.",
      icon: AlertCircle,
      type: "credentials",
    };
  }
  if (
    lower.includes("fetch") || lower.includes("network") ||
    lower.includes("failed to fetch") || lower.includes("econnrefused")
  ) {
    return {
      message: "Sin conexión al servidor. Verifica tu red e intenta nuevamente.",
      icon: WifiOff,
      type: "network",
    };
  }
  return {
    message: "Error al iniciar sesión. Intenta nuevamente.",
    icon: AlertCircle,
    type: "generic",
  };
}

// ── Shake animation variant ───────────────────────────────────────────────────
const shakeVariant = {
  idle:  { x: 0 },
  shake: {
    x: [0, -10, 10, -8, 8, -5, 5, 0],
    transition: { duration: 0.5, ease: "easeInOut" },
  },
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter();
  const { setUser, setAccessibleTenants } = useChatStore();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<LoginError | null>(null);
  const [shake,    setShake]    = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [demoIdx,  setDemoIdx]  = useState(0);

  const emailRef    = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Auto-focus email on mount; restore last-used email
  useEffect(() => {
    const saved = localStorage.getItem("inet_last_email");
    if (saved) {
      setEmail(saved);
      passwordRef.current?.focus();
    } else {
      emailRef.current?.focus();
    }
  }, []);

  // Rotate demo questions
  useEffect(() => {
    const id = setInterval(() => setDemoIdx((i) => (i + 1) % DEMO_QUESTIONS.length), 3200);
    return () => clearInterval(id);
  }, []);

  // Caps Lock detection on password field
  function handleKeyEvent(e: React.KeyboardEvent) {
    setCapsLock(e.getModifierState("CapsLock"));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { access_token, user: payload, accessibleTenants } = await login(email, password);

      const p = payload as {
        sub: string; email: string; role: string;
        tenantId: string | null; tenantSlug: string | null; tenantName: string | null;
        allowedModules: string[]; name?: string; empresa?: string; modules?: string[];
      };

      const user: User = {
        id:         p.sub,
        name:       p.name ?? email.split("@")[0],
        email:      p.email,
        empresa:    p.empresa ?? p.tenantName ?? "I-NET Intelligence",
        tenantId:   p.tenantId,
        tenantSlug: p.tenantSlug,
        role:       p.role as User["role"],
        modules:    p.modules ?? p.allowedModules ?? [],
      };

      // Persist email for next visit
      localStorage.setItem("inet_last_email", email);
      localStorage.setItem("inet_token", access_token);
      setUser(user);
      setAccessibleTenants(accessibleTenants ?? []);

      if ((accessibleTenants ?? []).length > 1) {
        router.push("/select-company");
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      const classified = classifyError(err);
      setError(classified);

      // Shake the card + clear password on wrong credentials
      setShake(true);
      setTimeout(() => setShake(false), 600);

      if (classified.type === "credentials") {
        setPassword("");
        setTimeout(() => passwordRef.current?.focus(), 50);
      }
    } finally {
      setLoading(false);
    }
  }

  // Whether to highlight inputs in error state
  const inputError = error?.type === "credentials";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-brand-navy to-slate-900 flex">

      {/* ── LEFT: Branding panel (desktop only) ──────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between w-[52%] p-16 relative overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-blue/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -right-20 w-80 h-80 bg-brand-blue/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px]
                          bg-brand-navy/30 rounded-full blur-3xl" />
          <svg className="absolute inset-0 opacity-5" width="100%" height="100%">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Logo */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-blue rounded-xl flex items-center justify-center shadow-glow">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-white font-bold text-xl leading-none">I-NET Intelligence</div>
              <div className="text-brand-mid text-xs font-medium mt-0.5">by Informat</div>
            </div>
          </div>
        </motion.div>

        {/* Headline + demo */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="relative z-10"
        >
          <h1 className="text-5xl font-extrabold text-white leading-tight mb-6">
            Sé el primero
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-brand-mid to-brand-blue">
              en saberlo.
            </span>
          </h1>
          <p className="text-slate-300 text-lg leading-relaxed mb-10 max-w-md">
            Hazle la pregunta y tu INET responde en segundos.<br />
            Los datos de tu empresa, directamente contigo.
          </p>

          {/* Rotating question */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 max-w-md">
            <div className="text-xs text-slate-400 font-medium mb-3 flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              Ejemplo de consulta
            </div>
            <AnimatePresence mode="wait">
              <motion.p
                key={demoIdx}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="text-white font-medium text-base"
              >
                &ldquo;{DEMO_QUESTIONS[demoIdx]}&rdquo;
              </motion.p>
            </AnimatePresence>
            <div className="mt-4 flex items-center gap-2 text-xs text-brand-mid">
              <Sparkles className="w-3 h-3" />
              Respuesta en segundos, con datos reales de tu INET
            </div>
          </div>

          {/* Module chips */}
          <div className="flex flex-wrap gap-2 mt-6">
            {DEMO_MODULES.map(({ icon: Icon, label, color }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 + i * 0.08 }}
                className="flex items-center gap-1.5 bg-white/8 backdrop-blur-sm border border-white/10
                           px-3 py-1.5 rounded-full text-xs text-slate-200 font-medium"
              >
                <Icon className={cn("w-3 h-3", color)} />
                {label}
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="relative z-10 text-xs text-slate-500"
        >
          Informat — ERP desde 1974 · I-NET Intelligence © 2026
        </motion.div>
      </div>

      {/* ── RIGHT: Login form ─────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-brand-blue rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-white font-bold text-lg">I-NET Intelligence</div>
              <div className="text-brand-mid text-xs">by Informat</div>
            </div>
          </div>

          {/* Form card with shake animation */}
          <motion.div
            variants={shakeVariant}
            animate={shake ? "shake" : "idle"}
            className="bg-slate-900 border border-slate-700/60 rounded-3xl p-8 shadow-2xl"
          >
            <h2 className="text-2xl font-bold text-white mb-1">Bienvenido</h2>
            <p className="text-slate-400 text-sm mb-8">Ingresa con tus credenciales de I-NET</p>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Correo electrónico
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500
                                   pointer-events-none" />
                  <input
                    ref={emailRef}
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(null); }}
                    placeholder="usuario@empresa.cl"
                    required
                    autoComplete="email"
                    className={cn(
                      "w-full bg-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white",
                      "placeholder:text-slate-500 focus:outline-none transition-all duration-200",
                      "[color-scheme:dark]",
                      inputError
                        ? "border-2 border-red-500/70 focus:ring-2 focus:ring-red-500/30"
                        : "border border-slate-600 focus:ring-2 focus:ring-brand-blue/60 focus:border-brand-blue"
                    )}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Contraseña
                  </label>
                  <a
                    href="/forgot-password"
                    className="text-xs text-brand-mid hover:text-white transition-colors"
                  >
                    ¿Olvidaste tu contraseña?
                  </a>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500
                                   pointer-events-none" />
                  <input
                    ref={passwordRef}
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(null); }}
                    onKeyDown={handleKeyEvent}
                    onKeyUp={handleKeyEvent}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    className={cn(
                      "w-full bg-slate-800 rounded-xl pl-10 pr-12 py-3 text-sm text-white",
                      "placeholder:text-slate-500 focus:outline-none transition-all duration-200",
                      "[color-scheme:dark]",
                      inputError
                        ? "border-2 border-red-500/70 focus:ring-2 focus:ring-red-500/30"
                        : "border border-slate-600 focus:ring-2 focus:ring-brand-blue/60 focus:border-brand-blue"
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400
                               hover:text-slate-200 transition-colors"
                    tabIndex={-1}
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Caps Lock warning */}
                <AnimatePresence>
                  {capsLock && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-[11px] text-amber-400 mt-1.5 flex items-center gap-1"
                    >
                      <span className="font-bold">⇪</span> Mayúsculas activadas
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Error banner */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className={cn(
                      "flex items-start gap-3 text-xs rounded-xl px-4 py-3 border",
                      error.type === "ratelimit"
                        ? "bg-amber-500/10 border-amber-500/25 text-amber-300"
                        : error.type === "network"
                          ? "bg-slate-700/50 border-slate-600 text-slate-300"
                          : error.type === "inactive"
                            ? "bg-orange-500/10 border-orange-500/25 text-orange-300"
                            : "bg-red-500/10 border-red-500/20 text-red-300"
                    )}
                  >
                    <error.icon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{error.message}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full bg-brand-blue hover:bg-brand-navy text-white font-semibold
                           py-3.5 rounded-xl transition-all duration-200 mt-2
                           shadow-[0_0_20px_rgba(46,117,182,0.4)]
                           hover:shadow-[0_0_32px_rgba(46,117,182,0.6)]
                           disabled:opacity-50 disabled:cursor-not-allowed
                           flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Ingresar
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-700/60 text-center">
              <p className="text-xs text-slate-500">
                ¿Problemas para acceder?{" "}
                <a href="mailto:soporte@informat.cl" className="text-brand-mid hover:text-white transition-colors">
                  Contacta a soporte
                </a>
              </p>
            </div>
          </motion.div>

          <p className="text-center text-xs text-slate-600 mt-6">
            Tus datos nunca salen de los servidores de Informat
          </p>
        </motion.div>
      </div>
    </div>
  );
}
