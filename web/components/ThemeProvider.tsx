"use client";
import { useEffect } from "react";
import { useChatStore } from "@/store/chat";

/**
 * Applies the `dark` class to <html> whenever the theme changes in the store.
 * Must be rendered inside the client boundary (body), not in the server root layout.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useChatStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  return <>{children}</>;
}
