"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Plus, MessageSquare, History, LogOut, ChevronLeft,
  ChevronRight, Trash2, Search, TrendingUp, Package,
  CreditCard, Users, BookOpen, FileText, Truck, ShoppingCart,
  Building, Ship, Star, Shield, X, Moon, Sun,
  Landmark, Receipt, FileSearch, ShoppingBag,
  Boxes, Settings, Wallet, Wheat, Headphones,
} from "lucide-react";
import { cn, formatRelativeTime, ERP_MODULES } from "@/lib/utils";
import { useChatStore } from "@/store/chat";
import { useFavoritesStore } from "@/store/favorites";
import { getFavorites, saveFavorite } from "@/lib/api";

const MODULE_ICONS: Record<string, React.ElementType> = {
  TrendingUp, Package, CreditCard, Users, BookOpen, FileText,
  Truck, ShoppingCart, Building, Ship,
  Landmark, Receipt, FileSearch, ShoppingBag,
  Boxes, Settings, Wallet, Wheat, Headphones,
};

export function Sidebar() {
  const router = useRouter();
  const {
    user, conversations, activeConversationId, isSidebarOpen,
    activeModule, setActiveModule,
    toggleSidebar, createConversation, setActiveConversation, deleteConversation,
    theme, toggleTheme,
  } = useChatStore();

  const { favorites, setFavorites, addFavorite } = useFavoritesStore();

  const [search, setSearch]           = useState("");
  const [showModules, setShowModules] = useState(false);
  const [showFavs, setShowFavs]       = useState(false);

  const isAdmin      = user?.role === "admin" || user?.role === "super_admin";
  const isSuperAdmin = user?.role === "super_admin";
  const allowedPrefixes = user?.modules ?? [];

  // Filter ERP_MODULES to only show what the user can access
  const visibleModules = allowedPrefixes.length > 0
    ? ERP_MODULES.filter((m) => allowedPrefixes.includes(m.prefix))
    : ERP_MODULES;

  // Load favorites from API on mount
  useEffect(() => {
    if (!user) return;
    getFavorites()
      .then(setFavorites)
      .catch(() => { /* silent fail */ });
  }, [user, setFavorites]);

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
    useChatStore.setState({ user: null });
    router.push("/login");
  }

  // Close sidebar when navigating on mobile
  function closeMobile() {
    if (window.innerWidth < 768) toggleSidebar();
  }

  const isMobileDrawer = typeof window !== "undefined" && window.innerWidth < 768;

  return (
    <>
      {/* ── Desktop: collapse toggle (hidden on mobile) ─────────────── */}
      <button
        onClick={toggleSidebar}
        className="hidden md:flex absolute -right-3 top-8 z-50 w-6 h-6 bg-white dark:bg-slate-700
                   border border-slate-200 dark:border-slate-600 rounded-full shadow-sm
                   items-center justify-center text-slate-400 hover:text-brand-blue
                   transition-all duration-200"
      >
        {isSidebarOpen ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>

      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <>
            {/* ── Mobile: backdrop overlay ─────────────────────────────── */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={toggleSidebar}
              className="sidebar-overlay md:hidden"
            />

          <motion.aside
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed md:relative inset-y-0 left-0 z-50 md:z-auto
                       flex flex-col h-full w-[280px] bg-white dark:bg-slate-900
                       border-r border-slate-100 dark:border-slate-800
                       overflow-hidden flex-shrink-0 shadow-xl md:shadow-none"
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
              {/* Close button — mobile only */}
              <button
                onClick={toggleSidebar}
                className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg
                           text-slate-400 hover:text-slate-600 hover:bg-slate-100
                           dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
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
                      {/* Guardar como favorito */}
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            const fav = await saveFavorite({ title: conv.title, question: conv.title });
                            addFavorite(fav);
                          } catch { /* silently ignore */ }
                        }}
                        title="Guardar como favorito"
                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-amber-500
                                   rounded-lg transition-all duration-150"
                      >
                        <Star className="w-3 h-3" />
                      </button>
                      {/* Eliminar conversación */}
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

            {/* ── History link ────────────────────────────────────────── */}
            <div className="px-3 pb-1">
              <button
                onClick={() => { router.push("/history"); closeMobile(); }}
                className="sidebar-item w-full text-slate-500 dark:text-slate-400
                           hover:text-slate-700 dark:hover:text-slate-200"
              >
                <History className="w-4 h-4 opacity-70" />
                <span>Ver todo el historial</span>
                {conversations.length > 0 && (
                  <span className="ml-auto text-[10px] bg-slate-100 dark:bg-slate-700
                                   text-slate-500 dark:text-slate-400 px-1.5 py-0.5
                                   rounded-full font-medium">
                    {conversations.length}
                  </span>
                )}
              </button>
            </div>

            {/* ── Favorites section — always visible ─────────────────── */}
            <div className="px-3 pb-1 border-t border-slate-100 dark:border-slate-800 pt-2">
              <button
                onClick={() => setShowFavs(!showFavs)}
                className="sidebar-item w-full justify-between"
              >
                <div className="flex items-center gap-3">
                  <Star className="w-4 h-4 text-amber-500" />
                  <span>Favoritos</span>
                  {favorites.length > 0 && (
                    <span className="text-[10px] bg-amber-100 dark:bg-amber-500/20 text-amber-600
                                     dark:text-amber-400 px-1.5 py-0.5 rounded-full font-medium">
                      {favorites.length}
                    </span>
                  )}
                </div>
                <ChevronRight className={cn("w-3 h-3 transition-transform", showFavs && "rotate-90")} />
              </button>
              <AnimatePresence>
                {showFavs && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    {favorites.length === 0 ? (
                      <div className="pl-2 pt-2 pb-1">
                        <p className="text-[10px] text-slate-400 italic px-2">
                          Aún no tienes favoritos. Marca una consulta con ⭐ para guardarla aquí.
                        </p>
                      </div>
                    ) : (
                      <div className="pl-2 pt-1 space-y-0.5">
                        {favorites.map((fav) => (
                          <button
                            key={fav.id}
                            onClick={() => {
                              router.push(`/dashboard?q=${encodeURIComponent(fav.question)}`);
                            }}
                            className="sidebar-item w-full text-left text-xs"
                          >
                            <Star className="w-3 h-3 text-amber-500 flex-shrink-0" />
                            <span className="truncate flex-1">{fav.title}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── Modules section ────────────────────────────────────── */}
            <div className="px-3 pb-2 border-t border-slate-100 dark:border-slate-800 pt-2">
              <button
                onClick={() => setShowModules(!showModules)}
                className="sidebar-item w-full justify-between"
              >
                <div className="flex items-center gap-3">
                  <History className="w-4 h-4 opacity-60" />
                  <span>Módulos disponibles</span>
                  <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500
                                   dark:text-slate-400 px-1.5 py-0.5 rounded-full font-medium">
                    {visibleModules.length}
                  </span>
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
                    {/* max-h + overflow-y-auto → scrolleable cuando hay muchos módulos */}
                    <div className="pl-2 pt-1 space-y-0.5 max-h-56 overflow-y-auto
                                    scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
                      {visibleModules.map((mod) => {
                        const Icon = MODULE_ICONS[mod.icon] ?? MessageSquare;
                        const isActive = activeModule === mod.prefix;
                        return (
                          <button
                            key={mod.prefix}
                            onClick={() => {
                              setActiveModule(isActive ? null : mod.prefix);
                              router.push("/dashboard");
                            }}
                            className={cn(
                              "sidebar-item text-xs w-full text-left transition-all",
                              isActive
                                ? "bg-brand-blue/10 text-brand-blue dark:text-brand-mid font-semibold"
                                : "group/mod"
                            )}
                          >
                            <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: mod.color }} />
                            <span className="flex-1 truncate">{mod.name}</span>
                            {isActive && (
                              <span className="text-[9px] bg-brand-blue text-white px-1.5 py-0.5
                                               rounded-full font-bold flex-shrink-0">
                                ACTIVO
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── Admin link (admin/super_admin only) ──────────────── */}
            {isAdmin && (
              <div className="px-3 pb-2 space-y-1">
                <button
                  onClick={() => router.push("/admin")}
                  className="sidebar-item w-full text-brand-blue dark:text-brand-mid
                             hover:bg-brand-blue/8"
                >
                  <Shield className="w-4 h-4" />
                  <span className="font-medium">Panel de administración</span>
                </button>
                {isSuperAdmin && (
                  <button
                    onClick={() => router.push("/super-admin")}
                    className="sidebar-item w-full text-violet-600 dark:text-violet-400
                               hover:bg-violet-500/8"
                  >
                    <Building className="w-4 h-4" />
                    <span className="font-medium">Super Admin</span>
                    <span className="ml-auto text-[9px] bg-violet-100 dark:bg-violet-500/20
                                     text-violet-600 dark:text-violet-300 px-1.5 py-0.5
                                     rounded-full font-bold">
                      SA
                    </span>
                  </button>
                )}
              </div>
            )}

            {/* ── User + logout ─────────────────────────────────────── */}
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
                {/* Dark mode toggle */}
                <button
                  onClick={toggleTheme}
                  title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
                  className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50
                             dark:hover:text-amber-300 dark:hover:bg-amber-500/10
                             rounded-lg transition-all duration-200"
                >
                  {theme === "dark"
                    ? <Sun className="w-3.5 h-3.5" />
                    : <Moon className="w-3.5 h-3.5" />}
                </button>
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
          </>
        )}
      </AnimatePresence>
    </>
  );
}
