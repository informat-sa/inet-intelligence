"use client";
import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Sparkles, Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";
import { useChatStore } from "@/store/chat";
import { acceptInvite } from "@/lib/api";
import type { User } from "@/types";

interface Props {
  params: Promise<{ token: string }>;
}

export default function InvitePage({ params }: Props) {
  const { token } = use(params);
  const router = useRouter();
  const setUser = useChatStore((s) => s.setUser);

  const [name, setName]           = useState("");
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [showPass, setShowPass]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [success, setSuccess]     = useState(false);

  const passwordOk = password.length >= 8;
  const matchOk    = password === confirm;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordOk || !matchOk) return;
    setError("");
    setLoading(true);

    try {
      const { access_token } = await acceptInvite(token, name, password);

      // Decode basic JWT claims (no verify needed — server already did that)
      const [, payloadB64] = access_token.split(".");
      const payload = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")));

      const user: User = {
        id:         payload.sub,
        name:       name,
        email:      payload.email,
        empresa:    payload.tenantName ?? "I-NET Intelligence",
        tenantId:   payload.tenantId,
        tenantSlug: payload.tenantSlug,
        role:       payload.role,
        modules:    payload.allowedModules ?? [],
      };

      localStorage.setItem("inet_token", access_token);
      setUser(user);
      setSuccess(true);

      setTimeout(() => router.push("/dashboard"), 1500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al activar la cuenta";
      if (msg.includes("expirado") || msg.includes("inválido") || msg.includes("expired")) {
        setError("Este link de invitación ya no es válido o ha expirado. Pide al administrador que te reenvíe la invitación.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
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

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          {success ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-4"
            >
              <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">¡Cuenta activada!</h2>
              <p className="text-slate-400 text-sm">Redirigiendo al dashboard...</p>
            </motion.div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-white mb-1">Activa tu cuenta</h2>
              <p className="text-slate-400 text-sm mb-8">
                Elige un nombre y contraseña para acceder al portal.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Tu nombre completo
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ana González"
                    required
                    className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3 text-sm
                               text-white placeholder:text-slate-500 focus:outline-none
                               focus:ring-2 focus:ring-brand-blue/50 focus:border-brand-blue
                               transition-all duration-200"
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Contraseña (mínimo 8 caracteres)
                  </label>
                  <div className="relative">
                    <input
                      type={showPass ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3 pr-12
                                 text-sm text-white placeholder:text-slate-500 focus:outline-none
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
                  {password && !passwordOk && (
                    <p className="text-xs text-amber-400 mt-1">Mínimo 8 caracteres</p>
                  )}
                </div>

                {/* Confirm */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Confirmar contraseña
                  </label>
                  <input
                    type={showPass ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3 text-sm
                               text-white placeholder:text-slate-500 focus:outline-none
                               focus:ring-2 focus:ring-brand-blue/50 focus:border-brand-blue
                               transition-all duration-200"
                  />
                  {confirm && !matchOk && (
                    <p className="text-xs text-red-400 mt-1">Las contraseñas no coinciden</p>
                  )}
                </div>

                {/* Error */}
                {error && (
                  <div className="flex items-start gap-2.5 text-red-400 text-xs bg-red-500/10
                                  border border-red-500/20 rounded-xl px-4 py-3">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !passwordOk || !matchOk || !name}
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
                      Activando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Activar mi cuenta
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          Tus datos nunca salen de los servidores de Informat
        </p>
      </motion.div>
    </div>
  );
}
