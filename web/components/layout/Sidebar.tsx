"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Plus, MessageSquare, History, LogOut, ChevronLeft,
  ChevronRight, Trash2, Search, Settings, TrendingUp, Package,
  CreditCard, Users, BookOpen, FileText, Truck, ShoppingCart,
  Building, Ship,
} from "lucide-react";
import { cn, formatRelativeTime, ERP_MODULES } from "@/lib/utils";
import { useChatStore } from "@/store/chat";

const MODULE_ICONS: Record<string, React.ElementType> = {
  TrendingUp, Package, CreditCard, Users, BookOpen, FileText,
  Truck, ShoppingCart, Building, Ship,
};

export function Sidebar() {
  const router = useRouter();
  const {
    user, conversations, activeConversationId, isSidebarOpen,
    toggleSidebar, createConversation, setActiveConversation, deleteConversation,
  } = useChatStore();

  const [search, setSearch] = useState("");
  const [showModules, setShowModules] = useState(false);

  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  function newChat() {
    const id = createConversation();
    router.push("/dashboard");
    setActiveConversation(id);
  }

  function handleLogout() {
    localStorage.removeItem("inet_token");
    router.push("/login");
  }

  return (
    <>
      {/* Collapse toggle */}
      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-8 z-50 w-6 h-6 bg-white dark:bg-slate-700
                   border border-slate-200 dark:border-slate-600 rounded-full shadow-sm
                   flex items-center justify-center text-slate-400 hover:text-brand-blue
                   transition-all duration-200"
      >
        {isSidebarOpen ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>

      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col h-full bg-white dark:bg-slate-900 border-r
                       border-slate-100 dark:border-slate-800 overflow-hidden flex-shrink-0"
          >
            {/* Logo */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-gradient-to-br from-brand-blue to-brand-navy rounded-lg
                                flex items-center justify-center shadow-sm">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="text-sm font-bold text-brand-navy dark:text-white leading-none">
                    I-NET Intelligence
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{user?.empresa ?? "Informat"}</div>
                </div>
              </div>
            </div>

            {/* New chat button */}
            <div className="p-3">
              <button
                onClick={newChat}
                className="w-full flex items-center gap-2 bg-brand-blue hover:bg-brand-navy
                           text-white text-sm font-semibold px-4 py-2.5 rounded-xl
                           transition-all duration-200 shadow-sm hover:shadow-glow"
              >
                <Plus className="w-4 h-4" />
                Nueva consulta
              </button>
            </div>

            {/* Search */}
            <div className="px-3 pb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar conversaciones..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200
                             dark:border-slate-700 rounded-xl pl-8 pr-3 py-2 text-xs
                             text-slate-600 dark:text-slate-300 placeholder:text-slate-400
                             focus:outline-none focus:ring-2 focus:ring-brand-blue/30
                             transition-all duration-200"
                />
              </div>
            </div>

            {/* Conversations list */}
            <div className="flex-1 overflow-y-auto px-3 space-y-0.5">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <MessageSquare className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-3" />
                  <p className="text-xs text-slate-400">
                    {search ? "Sin resultados" : "Aún no tienes consultas. ¡Empieza ahora!"}
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 py-2">
                    Recientes
                  </p>
                  {filtered.map((conv) => (
                    <div
                      key={conv.id}
                      onClick={() => { setActiveConversation(conv.id); router.push("/dashboard"); }}
                      className={cn(
                        "group sidebar-item",
                        activeConversationId === conv.id && "active"
                      )}
                    >
                      <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-xs leading-tight">{conv.title}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {formatRelativeTime(conv.updatedAt)}
                        </p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500
                                   rounded-lg transition-all duration-150"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Modules section */}
            <div className="px-3 pb-2 border-t border-slate-100 dark:border-slate-800 pt-2">
              <button
                onClick={() => setShowModules(!showModules)}
                className="sidebar-item w-full justify-between"
              >
                <div className="flex items-center gap-3">
                  <History className="w-4 h-4 opacity-60" />
                  <span>Módulos disponibles</span>
                </div>
                <ChevronRight className={cn("w-3 h-3 transition-transform", showModules && "rotate-90")} />
              </button>
              <AnimatePresence>
                {showModules && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pl-2 pt-1 space-y-0.5">
                      {ERP_MODULES.map((mod) => {
                        const Icon = MODULE_ICONS[mod.icon] ?? MessageSquare;
                        return (
                          <div key={mod.prefix} className="sidebar-item text-xs">
                            <Icon className="w-3.5 h-3.5" style={{ color: mod.color }} />
                            <span>{mod.name}</span>
                            <span className="ml-auto text-[10px] text-slate-400">
                              {mod.tableCount} tablas
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* User + logout */}
            <div className="p-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-blue to-brand-navy
                                flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {user?.name?.[0]?.toUpperCase() ?? "U"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                    {user?.name ?? "Usuario"}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50
                             dark:hover:bg-red-500/10 rounded-lg transition-all duration-200"
                  title="Cerrar sesión"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
