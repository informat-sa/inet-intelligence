"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, UserPlus, Loader2, RefreshCw } from "lucide-react";
import { useChatStore } from "@/store/chat";
import { listUsers } from "@/lib/api";
import { UserTable } from "@/components/admin/UserTable";
import { InviteUserDialog } from "@/components/admin/InviteUserDialog";
import type { PortalUser } from "@/types";

export default function AdminUsersPage() {
  const router = useRouter();
  const user   = useChatStore((s) => s.user);

  const [users, setUsers]       = useState<PortalUser[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showInvite, setInvite] = useState(false);

  const tenantModules = user?.modules ?? [];

  function load() {
    setLoading(true);
    listUsers()
      .then(setUsers)
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="min-h-screen bg-surface dark:bg-slate-950">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/admin")}
              className="p-2 text-slate-400 hover:text-brand-blue hover:bg-brand-blue/8
                         rounded-lg transition-all duration-200"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-base font-bold text-slate-900 dark:text-white">Usuarios</h1>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {loading ? "..." : `${users.length} usuario${users.length !== 1 ? "s" : ""}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="p-2 text-slate-400 hover:text-brand-blue hover:bg-brand-blue/8
                         rounded-lg transition-all duration-200 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => setInvite(true)}
              className="flex items-center gap-2 bg-brand-blue hover:bg-brand-navy text-white
                         text-sm font-semibold px-4 py-2 rounded-xl transition-all duration-200
                         shadow-sm hover:shadow-glow"
            >
              <UserPlus className="w-4 h-4" />
              Invitar usuario
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-7 h-7 animate-spin text-brand-blue" />
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <UserTable users={users} onUpdate={setUsers} />
          </motion.div>
        )}
      </div>

      {/* Invite dialog */}
      <AnimatePresence>
        {showInvite && (
          <InviteUserDialog
            tenantModules={tenantModules}
            onClose={() => setInvite(false)}
            onCreated={(newUser) => setUsers((prev) => [newUser, ...prev])}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
