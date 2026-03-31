"use client";
import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, disabled, placeholder }: Props) {
  const [value, setValue]   = useState("");
  const textareaRef         = useRef<HTMLTextAreaElement>(null);
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
    // Mobile: max 120px so keyboard doesn't crush the chat area
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
    // On mobile, Enter should add a newline (no physical keyboard shortcut)
    if (e.key === "Enter" && !e.shiftKey && !isMobile) {
      e.preventDefault();
      handleSubmit();
    }
  }

  const mobilePlaceholder = "¿Qué quieres saber de tu empresa?";
  const desktopPlaceholder = placeholder ?? "Pregunta algo sobre tu empresa... (Enter para enviar)";

  return (
    <div className="border-t border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80
                    backdrop-blur-xl px-3 md:px-4 py-3 md:py-4">
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
        <div className={cn(
          "flex items-end gap-2 bg-white dark:bg-slate-800 rounded-2xl shadow-card",
          "border border-slate-200 dark:border-slate-700",
          "focus-within:ring-2 focus-within:ring-brand-blue/40 focus-within:border-brand-blue",
          "transition-all duration-200",
          disabled && "opacity-60"
        )}>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={isMobile ? mobilePlaceholder : desktopPlaceholder}
            rows={1}
            className={cn(
              // Fix #2 — iOS zoom: font-size must be ≥16px on mobile inputs
              "flex-1 resize-none bg-transparent px-4 py-3.5",
              "text-base md:text-sm",          // 16px on mobile, 14px on desktop
              "text-slate-800 dark:text-slate-100 placeholder:text-slate-400",
              "focus:outline-none min-h-[48px] leading-relaxed",
              isMobile ? "max-h-[120px]" : "max-h-40"
            )}
          />

          {/* Fix #3 — Send button: minimum 44×44px tap target on mobile */}
          <div className="flex items-end pb-2 pr-2 gap-1">
            <motion.button
              type="submit"
              disabled={!value.trim() || disabled}
              whileTap={{ scale: 0.9 }}
              className={cn(
                // 44px on mobile, 36px on desktop
                "w-11 h-11 md:w-9 md:h-9 rounded-xl flex items-center justify-center",
                "transition-all duration-200",
                value.trim() && !disabled
                  ? "bg-brand-blue hover:bg-brand-navy text-white shadow-sm hover:shadow-glow"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed"
              )}
            >
              {disabled ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </motion.button>
          </div>
        </div>

        {/* Footer hint — hidden on mobile (not relevant without physical keyboard) */}
        <div className="hidden md:flex items-center justify-between mt-2 px-1">
          <p className="text-[10px] text-slate-400 flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5 text-brand-blue" />
            Consulta en tiempo real · Solo lectura · Datos seguros
          </p>
          <p className="text-[10px] text-slate-400">
            {value.length > 0 && `${value.length} chars · `}
            Enter para enviar · Shift+Enter nueva línea
          </p>
        </div>

        {/* Mobile footer — minimal */}
        <div className="flex md:hidden items-center justify-center mt-1.5">
          <p className="text-[10px] text-slate-400 flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5 text-brand-blue" />
            Consulta en tiempo real · Solo lectura
          </p>
        </div>
      </form>
    </div>
  );
}
