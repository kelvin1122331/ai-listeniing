"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_COMPANION_CONFIG,
  DEFAULT_USER_PROFILE,
} from "@/constants/companionPresets";
import { CompanionConfig, UserProfile } from "@/types/companion";
import { LandingPage } from "@/components/Landing/LandingPage";
import { MainConversationView } from "@/components/Companion/MainConversationView";
import { AdminFloatingButton } from "@/components/Admin/AdminFloatingButton";
import { AIService } from "@/services/AIService";

const CONFIG_STORAGE_KEY = "aura_companion_config_v1";
const PROFILE_STORAGE_KEY = "aura_companion_profile_v1";

export default function HomePage() {
  const [inSession, setInSession] = useState(false);
  const [initialPrompt, setInitialPrompt] = useState<string | null>(null);
  const [config, setConfig] = useState<CompanionConfig>(
    DEFAULT_COMPANION_CONFIG
  );
  const [userProfile, setUserProfile] = useState<UserProfile>(
    DEFAULT_USER_PROFILE
  );

  // Sync active AI provider & models from backend ServerConfigStore
  const syncBackendProviderConfig = useCallback(async () => {
    const synced = await AIService.syncProviderFromBackend();
    if (synced?.textModel) {
      setConfig((prev) => ({
        ...prev,
        geminiModel: synced.textModel,
      }));
    }
  }, []);

  // Load saved config & profile on client mount + sync backend provider
  useEffect(() => {
    try {
      const savedConfig = window.localStorage.getItem(CONFIG_STORAGE_KEY);
      if (savedConfig) {
        setConfig((prev) => ({ ...prev, ...JSON.parse(savedConfig) }));
      }
      const savedProfile = window.localStorage.getItem(PROFILE_STORAGE_KEY);
      if (savedProfile) {
        setUserProfile((prev) => ({ ...prev, ...JSON.parse(savedProfile) }));
      }
    } catch {
      // Ignore storage access errors
    }
    syncBackendProviderConfig();
  }, [syncBackendProviderConfig]);

  const handleUpdateConfig = (partial: Partial<CompanionConfig>) => {
    setConfig((prev) => {
      const updated = { ...prev, ...partial };
      try {
        window.localStorage.setItem(
          CONFIG_STORAGE_KEY,
          JSON.stringify(updated)
        );
      } catch {
        // Ignore quota errors
      }
      return updated;
    });
  };

  const handleUpdateProfile = (partial: Partial<UserProfile>) => {
    setUserProfile((prev) => {
      const updated = { ...prev, ...partial };
      try {
        window.localStorage.setItem(
          PROFILE_STORAGE_KEY,
          JSON.stringify(updated)
        );
      } catch {
        // Ignore
      }
      return updated;
    });
  };

  return (
    <>
      {!inSession ? (
        <LandingPage
          config={config}
          onUpdateConfig={handleUpdateConfig}
          onStartConversation={(firstMessage?: string) => {
            if (firstMessage) {
              setInitialPrompt(firstMessage);
            }
            setInSession(true);
          }}
        />
      ) : (
        <MainConversationView
          config={config}
          onUpdateConfig={handleUpdateConfig}
          userProfile={userProfile}
          onUpdateProfile={handleUpdateProfile}
          onEndSession={() => setInSession(false)}
          initialPrompt={initialPrompt}
          onClearInitialPrompt={() => setInitialPrompt(null)}
        />
      )}

      {/* Circular Floating Admin Access Button in Bottom-Right Corner */}
      <AdminFloatingButton
        isDark={config.theme === "dark"}
        inConversationView={inSession}
        onConfigUpdated={syncBackendProviderConfig}
      />
    </>
  );
}
