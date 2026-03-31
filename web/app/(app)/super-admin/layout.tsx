"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useChatStore } from "@/store/chat";

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user   = useChatStore((s) => s.user);

  useEffect(() => {
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role !== "super_admin") {
      router.replace("/dashboard");
    }
  }, [user, router]);

  if (!user || user.role !== "super_admin") return null;

  return <>{children}</>;
}
