"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Eye, EyeOff, KeyRound, CheckCircle2, ArrowLeft, ShieldAlert } from "lucide-react";
import { resetPassword } from "@/lib/api";

export default function ResetPasswordPage() {
  const { token }  = useParams<{ token: string }>();
  const router     = useRouter();

  const [password,   setPassword]   = useState("");
  const [password2,  setPassword2]  = useState("");
  const [showPass,   setShowPass]   = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [done,       setDone]       = useState(false);
  const [error,      setError]      = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== password2) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
      // Redirect to login after 3 seconds
      setTimeout(() => router.push("/login"), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.toLowerCase().includes("inválido") || msg.toLowerCase().includes("expirado") || msg.includes("404")) {
        setError("Este enlace ya no es válido o ha expirado. Solicita uno nuevo.");
      } else {
        setError("Ocurrió un error. Intenta nuevamente.");
      }
    } finally {
      setLoading(false);
    }
  }

  const isExpiredError = error.includes("enlace ya no es válido");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-brand-navy to-slate-900 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 bg-brand-blue rounded-xl flex items-center justify-center shadow-glow">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-xl leading-none">I-NET Intelligence</div>
            <div className="text-brand-mid text-xs font-medium mt-0.5">by Informat</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-700/60 rounded-3xl p-8 shadow-2xl">
          <AnimatePresence mode="wait">

            {/* ── Éxito ── */}
            {done ? (
              <motion.div
                key="done"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-4"
              >
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 bg-emerald-500/15 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  </div>
                </div>
                <h2 className="text-xl font-bold text-white mb-2">¡Contraseña actualizada!</h2>
                <p className="text-slate-400 text-sm mb-4">
                  Tu contraseña ha sido restablecida correctamente.
                </p>
                <p className="text-slate-500 text-xs">
                  Serás redirigido al login en unos segundos…
                </p>
              </motion.div>

            ) : isExpiredError ? (
              /* ── Token expirado/inválido ── */
              <motion.div
                key="expired"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-4"
              >
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 bg-red-500/15 rounded-full flex items-center justify-center">
                    <ShieldAlert className="w-8 h-8 text-red-400" />
                  </div>
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Enlace no válido</h2>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">
                  Este enlace de recuperación ya expiró o fue utilizado.
                  Los enlaces son válidos por <strong className="text-slate-300">1 hora</strong>.
                </p>
                <a
                  href="/forgot-password"
                  className="inline-flex items-center gap-2 bg-brand-blue hover:bg-brand-navy
                             text-white font-semibold py-2.5 px-5 rounded-xl transition-all
                             text-sm shadow-[0_0_20px_rgba(46,117,182,0.3)]"
                >
                  Solicitar nuevo enlace
                </a>
                <div className="mt-4">
                  <a href="/login" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                    Volver al login
                  </a>
                </div>
              </motion.div>

            ) : (
              /* ── Formulario ── */
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="mb-6">
                  <div className="w-12 h-12 bg-brand-blue/15 rounded-2xl flex items-center justify-center mb-4">
                    <KeyRound className="w-6 h-6 text-brand-blue" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-1">Nueva contraseña</h2>
                  <p className="text-slate-400 text-sm">
                    Elige una contraseña segura para tu cuenta.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Nueva contraseña */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Nueva contraseña
                    </label>
                    <div className="relative">
                      <input
                        type={showPass ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        required
                        autoFocus
                        className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 pr-12
                                   text-sm text-white placeholder:text-slate-500 focus:outline-none
                                   focus:ring-2 focus:ring-brand-blue/60 focus:border-brand-blue
                                   transition-all duration-200 [color-scheme:dark]"
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

                  {/* Confirmar contraseña */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Confirmar contraseña
                    </label>
                    <input
                      type={showPass ? "text" : "password"}
                      value={password2}
                      onChange={(e) => setPassword2(e.target.value)}
                      placeholder="Repite la contraseña"
                      required
                      className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3
                                 text-sm text-white placeholder:text-slate-500 focus:outline-none
                                 focus:ring-2 focus:ring-brand-blue/60 focus:border-brand-blue
                                 transition-all duration-200 [color-scheme:dark]"
                    />
                  </div>

                  {/* Password strength hint */}
                  {password.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex gap-1"
                    >
                      {[6, 8, 10, 12].map((len) => (
                        <div
                          key={len}
                          className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                            password.length >= len
                              ? len <= 6 ? "bg-red-500"
                              : len <= 8 ? "bg-amber-500"
                              : len <= 10 ? "bg-blue-500"
                              : "bg-emerald-500"
                              : "bg-slate-700"
                          }`}
                        />
                      ))}
                    </motion.div>
                  )}

                  <AnimatePresence>
                    {error && !isExpiredError && (
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
                        Guardando...
                      </>
                    ) : (
                      <>
                        <KeyRound className="w-4 h-4" />
                        Restablecer contraseña
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-6 pt-5 border-t border-slate-700/60 text-center">
                  <a
                    href="/login"
                    className="inline-flex items-center gap-1.5 text-sm text-slate-400
                               hover:text-white transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Volver al inicio de sesión
                  </a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
