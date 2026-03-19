"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Sparkles, TrendingUp, Package, CreditCard, Users, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/store/chat";

const DEMO_MODULES = [
  { icon: TrendingUp, label: "Ventas", color: "text-sky-500" },
  { icon: Package, label: "Inventario", color: "text-violet-500" },
  { icon: CreditCard, label: "Cobranzas", color: "text-amber-500" },
  { icon: Users, label: "RRHH", color: "text-pink-500" },
  { icon: Building2, label: "Activo Fijo", color: "text-orange-500" },
];

const DEMO_QUESTIONS = [
  "¿Cuánto vendí este mes vs el año pasado?",
  "¿Qué clientes tienen deuda vencida mayor a 90 días?",
  "¿Qué productos están bajo el stock mínimo?",
  "¿Cuál fue el costo total de remuneraciones?",
  "¿Cuántas facturas electrónicas emití hoy?",
];

export default function LoginPage() {
  const router = useRouter();
  const setUser = useChatStore((s) => s.setUser);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [demoIdx, setDemoIdx] = useState(0);

  // Rotate demo questions
  useState(() => {
    const id = setInterval(() => setDemoIdx((i) => (i + 1) % DEMO_QUESTIONS.length), 3000);
    return () => clearInterval(id);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // Demo login — replace with real API call
      await new Promise((r) => setTimeout(r, 800));
      if (email && password) {
        setUser({
          id: "u1",
          name: email.split("@")[0].replace(/\./g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          email,
          empresa: "Empresa Demo SpA",
          empresaId: "EMP001",
          role: "admin",
          modules: [],
        });
        localStorage.setItem("inet_token", "demo_token");
        router.push("/dashboard");
      } else {
        setError("Ingresa tu correo y contraseña.");
      }
    } catch {
      setError("Error al iniciar sesión. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-brand-navy to-slate-900 flex">
      {/* ── LEFT: Branding / Demo panel ── */}
      <div className="hidden lg:flex flex-col justify-between w-[52%] p-16 relative overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-blue/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -right-20 w-80 h-80 bg-brand-blue/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-navy/30 rounded-full blur-3xl" />
          {/* Grid pattern */}
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
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10"
        >
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

        {/* Main headline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="relative z-10"
        >
          <h1 className="text-5xl font-extrabold text-white leading-tight mb-6">
            Pregúntale a tu
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-brand-mid to-brand-blue">
              ERP en español
            </span>
          </h1>
          <p className="text-slate-300 text-lg leading-relaxed mb-10 max-w-md">
            50 años de datos de tu empresa, accesibles con una pregunta. Sin SQL, sin reportes, sin esperar.
          </p>

          {/* Rotating question demo */}
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
              Respuesta en segundos, con datos reales de tu ERP
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

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="relative z-10 text-xs text-slate-500"
        >
          Informat — ERP desde 1974 · I-NET Intelligence © 2026
        </motion.div>
      </div>

      {/* ── RIGHT: Login form ── */}
      <div className="flex-1 flex items-center justify-center p-8">
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

          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-1">Bienvenido</h2>
            <p className="text-slate-400 text-sm mb-8">Ingresa con tus credenciales de I-NET</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@empresa.cl"
                  required
                  className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3 text-sm
                             text-white placeholder:text-slate-500 focus:outline-none
                             focus:ring-2 focus:ring-brand-blue/50 focus:border-brand-blue
                             transition-all duration-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3 pr-12 text-sm
                               text-white placeholder:text-slate-500 focus:outline-none
                               focus:ring-2 focus:ring-brand-blue/50 focus:border-brand-blue
                               transition-all duration-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400
                               hover:text-slate-200 transition-colors"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-red-400 text-xs bg-red-500/10 border border-red-500/20
                               rounded-xl px-4 py-3"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-blue hover:bg-brand-navy text-white font-semibold
                           py-3.5 rounded-xl transition-all duration-200 mt-2
                           shadow-[0_0_20px_rgba(46,117,182,0.4)]
                           hover:shadow-[0_0_32px_rgba(46,117,182,0.6)]
                           disabled:opacity-60 disabled:cursor-not-allowed
                           flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Ingresando...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Ingresar
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-white/8 text-center">
              <p className="text-xs text-slate-500">
                ¿Problemas para acceder?{" "}
                <a href="mailto:soporte@informat.cl" className="text-brand-mid hover:text-white transition-colors">
                  Contacta a soporte
                </a>
              </p>
            </div>
          </div>

          <p className="text-center text-xs text-slate-600 mt-6">
            Tus datos nunca salen de los servidores de Informat
          </p>
        </motion.div>
      </div>
    </div>
  );
}
