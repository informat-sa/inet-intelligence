"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Code2, ChevronDown, ChevronUp, Sparkles, ArrowRight, Star, Check, X } from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import { ResultTable } from "./ResultTable";
import { ResultChart } from "./ResultChart";
import type { Message as MessageType } from "@/types";

interface Props {
  message:         MessageType;
  onFollowUp?:     (q: string) => void;
  userQuestion?:   string;
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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className={cn("flex gap-3 group", isUser && "flex-row-reverse")}
    >
      {/* ── Avatar ──────────────────────────────────────────────────────── */}
      <div
        className={cn(
          "w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5",
          "text-white text-[10px] font-bold ring-1",
        )}
        style={{
          backgroundColor: "#0F1E35",
          boxShadow: "0 1px 4px rgba(15,30,53,0.2)",
        }}
      >
        {isUser ? (
          <span className="text-white/90 text-[10px] font-semibold tracking-tight">Tú</span>
        ) : (
          <Sparkles className="w-3.5 h-3.5 text-white/80" />
        )}
      </div>

      {/* ── Contenido ───────────────────────────────────────────────────── */}
      <div className={cn(
        "flex flex-col gap-1.5",
        isUser ? "items-end" : "items-start",
        "max-w-[85%]"
      )}>

        {/* Bubble */}
        <div className={cn(
          isUser ? "message-user" : "message-ai",
          isError && "border-red-200 dark:border-red-800/40",
          isStreaming && !isUser && "streaming-cursor"
        )}>
          {isUser ? (
            <p className="text-sm leading-relaxed text-white/95">{message.content}</p>
          ) : isStreaming && !message.content ? (
            <div className="flex items-center gap-1.5 py-0.5 px-0.5">
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

        {/* Resultados multi-query */}
        {!isUser && message.results && message.results.length > 1 && (
          <div className="w-full max-w-3xl space-y-3">
            {message.results.map((res, idx) => (
              <div key={idx}>
                {res.type === "table" && <ResultTable result={res} exportTitle={userQuestion} />}
                {res.chartConfig && <ResultChart result={res} />}
              </div>
            ))}
          </div>
        )}

        {/* Resultado tabla único */}
        {!isUser && !message.results && message.result?.type === "table" && (
          <div className="w-full max-w-3xl">
            <ResultTable result={message.result} exportTitle={userQuestion} />
          </div>
        )}

        {/* Resultado gráfico único */}
        {!isUser && !message.results && message.result?.chartConfig && (
          <div className="w-full max-w-3xl">
            <ResultChart result={message.result} />
          </div>
        )}

        {/* SQL viewer */}
        {!isUser && (() => {
          const sqlList = message.results
            ? message.results.filter(r => r.sql).map(r => r.sql!)
            : message.result?.sql ? [message.result.sql] : [];
          if (sqlList.length === 0) return null;
          return (
            <div className="w-full max-w-3xl">
              <button
                onClick={() => setShowSql(!showSql)}
                className="flex items-center gap-1.5 text-[10px] font-medium
                           text-slate-400 hover:text-slate-600 dark:hover:text-slate-300
                           transition-colors mt-0.5"
              >
                <Code2 className="w-3 h-3" />
                {showSql
                  ? "Ocultar SQL"
                  : `Ver SQL${sqlList.length > 1 ? ` (${sqlList.length})` : ""}`}
                {showSql
                  ? <ChevronUp className="w-3 h-3" />
                  : <ChevronDown className="w-3 h-3" />}
              </button>
              <AnimatePresence>
                {showSql && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-2 space-y-2 overflow-hidden"
                  >
                    {sqlList.map((sql, idx) => (
                      <div key={idx}
                           className="rounded-xl overflow-hidden"
                           style={{ backgroundColor: "#0F1E35" }}>
                        {sqlList.length > 1 && (
                          <p className="text-[10px] text-white/30 px-4 pt-3 pb-1 font-mono">
                            — Consulta {idx + 1} —
                          </p>
                        )}
                        <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap
                                        px-4 py-3 overflow-x-auto leading-relaxed">
                          {sql}
                        </pre>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })()}

        {/* Follow-up sugeridos */}
        {!isUser && isDone && message.suggestedFollowUps && message.suggestedFollowUps.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1 max-w-3xl">
            {message.suggestedFollowUps.map((q, i) => (
              <button
                key={i}
                onClick={() => onFollowUp?.(q)}
                className="group/fu flex items-center gap-1.5 text-[11px] font-medium
                           px-3 py-1.5 rounded-xl transition-all duration-200
                           bg-slate-100 dark:bg-slate-800
                           text-slate-600 dark:text-slate-300
                           border border-slate-200 dark:border-slate-700
                           hover:border-slate-300 dark:hover:border-slate-600
                           hover:text-slate-900 dark:hover:text-white
                           hover:shadow-sm"
              >
                <ArrowRight className="w-2.5 h-2.5 opacity-40
                                       group-hover/fu:opacity-100 transition-opacity" />
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Formulario guardar favorito */}
        {canFavorite && showSaveForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="w-full max-w-sm mt-0.5 overflow-hidden"
          >
            <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-500/10
                            border border-amber-200/60 dark:border-amber-500/20
                            rounded-xl px-3 py-2">
              <Star className="w-3 h-3 text-amber-500 flex-shrink-0" />
              <input
                autoFocus
                value={favTitle}
                onChange={(e) => setFavTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                  if (e.key === "Escape") setShowSaveForm(false);
                }}
                placeholder="Nombre del favorito..."
                className="flex-1 bg-transparent text-xs text-slate-700 dark:text-slate-200
                           placeholder:text-slate-400 outline-none min-w-0"
              />
              <button
                onClick={handleSave}
                disabled={saving || !favTitle.trim()}
                className="text-amber-600 hover:text-amber-700 disabled:opacity-40 transition-colors"
              >
                <Check className="w-3 h-3" />
              </button>
              <button
                onClick={() => setShowSaveForm(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Barra de acciones — timestamp + favorito */}
        <div className="flex items-center gap-3 px-0.5">
          <span className="text-[10px] text-slate-300 dark:text-slate-600 font-medium">
            {formatRelativeTime(message.timestamp)}
          </span>
          {canFavorite && !showSaveForm && (
            <button
              onClick={openSaveForm}
              title={saved ? "¡Guardado!" : "Guardar como favorito"}
              className={cn(
                "flex items-center gap-1 text-[10px] font-medium transition-all duration-200",
                saved
                  ? "text-amber-500"
                  : "text-slate-300 dark:text-slate-600 hover:text-amber-500",
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

// ── Typing Indicator ──────────────────────────────────────────────────────────
export function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.2 }}
      className="flex gap-3"
    >
      {/* Avatar */}
      <div
        className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ backgroundColor: "#0F1E35", boxShadow: "0 1px 4px rgba(15,30,53,0.2)" }}
      >
        <Sparkles className="w-3.5 h-3.5 text-white/80" />
      </div>

      {/* Dots */}
      <div className="message-ai flex items-center gap-1.5 py-3.5 px-5">
        <div className="typing-dot" />
        <div className="typing-dot" />
        <div className="typing-dot" />
      </div>
    </motion.div>
  );
}
