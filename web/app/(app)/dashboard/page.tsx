"use client";
import { useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sidebar } from "@/components/layout/Sidebar";
import { Message, TypingIndicator } from "@/components/chat/Message";
import { ChatInput } from "@/components/chat/ChatInput";
import { WelcomeScreen } from "@/components/chat/WelcomeScreen";
import { useChatStore } from "@/store/chat";
import { streamQuery } from "@/lib/api";
import { generateId } from "@/lib/utils";
import type { Message as MessageType, StreamChunk } from "@/types";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();
  const {
    user, activeConversationId, createConversation,
    addMessage, updateMessage, getMessages, isStreaming, setStreaming,
  } = useChatStore();

  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auth guard
  useEffect(() => {
    if (!user) router.push("/login");
  }, [user, router]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConversationId]);

  const messages = activeConversationId ? getMessages(activeConversationId) : [];

  const sendMessage = useCallback(async (question: string) => {
    if (!user || isStreaming) return;

    // Ensure we have an active conversation
    let convId = activeConversationId;
    if (!convId) {
      convId = createConversation();
    }

    // Add user message
    const userMsg: MessageType = {
      id: generateId(),
      role: "user",
      content: question,
      timestamp: new Date(),
      status: "done",
    };
    addMessage(convId, userMsg);

    // Add placeholder AI message
    const aiMsgId = generateId();
    const aiMsg: MessageType = {
      id: aiMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      status: "streaming",
    };
    addMessage(convId, aiMsg);
    setStreaming(true);

    // Scroll
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);

    try {
      let fullContent = "";
      let result = undefined;
      let suggestedFollowUps: string[] = [];

      const stream = streamQuery(question, user.empresaId, convId);

      for await (const chunk of stream) {
        if (chunk.type === "delta" && chunk.delta) {
          fullContent += chunk.delta;
          updateMessage(convId, aiMsgId, { content: fullContent, status: "streaming" });
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        } else if (chunk.type === "result") {
          result = chunk.result;
        } else if (chunk.type === "done") {
          suggestedFollowUps = chunk.suggestedFollowUps ?? [];
          break;
        } else if (chunk.type === "error") {
          throw new Error(chunk.error ?? "Unknown error");
        }
      }

      updateMessage(convId, aiMsgId, {
        content: fullContent,
        status: "done",
        result,
        suggestedFollowUps,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      updateMessage(convId, aiMsgId, {
        content: `Lo siento, ocurrió un error al procesar tu consulta: ${msg}`,
        status: "error",
      });
    } finally {
      setStreaming(false);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [user, isStreaming, activeConversationId, createConversation, addMessage, updateMessage, setStreaming]);

  if (!user) return null;

  return (
    <div className="flex h-screen bg-surface dark:bg-slate-950 overflow-hidden">
      {/* Sidebar */}
      <div className="relative flex-shrink-0">
        <Sidebar />
      </div>

      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b
                           border-slate-100 dark:border-slate-800 bg-white/80
                           dark:bg-slate-900/80 backdrop-blur-xl flex-shrink-0">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-sm font-bold text-slate-900 dark:text-white">
                {activeConversationId
                  ? (useChatStore.getState().conversations.find(c => c.id === activeConversationId)?.title ?? "Nueva consulta")
                  : "I-NET Intelligence"}
              </h1>
              <p className="text-[11px] text-slate-400">
                {user.empresa} · {new Date().toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400
                            bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1.5 rounded-full font-medium">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              ERP conectado
            </div>
          </div>
        </header>

        {/* Messages area */}
        <div
          className="flex-1 overflow-y-auto"
          ref={bottomRef}
        >
          {messages.length === 0 ? (
            <WelcomeScreen onQuestion={sendMessage} />
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <Message
                    key={msg.id}
                    message={msg}
                    onFollowUp={sendMessage}
                  />
                ))}
                {isStreaming && messages[messages.length - 1]?.status !== "streaming" && (
                  <TypingIndicator key="typing" />
                )}
              </AnimatePresence>
              <div ref={messagesEndRef} className="h-4" />
            </div>
          )}
        </div>

        {/* Input */}
        <ChatInput
          onSend={sendMessage}
          disabled={isStreaming}
          placeholder="¿Qué quieres saber de tu empresa?"
        />
      </div>
    </div>
  );
}
