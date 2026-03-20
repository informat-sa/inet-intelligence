"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { generateId } from "@/lib/utils";
import type { Message, Conversation, User, AccessibleTenant } from "@/types";

interface ChatStore {
  // Auth
  user: User | null;
  setUser: (user: User | null) => void;

  // Multi-empresa
  accessibleTenants: AccessibleTenant[];
  setAccessibleTenants: (tenants: AccessibleTenant[]) => void;

  // Conversations
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Record<string, Message[]>;

  // Actions
  createConversation: () => string;
  setActiveConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  addMessage: (conversationId: string, message: Message) => void;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<Message>) => void;
  getMessages: (conversationId: string) => Message[];

  // Active module context — set when user picks a module from sidebar
  activeModule: string | null;  // e.g. "VFA" | null = all modules
  setActiveModule: (prefix: string | null) => void;

  // UI State
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  isStreaming: boolean;
  setStreaming: (v: boolean) => void;
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      user: null,
      setUser: (user) => set({ user }),

      accessibleTenants: [],
      setAccessibleTenants: (tenants) => set({ accessibleTenants: tenants }),

      conversations: [],
      activeConversationId: null,
      messages: {},

      createConversation: () => {
        const id = generateId();
        const conv: Conversation = {
          id,
          title: "Nueva consulta",
          createdAt: new Date(),
          updatedAt: new Date(),
          messageCount: 0,
          modulesUsed: [],
          // empresaId removed — scoped to tenant via JWT
        };
        set((s) => ({ conversations: [conv, ...s.conversations], activeConversationId: id }));
        return id;
      },

      setActiveConversation: (id) => set({ activeConversationId: id }),

      deleteConversation: (id) =>
        set((s) => {
          const { [id]: _, ...rest } = s.messages;
          const convs = s.conversations.filter((c) => c.id !== id);
          return {
            conversations: convs,
            messages: rest,
            activeConversationId:
              s.activeConversationId === id
                ? convs[0]?.id ?? null
                : s.activeConversationId,
          };
        }),

      addMessage: (conversationId, message) =>
        set((s) => {
          const msgs = s.messages[conversationId] ?? [];
          const convs = s.conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  updatedAt: new Date(),
                  messageCount: c.messageCount + 1,
                  title:
                    c.messageCount === 0 && message.role === "user"
                      ? message.content.slice(0, 60)
                      : c.title,
                  modulesUsed: Array.from(
                    new Set([...c.modulesUsed, ...(message.result ? [] : [])])
                  ),
                }
              : c
          );
          return { messages: { ...s.messages, [conversationId]: [...msgs, message] }, conversations: convs };
        }),

      updateMessage: (conversationId, messageId, updates) =>
        set((s) => ({
          messages: {
            ...s.messages,
            [conversationId]: (s.messages[conversationId] ?? []).map((m) =>
              m.id === messageId ? { ...m, ...updates } : m
            ),
          },
        })),

      getMessages: (conversationId) => get().messages[conversationId] ?? [],

      activeModule: null,
      setActiveModule: (prefix) => set({ activeModule: prefix }),

      isSidebarOpen: true,
      toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
      isStreaming: false,
      setStreaming: (v) => set({ isStreaming: v }),
    }),
    {
      name: "inet-intelligence",
      partialize: (s) => ({
        conversations:     s.conversations,
        messages:          s.messages,
        isSidebarOpen:     s.isSidebarOpen,
        user:              s.user,
        activeModule:      s.activeModule,
        accessibleTenants: s.accessibleTenants,
      }),
    }
  )
);
