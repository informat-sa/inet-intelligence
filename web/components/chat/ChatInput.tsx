"use client";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  onSend:       (message: string) => void;
  disabled?:    boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, disabled, placeholder }: Props) {
  const [value, setValue]       = useState("");
  const [focused, setFocused]   = useState(false);
  const textareaRef             = useRef<HTMLTextAreaElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const maxH = isMobile ? 120 : 160;
    ta.style.height = Math.min(ta.scrollHeight, maxH) + "px";
  }, [value, isMobile]);

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const q = value.trim();
    if (!q || disabled) return;
    onSend(q);
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey && !isMobile) {
      e.preventDefault();
      handleSubmit();
    }
  }

  const hasValue = value.trim().length > 0;
  const canSend  = hasValue && !disabled;

  return (
    <div className="border-t border-slate-100 dark:border-slate-800
                    bg-white dark:bg-slate-900 px-3 md:px-6 py-3 md:py-4">
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">

        {/* ── Contenedor principal del input ─────────────────────────────── */}
        <div className={cn(
          "relative flex items-end gap-0 rounded-2xl transition-all duration-200",
          "bg-slate-50 dark:bg-slate-800",
          "border",
          focused
            ? "border-brand-navy/30 dark:border-brand-blue/40 shadow-md shadow-brand-navy/5"
            : "border-slate-200 dark:border-slate-700 shadow-sm",
          disabled && "opacity-50 pointer-events-none"
        )}>

          {/* Icono AI — izquierda */}
          <div className="flex items-end pb-3.5 pl-4 flex-shrink-0">
            <div className={cn(
              "w-5 h-5 rounded-md flex items-center justify-center transition-all duration-200",
              focused || hasValue
                ? "opacity-100"
                : "opacity-30"
            )}
              style={{ backgroundColor: focused || hasValue ? "#0F1E3520" : "transparent" }}
            >
              <Sparkles
                className="w-3 h-3 transition-colors duration-200"
                style={{ color: focused || hasValue ? "#0F1E35" : "#94a3b8" }}
              />
            </div>
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            disabled={disabled}
            placeholder={
              isMobile
                ? "¿Qué quieres saber?"
                : placeholder ?? "Pregunta algo sobre tu empresa..."
            }
            rows={1}
            className={cn(
              "flex-1 resize-none bg-transparent px-3 py-3.5",
              "text-base md:text-sm leading-relaxed",
              "text-slate-800 dark:text-slate-100",
              "placeholder:text-slate-400 dark:placeholder:text-slate-500",
              "focus:outline-none",
              "min-h-[48px]",
              isMobile ? "max-h-[120px]" : "max-h-40"
            )}
          />

          {/* Botón enviar */}
          <div className="flex items-end pb-2.5 pr-2.5 flex-shrink-0">
            <AnimatePresence mode="wait">
              <motion.button
                key={disabled ? "loading" : "send"}
                type="submit"
                disabled={!canSend}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.15 }}
                whileTap={canSend ? { scale: 0.88 } : {}}
                className={cn(
                  "w-9 h-9 md:w-8 md:h-8 rounded-xl",
                  "flex items-center justify-center",
                  "transition-all duration-200",
                  canSend
                    ? "text-white shadow-md shadow-brand-navy/20 hover:shadow-lg hover:shadow-brand-navy/30"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed"
                )}
                style={canSend ? { backgroundColor: "#0F1E35" } : {}}
              >
                {disabled ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white
                                  rounded-full animate-spin" />
                ) : (
                  <ArrowUp className="w-3.5 h-3.5" />
                )}
              </motion.button>
            </AnimatePresence>
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mt-2 px-1">
          <p className="text-[10px] text-slate-400 dark:text-slate-600
                        flex items-center gap-1.5 font-medium">
            <span className="w-1 h-1 rounded-full bg-emerald-400 inline-block" />
            Solo lectura · Datos seguros
          </p>
          <p className="hidden md:block text-[10px] text-slate-300 dark:text-slate-600">
            {hasValue
              ? <span className="text-slate-400">{value.length} car · </span>
              : null}
            Enter para enviar
          </p>
        </div>

      </form>
    </div>
  );
}
