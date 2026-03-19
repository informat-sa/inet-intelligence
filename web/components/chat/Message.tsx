"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Code2, ChevronDown, ChevronUp, Sparkles, RefreshCw } from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import { ResultTable } from "./ResultTable";
import { ResultChart } from "./ResultChart";
import type { Message as MessageType } from "@/types";

interface Props {
  message: MessageType;
  onFollowUp?: (q: string) => void;
}

export function Message({ message, onFollowUp }: Props) {
  const [showSql, setShowSql] = useState(false);
  const isUser = message.role === "user";
  const isStreaming = message.status === "streaming";
  const isError = message.status === "error";

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
          ) : (
            <div className={cn("prose-chat", isError && "text-red-500 dark:text-red-400")}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content || (isStreaming ? " " : "Sin respuesta")}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Result table */}
        {!isUser && message.result?.type === "table" && (
          <div className="w-full max-w-3xl">
            <ResultTable result={message.result} />
          </div>
        )}

        {/* Result chart */}
        {!isUser && message.result?.type === "chart" && (
          <div className="w-full max-w-2xl">
            <ResultChart result={message.result} />
          </div>
        )}

        {/* SQL viewer */}
        {!isUser && message.result?.sql && (
          <div className="w-full max-w-3xl">
            <button
              onClick={() => setShowSql(!showSql)}
              className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-brand-blue
                         transition-colors mt-1"
            >
              <Code2 className="w-3 h-3" />
              {showSql ? "Ocultar SQL" : "Ver SQL generado"}
              {showSql ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {showSql && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2 bg-slate-900 rounded-xl p-4 overflow-x-auto"
              >
                <pre className="text-xs text-slate-100 font-mono whitespace-pre-wrap">
                  {message.result.sql}
                </pre>
              </motion.div>
            )}
          </div>
        )}

        {/* Follow-up suggestions */}
        {!isUser && message.status === "done" && message.suggestedFollowUps && message.suggestedFollowUps.length > 0 && (
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

        {/* Timestamp */}
        <span className="text-[10px] text-slate-400 px-1">
          {formatRelativeTime(message.timestamp)}
        </span>
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
