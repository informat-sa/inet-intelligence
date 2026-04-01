"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Code2, ChevronDown, ChevronUp, Sparkles, RefreshCw, Star, Check, X } from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import { ResultTable } from "./ResultTable";
import { ResultChart } from "./ResultChart";
import type { Message as MessageType } from "@/types";

interface Props {
  message: MessageType;
  onFollowUp?: (q: string) => void;
  /** La pregunta del usuario que originó esta respuesta (para guardar favorito) */
  userQuestion?: string;
  onSaveFavorite?: (title: string, question: string) => Promise<void>;
}

export function Message({ message, onFollowUp, userQuestion, onSaveFavorite }: Props) {
  const [showSql, setShowSql]           = useState(false);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [favTitle, setFavTitle]         = useState("");
  const [saving, setSaving]             = useState(false);
  const [saved, setSaved]               = useState(false);

  const isUser      = message.role === "user";
  const isStreaming = message.status === "streaming";
  const isError     = message.status === "error";
  const isDone      = message.status === "done";
  const canFavorite = !isUser && isDone && !!userQuestion && !!onSaveFavorite;

  function openSaveForm() {
    // Pre-fill with truncated question
    setFavTitle(userQuestion ? userQuestion.slice(0, 60) : "");
    setShowSaveForm(true);
  }

  async function handleSave() {
    if (!userQuestion || !onSaveFavorite || !favTitle.trim()) return;
    setSaving(true);
    try {
      await onSaveFavorite(favTitle.trim(), userQuestion);
      setSaved(true);
      setShowSaveForm(false);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={cn("flex gap-3 group", isUser && "flex-row-reverse")}
    >
      {/* Avatar */}
      <div className={cn(
        "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5",
        isUser
          ? "bg-brand-blue text-white text-xs font-bold"
          : "bg-gradient-to-br from-brand-navy to-brand-blue text-white"
      )}>
        {isUser ? "Tú" : <Sparkles className="w-4 h-4" />}
      </div>

      {/* Content */}
      <div className={cn("flex flex-col gap-1", isUser ? "items-end" : "items-start", "max-w-[85%]")}>
        {/* Bubble */}
        <div className={cn(
          isUser ? "message-user" : "message-ai",
          isError && "border-red-200 dark:border-red-800/50",
          isStreaming && "streaming-cursor"
        )}>
          {isUser ? (
            <p className="text-sm leading-relaxed">{message.content}</p>
          ) : isStreaming && !message.content ? (
            /* Waiting for first token — show animated dots */
            <div className="flex items-center gap-1 py-0.5">
              <div className="typing-dot" />
              <div className="typing-dot" />
              <div className="typing-dot" />
            </div>
          ) : (
            <div className={cn("prose-chat", isError && "text-red-500 dark:text-red-400")}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content || "Sin respuesta"}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Multi-query results (SQL_1, SQL_2, SQL_3) */}
        {!isUser && message.results && message.results.length > 1 && (
          <div className="w-full max-w-3xl space-y-4">
            {message.results.map((res, idx) => (
              <div key={idx}>
                {res.type === "table" && <ResultTable result={res} exportTitle={userQuestion} />}
                {res.chartConfig && <ResultChart result={res} />}
              </div>
            ))}
          </div>
        )}

        {/* Single result table (legacy / [SQL] blocks) */}
        {!isUser && !message.results && message.result?.type === "table" && (
          <div className="w-full max-w-3xl">
            <ResultTable result={message.result} exportTitle={userQuestion} />
          </div>
        )}

        {/* Single result chart (legacy / [SQL] blocks) */}
        {!isUser && !message.results && message.result?.chartConfig && (
          <div className="w-full max-w-3xl">
            <ResultChart result={message.result} />
          </div>
        )}

        {/* SQL viewer — shows all SQL blocks (multi-query) or the single one */}
        {!isUser && (() => {
          const sqlList = message.results
            ? message.results.filter(r => r.sql).map(r => r.sql!)
            : message.result?.sql
              ? [message.result.sql]
              : [];
          if (sqlList.length === 0) return null;
          return (
            <div className="w-full max-w-3xl">
              <button
                onClick={() => setShowSql(!showSql)}
                className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-brand-blue
                           transition-colors mt-1"
              >
                <Code2 className="w-3 h-3" />
                {showSql ? "Ocultar SQL" : `Ver SQL generado${sqlList.length > 1 ? ` (${sqlList.length} consultas)` : ""}`}
                {showSql ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {showSql && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-2 space-y-2"
                >
                  {sqlList.map((sql, idx) => (
                    <div key={idx} className="bg-slate-900 rounded-xl p-4 overflow-x-auto">
                      {sqlList.length > 1 && (
                        <p className="text-[10px] text-slate-500 mb-2 font-mono">
                          — Consulta {idx + 1} —
                        </p>
                      )}
                      <pre className="text-xs text-slate-100 font-mono whitespace-pre-wrap">
                        {sql}
                      </pre>
                    </div>
                  ))}
                </motion.div>
              )}
            </div>
          );
        })()}

        {/* Follow-up suggestions */}
        {!isUser && isDone && message.suggestedFollowUps && message.suggestedFollowUps.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2 max-w-3xl">
            {message.suggestedFollowUps.map((q, i) => (
              <button
                key={i}
                onClick={() => onFollowUp?.(q)}
                className="text-[11px] bg-brand-light dark:bg-brand-navy/20 text-brand-navy
                           dark:text-brand-mid border border-brand-mid/30 px-3 py-1.5 rounded-full
                           hover:bg-brand-blue hover:text-white hover:border-brand-blue
                           transition-all duration-200 font-medium flex items-center gap-1.5"
              >
                <RefreshCw className="w-2.5 h-2.5" />
                {q}
              </button>
            ))}
          </div>
        )}

        {/* ── Inline save-favorite form ──────────────────────────────── */}
        {canFavorite && showSaveForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="w-full max-w-sm mt-1"
          >
            <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-500/10 border
                            border-amber-200 dark:border-amber-500/30 rounded-xl px-3 py-2">
              <Star className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
              <input
                autoFocus
                value={favTitle}
                onChange={(e) => setFavTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setShowSaveForm(false); }}
                placeholder="Nombre del favorito..."
                className="flex-1 bg-transparent text-xs text-slate-700 dark:text-slate-200
                           placeholder:text-slate-400 outline-none min-w-0"
              />
              <button
                onClick={handleSave}
                disabled={saving || !favTitle.trim()}
                className="text-amber-600 hover:text-amber-700 disabled:opacity-40 transition-colors"
                title="Guardar"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setShowSaveForm(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                title="Cancelar"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Bottom action bar: timestamp + save button ──────────────── */}
        <div className="flex items-center gap-3 px-1">
          <span className="text-[10px] text-slate-400">
            {formatRelativeTime(message.timestamp)}
          </span>

          {/* Save to favorites button (AI messages only, when done) */}
          {canFavorite && !showSaveForm && (
            <button
              onClick={openSaveForm}
              title={saved ? "¡Guardado!" : "Guardar como favorito"}
              className={cn(
                "flex items-center gap-1 text-[10px] transition-all duration-200",
                saved
                  ? "text-amber-500"
                  : "text-slate-300 dark:text-slate-600 hover:text-amber-500 dark:hover:text-amber-400",
                // Mobile: always visible (no hover on touch). Desktop: show on hover only.
                "opacity-100 md:opacity-0 md:group-hover:opacity-100"
              )}
            >
              <Star className={cn("w-3 h-3", saved && "fill-amber-500")} />
              {saved ? "Guardado" : "Guardar"}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// Typing indicator
export function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="flex gap-3"
    >
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-navy to-brand-blue
                      flex items-center justify-center flex-shrink-0">
        <Sparkles className="w-4 h-4 text-white" />
      </div>
      <div className="message-ai flex items-center gap-1 py-3.5 px-5">
        <div className="typing-dot" />
        <div className="typing-dot" />
        <div className="typing-dot" />
      </div>
    </motion.div>
  );
}
