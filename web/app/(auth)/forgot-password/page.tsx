"use client";
import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ArrowLeft, Mail, CheckCircle2 } from "lucide-react";
import { forgotPassword } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch {
      // Even on error we show "sent" to avoid email enumeration
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

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
            {/* ── Estado: email enviado ── */}
            {sent ? (
              <motion.div
                key="sent"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-4"
              >
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 bg-emerald-500/15 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  </div>
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Revisa tu correo</h2>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">
                  Si <span className="text-white font-medium">{email}</span> está registrado,
                  recibirás un enlace para restablecer tu contraseña en los próximos minutos.
                </p>
                <p className="text-slate-500 text-xs mb-6">
                  El enlace expira en <strong className="text-slate-400">1 hora</strong>.
                  Revisa también tu carpeta de spam.
                </p>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 text-brand-mid hover:text-white text-sm
                             transition-colors font-medium"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Volver al inicio de sesión
                </Link>
              </motion.div>
            ) : (
              /* ── Estado: formulario ── */
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-white mb-1">¿Olvidaste tu contraseña?</h2>
                  <p className="text-slate-400 text-sm">
                    Ingresa tu correo y te enviaremos un enlace para restablecerla.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Correo electrónico
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="usuario@empresa.cl"
                        required
                        autoFocus
                        className="w-full bg-slate-800 border border-slate-600 rounded-xl pl-10 pr-4 py-3
                                   text-sm text-white placeholder:text-slate-500 focus:outline-none
                                   focus:ring-2 focus:ring-brand-blue/60 focus:border-brand-blue
                                   transition-all duration-200 [color-scheme:dark]"
                      />
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
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4" />
                        Enviar enlace de recuperación
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-6 pt-5 border-t border-slate-700/60 text-center">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1.5 text-sm text-slate-400
                               hover:text-white transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Volver al inicio de sesión
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </motion.div>
    </div>
  );
}
