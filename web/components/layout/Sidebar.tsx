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

// ── Estilos internos del sidebar navy ────────────────────────────────────────
const S = {
  item: [
    "flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-xl text-sm",
    "text-white/70 hover:text-white hover:bg-white/[0.06]",
    "transition-all duration-150 cursor-pointer select-none",
  ].join(" "),
  itemActive: "bg-white/[0.10] text-white font-semibold",
  divider:    "border-white/[0.07]",
  label:      "text-[10px] font-bold uppercase tracking-widest text-white/30 px-3 mb-1",
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

  const visibleModules = allowedPrefixes.length > 0
    ? ERP_MODULES.filter((m) => allowedPrefixes.includes(m.prefix))
    : ERP_MODULES;

  useEffect(() => {
    if (!user) return;
    getFavorites().then(setFavorites).catch(() => {});
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

  function closeMobile() {
    if (window.innerWidth < 768) toggleSidebar();
  }

  return (
    <>
      {/* Toggle desktop */}
      <button
        onClick={toggleSidebar}
        className="hidden md:flex absolute -right-3 top-8 z-50 w-6 h-6
                   bg-brand-navy border border-white/10 rounded-full shadow-lg
                   items-center justify-center text-white/50 hover:text-white
                   transition-all duration-200"
      >
        {isSidebarOpen
          ? <ChevronLeft  className="w-3 h-3" />
          : <ChevronRight className="w-3 h-3" />}
      </button>

      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <>
            {/* Backdrop mobile */}
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
                         flex flex-col h-full w-[272px] overflow-hidden flex-shrink-0
                         shadow-2xl md:shadow-none"
              style={{ backgroundColor: "#0F1E35" }}
            >
              {/* ── Logo ──────────────────────────────────────────────── */}
              <div className={cn("flex items-center justify-between px-5 py-5 border-b", S.divider)}>
                <div className="flex items-center gap-3">
                  {/* Icono con glow sutil */}
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0
                                  bg-brand-blue/20 ring-1 ring-brand-blue/30">
                    <Sparkles className="w-4.5 h-4.5 text-brand-blue" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white leading-tight tracking-tight">
                      I-NET Intelligence
                    </div>
                    <div className="text-[10px] text-white/40 mt-0.5 font-medium">
                      {user?.empresa ?? "Informat"}
                    </div>
                  </div>
                </div>
                <button
                  onClick={toggleSidebar}
                  className="md:hidden w-8 h-8 flex items-center justify-center rounded-xl
                             text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* ── Nueva consulta ────────────────────────────────────── */}
              <div className="px-3 pt-4 pb-2">
                <button
                  onClick={newChat}
                  className="w-full flex items-center justify-center gap-2
                             bg-brand-blue hover:bg-blue-500 active:bg-blue-600
                             text-white text-sm font-semibold px-4 py-2.5 rounded-xl
                             transition-all duration-200 shadow-lg shadow-brand-blue/20"
                >
                  <Plus className="w-4 h-4" />
                  Nueva consulta
                </button>
              </div>

              {/* ── Buscador ──────────────────────────────────────────── */}
              <div className="px-3 pb-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar conversaciones..."
                    className="w-full rounded-xl pl-9 pr-3 py-2 text-xs
                               bg-white/[0.06] border border-white/[0.08]
                               text-white/80 placeholder:text-white/30
                               focus:outline-none focus:ring-1 focus:ring-brand-blue/50
                               transition-all duration-200"
                  />
                </div>
              </div>

              {/* ── Conversaciones ────────────────────────────────────── */}
              <div className="flex-1 overflow-y-auto px-3 space-y-0.5 pb-2">
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <MessageSquare className="w-7 h-7 text-white/15 mb-3" />
                    <p className="text-xs text-white/30">
                      {search ? "Sin resultados" : "Aún no tienes consultas"}
                    </p>
                  </div>
                ) : (
                  <>
                    <p className={S.label}>Recientes</p>
                    {filtered.map((conv) => (
                      <div
                        key={conv.id}
                        onClick={() => { setActiveConversation(conv.id); router.push("/dashboard"); }}
                        className={cn(
                          S.item, "group",
                          activeConversationId === conv.id && S.itemActive
                        )}
                      >
                        <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 opacity-50" />
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-xs leading-tight">{conv.title}</p>
                          <p className="text-[10px] text-white/30 mt-0.5">
                            {formatRelativeTime(conv.updatedAt)}
                          </p>
                        </div>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              const fav = await saveFavorite({ title: conv.title, question: conv.title });
                              addFavorite(fav);
                            } catch { /* silent */ }
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-white/40
                                     hover:text-amber-400 rounded-lg transition-all"
                        >
                          <Star className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-white/40
                                     hover:text-red-400 rounded-lg transition-all"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </div>

              {/* ── Historial ─────────────────────────────────────────── */}
              <div className={cn("px-3 pb-2 border-t pt-2", S.divider)}>
                <button
                  onClick={() => { router.push("/history"); closeMobile(); }}
                  className={S.item}
                >
                  <History className="w-4 h-4 opacity-50" />
                  <span>Historial completo</span>
                  {conversations.length > 0 && (
                    <span className="ml-auto text-[10px] bg-white/[0.08] text-white/50
                                     px-1.5 py-0.5 rounded-full font-medium">
                      {conversations.length}
                    </span>
                  )}
                </button>
              </div>

              {/* ── Favoritos ─────────────────────────────────────────── */}
              <div className={cn("px-3 pb-2 border-t pt-2", S.divider)}>
                <button
                  onClick={() => setShowFavs(!showFavs)}
                  className={cn(S.item, "justify-between")}
                >
                  <div className="flex items-center gap-3">
                    <Star className="w-4 h-4 text-amber-400/80" />
                    <span>Favoritos</span>
                    {favorites.length > 0 && (
                      <span className="text-[10px] bg-amber-400/15 text-amber-400
                                       px-1.5 py-0.5 rounded-full font-medium">
                        {favorites.length}
                      </span>
                    )}
                  </div>
                  <ChevronRight className={cn("w-3 h-3 opacity-40 transition-transform", showFavs && "rotate-90")} />
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
                        <p className="text-[10px] text-white/25 italic px-3 pt-2 pb-1">
                          Marca una consulta con ⭐ para guardarla aquí.
                        </p>
                      ) : (
                        <div className="pl-2 pt-1 space-y-0.5">
                          {favorites.map((fav) => (
                            <button
                              key={fav.id}
                              onClick={() => router.push(`/dashboard?q=${encodeURIComponent(fav.question)}`)}
                              className={cn(S.item, "text-xs")}
                            >
                              <Star className="w-3 h-3 text-amber-400/80 flex-shrink-0" />
                              <span className="truncate flex-1">{fav.title}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── Módulos ───────────────────────────────────────────── */}
              <div className={cn("px-3 pb-2 border-t pt-2", S.divider)}>
                <button
                  onClick={() => setShowModules(!showModules)}
                  className={cn(S.item, "justify-between")}
                >
                  <div className="flex items-center gap-3">
                    <Boxes className="w-4 h-4 opacity-50" />
                    <span>Módulos</span>
                    <span className="text-[10px] bg-white/[0.08] text-white/40
                                     px-1.5 py-0.5 rounded-full font-medium">
                      {visibleModules.length}
                    </span>
                  </div>
                  <ChevronRight className={cn("w-3 h-3 opacity-40 transition-transform", showModules && "rotate-90")} />
                </button>
                <AnimatePresence>
                  {showModules && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pl-2 pt-1 space-y-0.5 max-h-52 overflow-y-auto">
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
                              className={cn(S.item, "text-xs", isActive && S.itemActive)}
                            >
                              <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: mod.color }} />
                              <span className="flex-1 truncate">{mod.name}</span>
                              {isActive && (
                                <span className="text-[9px] bg-brand-blue text-white
                                                 px-1.5 py-0.5 rounded-full font-bold flex-shrink-0">
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

              {/* ── Admin ─────────────────────────────────────────────── */}
              {isAdmin && (
                <div className={cn("px-3 pb-2 border-t pt-2 space-y-1", S.divider)}>
                  <button
                    onClick={() => router.push("/admin")}
                    className={cn(S.item, "text-blue-400 hover:text-blue-300")}
                  >
                    <Shield className="w-4 h-4" />
                    <span className="font-medium">Administración</span>
                  </button>
                  {isSuperAdmin && (
                    <button
                      onClick={() => router.push("/super-admin")}
                      className={cn(S.item, "text-violet-400 hover:text-violet-300")}
                    >
                      <Building className="w-4 h-4" />
                      <span className="font-medium">Super Admin</span>
                      <span className="ml-auto text-[9px] bg-violet-500/20 text-violet-300
                                       px-1.5 py-0.5 rounded-full font-bold">SA</span>
                    </button>
                  )}
                </div>
              )}

              {/* ── Usuario ───────────────────────────────────────────── */}
              <div className={cn("px-3 py-3 border-t", S.divider)}>
                <div className="flex items-center gap-3 px-2 py-1.5">
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-brand-blue/30 ring-1 ring-brand-blue/40
                                  flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {user?.name?.[0]?.toUpperCase() ?? "U"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white/90 truncate">
                      {user?.name ?? "Usuario"}
                    </p>
                    <p className="text-[10px] text-white/35 truncate">{user?.email}</p>
                  </div>
                  {/* Dark mode */}
                  <button
                    onClick={toggleTheme}
                    title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
                    className="p-1.5 text-white/35 hover:text-amber-400
                               hover:bg-white/[0.06] rounded-lg transition-all"
                  >
                    {theme === "dark"
                      ? <Sun  className="w-3.5 h-3.5" />
                      : <Moon className="w-3.5 h-3.5" />}
                  </button>
                  {/* Logout */}
                  <button
                    onClick={handleLogout}
                    title="Cerrar sesión"
                    className="p-1.5 text-white/35 hover:text-red-400
                               hover:bg-white/[0.06] rounded-lg transition-all"
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
