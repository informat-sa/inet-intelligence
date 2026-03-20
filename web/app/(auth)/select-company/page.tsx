"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, Sparkles, CheckCircle2, ChevronRight, LogOut,
  Package, TrendingUp, CreditCard, Boxes, Loader2,
} from "lucide-react";
import { useChatStore } from "@/store/chat";
import { selectTenant } from "@/lib/api";
import type { AccessibleTenant, User } from "@/types";

/** Deterministic background color derived from company name */
function companyColor(name: string): string {
  const palette = [
    "#0EA5E9", "#8B5CF6", "#F59E0B", "#10B981",
    "#EF4444", "#6366F1", "#EC4899", "#14B8A6",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

/** Module count badge icons */
const MOD_ICONS = [TrendingUp, Package, CreditCard, Boxes];

export default function SelectCompanyPage() {
  const router = useRouter();
  const {
    user,
    accessibleTenants,
    setUser,
    setAccessibleTenants,
  } = useChatStore();

  const [selecting, setSelecting] = useState<string | null>(null);
  const [error, setError]         = useState("");

  // Auth guard — must be logged in to see this page
  useEffect(() => {
    if (!user) router.replace("/login");
  }, [user, router]);

  // If only 1 company, skip this page
  useEffect(() => {
    if (user && accessibleTenants.length === 1) {
      router.replace("/dashboard");
    }
  }, [user, accessibleTenants, router]);

  async function handleSelect(tenant: AccessibleTenant) {
    if (selecting) return;
    setSelecting(tenant.id);
    setError("");

    try {
      const { access_token, user: payload, accessibleTenants: tenants } =
        await selectTenant(tenant.id);

      localStorage.setItem("inet_token", access_token);

      const updatedUser: User = {
        id:         payload.id,
        name:       payload.name,
        email:      payload.email,
        empresa:    payload.empresa,
        tenantId:   payload.tenantId,
        tenantSlug: payload.tenantSlug,
        role:       payload.role as User["role"],
        modules:    payload.modules ?? [],
      };

      setUser(updatedUser);
      setAccessibleTenants(tenants ?? []);
      router.push("/dashboard");
    } catch {
      setError("No se pudo acceder a esta empresa. Intenta nuevamente.");
      setSelecting(null);
    }
  }

  function handleLogout() {
    localStorage.removeItem("inet_token");
    useChatStore.setState({ user: null, accessibleTenants: [] });
    router.replace("/login");
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-brand-navy to-slate-900
                    flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-blue/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-20 w-80 h-80 bg-brand-blue/10 rounded-full blur-3xl" />
        <svg className="absolute inset-0 opacity-5" width="100%" height="100%">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-2xl"
      >
        {/* Header */}
        <div className="text-center mb-10">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 280 }}
            className="w-16 h-16 bg-gradient-to-br from-brand-blue to-brand-navy rounded-2xl
                       flex items-center justify-center mx-auto mb-5 shadow-glow"
          >
            <Sparkles className="w-8 h-8 text-white" />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="text-3xl font-extrabold text-white mb-2"
          >
            ¿A qué empresa quieres ingresar?
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-slate-400 text-sm"
          >
            Hola, <span className="text-white font-medium">{user.name.split(" ")[0]}</span>.
            Tienes acceso a {accessibleTenants.length} empresas.
          </motion.p>
        </div>

        {/* Company grid */}
        <div className={`grid gap-4 mb-8 ${
          accessibleTenants.length === 2
            ? "grid-cols-2"
            : accessibleTenants.length >= 4
              ? "grid-cols-2 sm:grid-cols-3"
              : "grid-cols-1 sm:grid-cols-2"
        }`}>
          <AnimatePresence>
            {accessibleTenants.map((tenant, i) => {
              const color     = companyColor(tenant.name);
              const isLoading = selecting === tenant.id;
              const initials  = tenant.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

              return (
                <motion.button
                  key={tenant.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 + i * 0.08, duration: 0.4 }}
                  onClick={() => handleSelect(tenant)}
                  disabled={!!selecting}
                  className="group relative text-left bg-white/5 hover:bg-white/10
                             border border-white/10 hover:border-white/20
                             rounded-2xl p-6 transition-all duration-200
                             hover:shadow-xl hover:-translate-y-0.5
                             disabled:opacity-60 disabled:cursor-not-allowed
                             focus:outline-none focus:ring-2 focus:ring-brand-blue/50"
                >
                  <div className="flex items-start gap-4">
                    {/* Company avatar */}
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center
                                 text-lg font-extrabold text-white flex-shrink-0 shadow-lg"
                      style={{ backgroundColor: color }}
                    >
                      {tenant.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={tenant.logoUrl}
                          alt={tenant.name}
                          className="w-10 h-10 object-contain rounded-xl"
                        />
                      ) : (
                        initials
                      )}
                    </div>

                    {/* Company info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-base leading-tight truncate mb-1">
                        {tenant.name}
                      </p>
                      <p className="text-slate-400 text-xs flex items-center gap-1.5">
                        <Building2 className="w-3 h-3 flex-shrink-0" />
                        {tenant.slug}
                      </p>

                      {/* Module count pills */}
                      <div className="flex items-center gap-1 mt-3">
                        {MOD_ICONS.slice(0, Math.min(3, Math.floor(tenant.moduleCount / 3))).map((Icon, j) => (
                          <div
                            key={j}
                            className="w-5 h-5 rounded-md flex items-center justify-center"
                            style={{ backgroundColor: `${color}25` }}
                          >
                            <Icon className="w-3 h-3" style={{ color }} />
                          </div>
                        ))}
                        <span className="text-[10px] text-slate-400 ml-1 font-medium">
                          {tenant.moduleCount} módulos
                        </span>
                      </div>
                    </div>

                    {/* Arrow / loader */}
                    <div className="flex-shrink-0 self-center">
                      {isLoading ? (
                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                      ) : (
                        <ChevronRight
                          className="w-5 h-5 text-slate-500 group-hover:text-white
                                     group-hover:translate-x-0.5 transition-all"
                        />
                      )}
                    </div>
                  </div>

                  {/* Active overlay when selected */}
                  {isLoading && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="absolute inset-0 rounded-2xl bg-brand-blue/10 border border-brand-blue/30"
                    />
                  )}
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="text-red-400 text-sm bg-red-500/10 border border-red-500/20
                         rounded-xl px-4 py-3 text-center mb-6"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Logout link */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center"
        >
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300
                       transition-colors mx-auto"
          >
            <LogOut className="w-3.5 h-3.5" />
            Cerrar sesión
          </button>
        </motion.div>
      </motion.div>

      {/* Footer */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="relative z-10 text-xs text-slate-600 mt-10"
      >
        I-NET Intelligence by Informat · Solo accedes a empresas que te fueron asignadas
      </motion.p>
    </div>
  );
}
