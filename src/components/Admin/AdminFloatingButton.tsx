"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Shield } from "lucide-react";
import { AdminLoginModal } from "./AdminLoginModal";
import { AdminDashboard } from "./AdminDashboard";
import { adminFetch, setAdminSessionToken } from "@/lib/adminClientSession";

interface AdminFloatingButtonProps {
  isDark?: boolean;
  inConversationView?: boolean;
  onConfigUpdated?: () => void;
}

/**
 * Circular Floating Admin Access Button at bottom-right corner.
 * Clicking opens the Admin Login Modal first (verifying credentials on backend),
 * and upon successful authentication opens the full Admin Dashboard.
 */
export const AdminFloatingButton: React.FC<AdminFloatingButtonProps> = ({
  isDark = true,
  inConversationView = false,
  onConfigUpdated,
}) => {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

  const handleFloatingButtonClick = async () => {
    if (isAdminAuthenticated) {
      try {
        const res = await adminFetch("/api/admin/session");
        if (res.ok) {
          setIsDashboardOpen(true);
          return;
        }
      } catch {
        // Proceed to login modal
      }
      setIsAdminAuthenticated(false);
    }
    setIsLoginModalOpen(true);
  };

  return (
    <>
      {/* Subtle Circular Floating Admin Button in Bottom-Right Corner */}
      <motion.button
        type="button"
        onClick={handleFloatingButtonClick}
        whileHover={{ scale: 1.12, rotate: 8 }}
        whileTap={{ scale: 0.94 }}
        title="Admin Panel & API Configuration"
        aria-label="Open Admin Panel"
        style={{
          position: "fixed",
          right: "20px",
          bottom: inConversationView ? undefined : "20px",
        }}
        className={`z-40 w-10 h-10 rounded-full flex items-center justify-center border shadow-lg backdrop-blur-md transition-colors cursor-pointer ${
          inConversationView ? "bottom-24 sm:bottom-5" : "bottom-5"
        } ${
          isDark
            ? "bg-slate-900/80 hover:bg-slate-800 border-slate-700/80 hover:border-sky-400/60 text-slate-300 hover:text-sky-400 shadow-black/40"
            : "bg-white/85 hover:bg-white border-slate-300 hover:border-sky-500 text-slate-600 hover:text-sky-600 shadow-slate-300/50"
        }`}
      >
        <Shield className="w-4 h-4" />
      </motion.button>

      {/* Admin Login Modal */}
      <AdminLoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={() => {
          setIsLoginModalOpen(false);
          setIsAdminAuthenticated(true);
          setIsDashboardOpen(true);
        }}
        isDark={isDark}
      />

      {/* Admin Dashboard */}
      <AdminDashboard
        isOpen={isDashboardOpen}
        onClose={() => setIsDashboardOpen(false)}
        onLogout={() => {
          setAdminSessionToken(null);
          setIsAdminAuthenticated(false);
          setIsDashboardOpen(false);
        }}
        onConfigUpdated={onConfigUpdated}
        isDark={isDark}
      />
    </>
  );
};
