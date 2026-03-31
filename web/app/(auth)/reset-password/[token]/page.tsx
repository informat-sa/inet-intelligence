"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Eye, EyeOff, Lock, CheckCircle2,
  ArrowLeft, ShieldAlert, Loader2, XCircle,
} from "lucide-react";
import { validateResetToken, resetPassword } from "@/lib/api";
import { cn } from "@/lib/utils";

// ── Password strength ─────────────────────────────────────────────────────────
function strengthScore(pw: string): 0 | 1 | 2 | 3 | 4 {
  let s = 0;
  if (pw.length >= 8)          s++;
  if (pw.length >= 12)         s++;
  if (/[A-Z]/.test(pw))        s++;
  if (/[0-9]/.test(pw))        s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 4) as 0 | 1 | 2 | 3 | 4;
}
const STRENGTH_LABELS = ["", "Débil", "Regular", "Buena", "Excelente"];
const STRENGTH_COLORS = ["", "bg-red-500", "bg-amber-500", "bg-blue-500", "bg-emerald-500"];
const STRENGTH_TEXT   = ["", "text-red-400", "text-amber-400", "text-blue-400", "text-emerald-400"];

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const router    = useRouter();

  type Stage = "validating" | "invalid" | "form" | "loading" | "success";
  const [stage, setStage]         = useState<Stage>("validating");
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [showPw, setShowPw]       = useState(false);
  const [showCf, setShowCf]       = useState(false);
  const [errorMsg, setErrorMsg]   = useState("");

  // Validate token on mount
  useEffect(() => {
    if (!token) { setStage("invalid"); return; }
    validateResetToken(token)
      .then(({ valid }) => setStage(valid ? "form" : "invalid"))
      .catch(() => setStage("invalid"));
  }, [token]);

  const score   = strengthScore(password);
  const matchOk = password.length > 0 && password === confirm;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!matchOk)   { setErrorMsg("Las contraseñas no coinciden."); return; }
    if (score < 2)  { setErrorMsg("La contraseña es muy débil."); return; }
    setErrorMsg("");
    setStage("loading");
    try {
      await resetPassword(token, password);
      setStage("success");
      setTimeout(() => router.push("/login"), 2500);
    } catch (err: any) {
      setErrorMsg(err.message ?? "Error al restablecer la contraseña.");
      setStage("form");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-brand-navy to-slate-900
                    flex items-center justify-center p-6">
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

            {/* ── Validating ─────────────────────────────────────────── */}
            {stage === "validating" && (
              <motion.div key="validating"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-10 gap-4">
                <Loader2 className="w-8 h-8 text-brand-blue animate-spin" />
                <p className="text-slate-400 text-sm">Verificando enlace…</p>
              </motion.div>
            )}

            {/* ── Invalid token ──────────────────────────────────────── */}
            {stage === "invalid" && (
              <motion.div key="invalid"
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                className="text-center py-4">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 bg-red-500/15 rounded-full flex items-center justify-center">
                    <ShieldAlert className="w-8 h-8 text-red-400" />
                  </div>
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Enlace inválido</h2>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">
                  Este enlace ya no es válido o ha expirado.
                  Los enlaces de recuperación duran{" "}
                  <strong className="text-slate-300">1 hora</strong>.
                </p>
                <Link href="/forgot-password"
                  className="inline-flex items-center gap-2 bg-brand-blue hover:bg-brand-navy
                             text-white text-sm font-semibold px-5 py-2.5 rounded-xl
                             transition-all duration-200 shadow-glow">
                  Solicitar nuevo enlace
                </Link>
                <div className="mt-5">
                  <Link href="/login"
                    className="inline-flex items-center gap-1.5 text-sm text-slate-400
                               hover:text-white transition-colors">
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Volver al inicio de sesión
                  </Link>
                </div>
              </motion.div>
            )}

            {/* ── Form ───────────────────────────────────────────────── */}
            {stage === "form" && (
              <motion.div key="form"
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-white mb-1">Nueva contraseña</h2>
                  <p className="text-slate-400 text-sm">Elige una contraseña segura para tu cuenta.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Password */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Contraseña nueva
                    </label>
                    <div className="relative flex">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                      <input
                        type={showPw ? "text" : "password"}
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setErrorMsg(""); }}
                        placeholder="Mínimo 8 caracteres"
                        required autoFocus autoComplete="new-password"
                        className="flex-1 bg-slate-800 border border-slate-600 rounded-xl rounded-r-none
                                   pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-500
                                   focus:outline-none focus:ring-2 focus:ring-brand-blue/60
                                   focus:border-brand-blue transition-all [color-scheme:dark]"
                      />
                      <button type="button" onClick={() => setShowPw(!showPw)}
                        className="bg-slate-800 border border-l-0 border-slate-600 rounded-xl
                                   rounded-l-none px-3 text-slate-500 hover:text-slate-300 transition-colors">
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {/* Strength bar */}
                    {password.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <div className="flex gap-1">
                          {[1, 2, 3, 4].map((i) => (
                            <div key={i}
                              className={cn(
                                "flex-1 h-1 rounded-full transition-all duration-300",
                                score >= i ? STRENGTH_COLORS[score] : "bg-slate-700"
                              )} />
                          ))}
                        </div>
                        <p className={cn("text-[11px] font-medium", STRENGTH_TEXT[score])}>
                          {STRENGTH_LABELS[score]}
                          {score < 2 && " — agrega mayúsculas, números o símbolos"}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Confirm */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Confirmar contraseña
                    </label>
                    <div className="relative flex">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                      <input
                        type={showCf ? "text" : "password"}
                        value={confirm}
                        onChange={(e) => { setConfirm(e.target.value); setErrorMsg(""); }}
                        placeholder="Repetir contraseña"
                        required autoComplete="new-password"
                        className={cn(
                          "flex-1 bg-slate-800 border rounded-xl rounded-r-none pl-10 pr-4 py-3",
                          "text-sm text-white placeholder:text-slate-500 focus:outline-none",
                          "focus:ring-2 transition-all [color-scheme:dark]",
                          confirm.length > 0
                            ? matchOk
                              ? "border-emerald-500 focus:ring-emerald-500/30"
                              : "border-red-500/70 focus:ring-red-500/30"
                            : "border-slate-600 focus:ring-brand-blue/60 focus:border-brand-blue"
                        )}
                      />
                      <button type="button" onClick={() => setShowCf(!showCf)}
                        className="bg-slate-800 border border-l-0 border-slate-600 rounded-xl
                                   rounded-l-none px-3 text-slate-500 hover:text-slate-300 transition-colors">
                        {showCf ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {confirm.length > 0 && !matchOk && (
                      <p className="text-[11px] text-red-400 mt-1">Las contraseñas no coinciden</p>
                    )}
                    {matchOk && (
                      <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Las contraseñas coinciden
                      </p>
                    )}
                  </div>

                  {/* Error */}
                  <AnimatePresence>
                    {errorMsg && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-center gap-2 text-red-400 text-xs
                                   bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3"
                      >
                        <XCircle className="w-3.5 h-3.5 flex-shrink-0" />{errorMsg}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button
                    type="submit"
                    disabled={!matchOk || score < 1}
                    className="w-full bg-brand-blue hover:bg-brand-navy text-white font-semibold
                               py-3.5 rounded-xl transition-all duration-200 mt-2
                               shadow-[0_0_20px_rgba(46,117,182,0.4)]
                               hover:shadow-[0_0_32px_rgba(46,117,182,0.6)]
                               disabled:opacity-40 disabled:cursor-not-allowed
                               flex items-center justify-center gap-2">
                    <Lock className="w-4 h-4" />
                    Restablecer contraseña
                  </button>
                </form>

                <div className="mt-6 pt-5 border-t border-slate-700/60 text-center">
                  <Link href="/login"
                    className="inline-flex items-center gap-1.5 text-sm text-slate-400
                               hover:text-white transition-colors">
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Volver al inicio de sesión
                  </Link>
                </div>
              </motion.div>
            )}

            {/* ── Loading ────────────────────────────────────────────── */}
            {stage === "loading" && (
              <motion.div key="loading"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-10 gap-4">
                <Loader2 className="w-8 h-8 text-brand-blue animate-spin" />
                <p className="text-slate-400 text-sm">Actualizando contraseña…</p>
              </motion.div>
            )}

            {/* ── Success ────────────────────────────────────────────── */}
            {stage === "success" && (
              <motion.div key="success"
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="text-center py-4">
                <motion.div
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
                  className="flex justify-center mb-4"
                >
                  <div className="w-16 h-16 bg-emerald-500/15 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  </div>
                </motion.div>
                <h2 className="text-xl font-bold text-white mb-2">¡Listo!</h2>
                <p className="text-slate-400 text-sm leading-relaxed mb-2">
                  Tu contraseña fue actualizada correctamente.
                </p>
                <p className="text-slate-500 text-xs mb-6">Redirigiendo al inicio de sesión…</p>
                <Link href="/login"
                  className="inline-flex items-center gap-2 text-brand-mid hover:text-white
                             text-sm transition-colors font-medium">
                  <ArrowLeft className="w-4 h-4" />
                  Ir al inicio de sesión ahora
                </Link>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
