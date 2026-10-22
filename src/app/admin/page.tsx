"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminLoginModal } from "@/components/Admin/AdminLoginModal";
import { AdminDashboard } from "@/components/Admin/AdminDashboard";
export default function AdminPage() {
  const router = useRouter(); const [status, setStatus] = useState<"checking" | "login" | "ready" | "error">("checking");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/session", { cache: "no-store", signal: controller.signal }).then(res => setStatus(res.ok ? "ready" : res.status === 401 ? "login" : "error")).catch(() => { if (!controller.signal.aborted) setStatus("error"); });
    return () => controller.abort();
  }, []);
  return <div className="aura-app admin-page" data-theme="light">{status === "checking" ? <p className="admin-loading" role="status">Memeriksa sesi admin…</p> : status === "error" ? <div className="admin-loading"><p role="alert">Sesi admin belum dapat diperiksa.</p><button className="secondary-button" onClick={() => location.reload()}>Coba lagi</button></div> : status === "login" ? <AdminLoginModal isOpen onClose={() => router.push("/")} onLoginSuccess={() => setStatus("ready")} /> : <AdminDashboard isOpen onClose={() => router.push("/")} onLogout={() => setStatus("login")} />}</div>;
}
