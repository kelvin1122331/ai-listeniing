import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { AIProviderType, ServerConfigStore } from "@/lib/serverConfigStore";

export async function GET(req: NextRequest) {
  const session = verifyAdminRequest(req);
  if (!session.authenticated) {
    return NextResponse.json(
      { error: "Unauthorized admin request." },
      { status: 401 }
    );
  }

  return NextResponse.json(ServerConfigStore.getAdminDashboardState());
}

export async function POST(req: NextRequest) {
  const session = verifyAdminRequest(req);
  if (!session.authenticated) {
    return NextResponse.json(
      { error: "Unauthorized admin request." },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const action = body.action as string;

    if (action === "set_active_provider") {
      const provider = body.provider as AIProviderType;
      if (!["gemini", "openai", "custom"].includes(provider)) {
        return NextResponse.json(
          { error: "Invalid AI provider." },
          { status: 400 }
        );
      }
      const updated = ServerConfigStore.setActiveProvider(provider);
      return NextResponse.json({
        message: `${provider.toUpperCase()} berhasil diatur sebagai Active Provider.`,
        state: updated,
      });
    }

    if (action === "save_provider_config") {
      const provider = body.provider as AIProviderType;
      if (!["gemini", "openai", "custom"].includes(provider)) {
        return NextResponse.json(
          { error: "Invalid AI provider." },
          { status: 400 }
        );
      }
      const updated = ServerConfigStore.updateProviderConfig({
        provider,
        apiKey: body.apiKey,
        clearKey: Boolean(body.clearKey),
        textModel: body.textModel,
        realtimeModel: body.realtimeModel,
        visionModel: body.visionModel,
        voiceModel: body.voiceModel,
        transcriptionModel: body.transcriptionModel,
        speechModel: body.speechModel,
        baseUrl: body.baseUrl,
        setAsActive: Boolean(body.setAsActive),
      });

      return NextResponse.json({
        message: "Konfigurasi API berhasil dienkripsi dan disimpan di server.",
        state: updated,
      });
    }

    if (action === "reset_provider_config") {
      const provider = body.provider as AIProviderType;
      const updated = ServerConfigStore.resetProviderConfig(provider);
      return NextResponse.json({
        message: `Konfigurasi ${provider.toUpperCase()} dikembalikan ke pengaturan awal.`,
        state: updated,
      });
    }

    if (action === "update_settings") {
      const updated = ServerConfigStore.updateSettings({
        voiceSettings: body.voiceSettings,
        visionSettings: body.visionSettings,
        systemSettings: body.systemSettings,
      });
      return NextResponse.json({
        message: "Pengaturan sistem berhasil diperbarui.",
        state: updated,
      });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch {
    return NextResponse.json(
      { error: "Gagal menyimpan konfigurasi di server." },
      { status: 500 }
    );
  }
}
