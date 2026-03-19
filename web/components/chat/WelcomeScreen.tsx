"use client";
import { motion } from "framer-motion";
import { Sparkles, TrendingUp, Package, CreditCard, Users, FileText, Truck } from "lucide-react";
import { ERP_MODULES } from "@/lib/utils";
import { useChatStore } from "@/store/chat";

const ICON_MAP: Record<string, React.ElementType> = {
  TrendingUp, Package, CreditCard, Users, FileText, Truck,
};

interface Props { onQuestion: (q: string) => void }

export function WelcomeScreen({ onQuestion }: Props) {
  const user = useChatStore((s) => s.user);

  const topModules = ERP_MODULES.slice(0, 6);

  return (
    <div className="flex flex-col items-center justify-center h-full px-4 py-12 max-w-3xl mx-auto">
      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10"
      >
        <div className="w-16 h-16 bg-gradient-to-br from-brand-blue to-brand-navy rounded-2xl
                        flex items-center justify-center mx-auto mb-4 shadow-glow">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          Hola{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm">
          Pregúntame cualquier cosa sobre los datos de tu empresa. Accedo a tu ERP en tiempo real.
        </p>
      </motion.div>

      {/* Module cards with example questions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full mb-8"
      >
        {topModules.map((mod, i) => {
          const Icon = ICON_MAP[mod.icon] ?? Sparkles;
          return (
            <motion.button
              key={mod.prefix}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.06 }}
              onClick={() => onQuestion(mod.exampleQuestions[0])}
              className="group text-left p-4 card hover:shadow-card-hover hover:-translate-y-0.5
                         transition-all duration-200 cursor-pointer"
            >
              <div className="flex items-center gap-2.5 mb-2">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${mod.color}15` }}
                >
                  <Icon className="w-4 h-4" style={{ color: mod.color }} />
                </div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {mod.name}
                </span>
                <span className="ml-auto text-[10px] text-slate-400">
                  {mod.tableCount} tablas
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed
                            group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">
                &ldquo;{mod.exampleQuestions[0]}&rdquo;
              </p>
            </motion.button>
          );
        })}
      </motion.div>

      {/* Stats strip */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex items-center gap-6 text-center"
      >
        {[
          { value: "1,214", label: "tablas disponibles" },
          { value: "12,425", label: "atributos" },
          { value: "22", label: "módulos" },
        ].map(({ value, label }) => (
          <div key={label}>
            <div className="text-lg font-bold text-brand-navy dark:text-brand-mid">{value}</div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">{label}</div>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
