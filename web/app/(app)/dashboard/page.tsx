"use client";
import { useEffect, useRef, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sidebar } from "@/components/layout/Sidebar";
import { Message, TypingIndicator } from "@/components/chat/Message";
import { ChatInput } from "@/components/chat/ChatInput";
import { WelcomeScreen } from "@/components/chat/WelcomeScreen";
import { useChatStore } from "@/store/chat";
import { useFavoritesStore } from "@/store/favorites";
import { streamQuery, saveFavorite, selectTenant } from "@/lib/api";
import { generateId, ERP_MODULES } from "@/lib/utils";
import type { Message as MessageType, StreamChunk, User } from "@/types";
import { useRouter, useSearchParams } from "next/navigation";
import { X, TrendingUp, Package, CreditCard, Users, FileText, Truck,
  BookOpen, ShoppingCart, Building, Ship, Landmark, Receipt,
  FileSearch, ShoppingBag, Boxes, Settings, Wallet, Wheat, Headphones,
  Building2, ChevronDown, Check,
} from "lucide-react";

const MODULE_ICONS: Record<string, React.ElementType> = {
  TrendingUp, Package, CreditCard, Users, FileText, Truck,
  BookOpen, ShoppingCart, Building, Ship, Landmark, Receipt,
  FileSearch, ShoppingBag, Boxes, Settings, Wallet, Wheat, Headphones,
};

// ── Company Switcher dropdown ─────────────────────────────────────────────────
function CompanySwitcher() {
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const { user, accessibleTenants, setUser, setAccessibleTenants } = useChatStore();
  const router = useRouter();

  if (!user || accessibleTenants.length <= 1) return null;

  async function handleSwitch(tenantId: string) {
    if (tenantId === user?.tenantId || switching) return;
    setSwitching(tenantId);
    setOpen(false);
    try {
      const { access_token, user: payload, accessibleTenants: tenants } =
        await selectTenant(tenantId);
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
      // Reset conversations context for new company
      useChatStore.setState({ activeConversationId: null });
      router.refresh();
    } catch {
      /* silent fail — user stays on current company */
    } finally {
      setSwitching(null);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full
                   bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300
                   border border-slate-200 dark:border-slate-700
                   hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
      >
        <Building2 className="w-3.5 h-3.5 text-brand-blue" />
        <span className="max-w-[140px] truncate">{user.empresa}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 z-20 w-64
                         bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700
                         rounded-2xl shadow-xl overflow-hidden"
            >
              <div className="px-3 pt-3 pb-1">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-1 mb-2">
                  Cambiar empresa
                </p>
                <div className="space-y-0.5">
                  {accessibleTenants.map((t) => {
                    const isActive  = t.id === user.tenantId;
                    const isLoading = switching === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => handleSwitch(t.id)}
                        disabled={isActive || !!switching}
                        className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-xl
                                   text-sm transition-all ${
                                     isActive
                                       ? "bg-brand-blue/10 text-brand-blue dark:text-brand-mid font-semibold"
                                       : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                                   }`}
                      >
                        <Building2 className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? "text-brand-blue" : "text-slate-400"}`} />
                        <span className="flex-1 truncate">{t.name}</span>
                        {isActive && <Check className="w-3.5 h-3.5 flex-shrink-0 text-brand-blue" />}
                        {isLoading && (
                          <div className="w-3.5 h-3.5 border-2 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800">
                <p className="text-[10px] text-slate-400">
                  {accessibleTenants.length} empresas disponibles
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function DashboardPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const {
    user, activeConversationId, createConversation,
    addMessage, updateMessage, getMessages, isStreaming, setStreaming,
    activeModule, setActiveModule,
  } = useChatStore();

  const activeMod = activeModule ? ERP_MODULES.find((m) => m.prefix === activeModule) : null;
  const ActiveModIcon = activeMod ? (MODULE_ICONS[activeMod.icon] ?? null) : null;

  const { addFavorite } = useFavoritesStore();

  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const favFiredRef = useRef(false);

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

      const stream = streamQuery(question, convId, activeModule ? [activeModule] : undefined);

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

  // Save a question as favorite
  const handleSaveFavorite = useCallback(async (title: string, question: string) => {
    const fav = await saveFavorite({ title, question });
    addFavorite(fav);
  }, [addFavorite]);

  // Handle ?q= query param from favorites sidebar click
  useEffect(() => {
    const q = searchParams.get("q");
    if (q && user && !favFiredRef.current && !isStreaming) {
      favFiredRef.current = true;
      sendMessage(decodeURIComponent(q));
      // Clean the URL without triggering a reload
      router.replace("/dashboard", { scroll: false });
    }
  }, [searchParams, user, sendMessage, isStreaming, router]);

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
            {/* Active module chip */}
            {activeMod && ActiveModIcon && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full
                           border transition-all"
                style={{
                  backgroundColor: `${activeMod.color}12`,
                  borderColor: `${activeMod.color}30`,
                  color: activeMod.color,
                }}
              >
                <ActiveModIcon className="w-3 h-3" />
                {activeMod.name}
                <button
                  onClick={() => setActiveModule(null)}
                  className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </motion.div>
            )}
            {/* Company switcher — only shows when user has multiple companies */}
            <CompanySwitcher />

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
                {messages.map((msg, idx) => {
                  // For AI messages, find the preceding user message (for save-favorite)
                  const userQuestion = msg.role === "assistant"
                    ? messages.slice(0, idx).reverse().find((m) => m.role === "user")?.content
                    : undefined;
                  return (
                    <Message
                      key={msg.id}
                      message={msg}
                      onFollowUp={sendMessage}
                      userQuestion={userQuestion}
                      onSaveFavorite={handleSaveFavorite}
                    />
                  );
                })}
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
          placeholder={activeMod
            ? `¿Qué quieres saber sobre ${activeMod.name}?`
            : "¿Qué quieres saber de tu empresa?"}
        />
      </div>
    </div>
  );
}
