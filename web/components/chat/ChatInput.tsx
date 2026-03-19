"use client";
import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Send, Mic, Paperclip, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, disabled, placeholder }: Props) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }, [value]);

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const q = value.trim();
    if (!q || disabled) return;
    onSend(q);
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="border-t border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80
                    backdrop-blur-xl px-4 py-4">
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
            placeholder={placeholder ?? "Pregunta algo sobre tu empresa... (Enter para enviar)"}
            rows={1}
            className="flex-1 resize-none bg-transparent px-4 py-3.5 text-sm text-slate-800
                       dark:text-slate-100 placeholder:text-slate-400 focus:outline-none
                       min-h-[48px] max-h-40 leading-relaxed"
          />

          {/* Send button */}
          <div className="flex items-end pb-2 pr-2 gap-1">
            <motion.button
              type="submit"
              disabled={!value.trim() || disabled}
              whileTap={{ scale: 0.9 }}
              className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200",
                value.trim() && !disabled
                  ? "bg-brand-blue hover:bg-brand-navy text-white shadow-sm hover:shadow-glow"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed"
              )}
            >
              {disabled ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
            </motion.button>
          </div>
        </div>

        <div className="flex items-center justify-between mt-2 px-1">
          <p className="text-[10px] text-slate-400 flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5 text-brand-blue" />
            Consulta en tiempo real · Solo lectura · Datos seguros
          </p>
          <p className="text-[10px] text-slate-400">
            {value.length > 0 && `${value.length} chars · `}
            Enter para enviar · Shift+Enter nueva línea
          </p>
        </div>
      </form>
    </div>
  );
}
