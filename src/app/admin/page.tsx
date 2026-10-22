"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminLoginModal } from "@/components/Admin/AdminLoginModal";
import { AdminDashboard } from "@/components/Admin/AdminDashboard";
import { adminFetch, setAdminSessionToken } from "@/lib/adminClientSession";

export default function AdminProtectedPage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await adminFetch("/api/admin/session");
        if (res.ok) {
          setAuthenticated(true);
        } else {
          setAuthenticated(false);
        }
      } catch {
        setAuthenticated(false);
      } finally {
        setCheckingSession(false);
      }
    };
    checkSession();
  }, []);

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[#060913] text-slate-300 flex items-center justify-center text-sm">
        Verifying admin session...
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[#060913]">
        <AdminLoginModal
          isOpen={true}
          onClose={() => router.push("/")}
          onLoginSuccess={() => setAuthenticated(true)}
          isDark={true}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060913]">
      <AdminDashboard
        isOpen={true}
        onClose={() => router.push("/")}
        onLogout={() => {
          setAdminSessionToken(null);
          setAuthenticated(false);
          router.push("/");
        }}
        isDark={true}
      />
    </div>
  );
}
