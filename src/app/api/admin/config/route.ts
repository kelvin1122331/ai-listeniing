import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { ServerConfigStore } from "@/lib/serverConfigStore";
import { providerFormSchema } from "@/lib/providerValidation";
import { NO_STORE, rejectCrossOrigin } from "@/lib/http";
const provider = z.enum(["gemini", "openai", "custom"]);
const actions = z.union([
  providerFormSchema.and(z.object({ action: z.literal("save_provider_config") })),
  z.object({ action: z.enum(["set_active_provider", "reset_provider_config"]), provider }),
  z.object({
    action: z.literal("update_settings"),
    systemSettings: z.object({ maintenanceMode: z.boolean(), enableRegistration: z.boolean(), enableMemory: z.boolean(), enableCamera: z.boolean(), enableVoice: z.boolean(), enableScreenSharing: z.boolean(), enableWakeWord: z.boolean() }).partial().optional(),
    voiceSettings: z.object({ voiceEnabled: z.boolean(), defaultVoice: z.string().max(80), realtimeVoiceModel: z.string().max(120), audioQuality: z.enum(["standard", "high", "ultra_low_latency"]), interruptibleVoice: z.boolean(), noiseSuppression: z.boolean() }).partial().optional(),
    visionSettings: z.object({ cameraVisionEnabled: z.boolean(), liveVisionEnabled: z.boolean(), presetMode: z.enum(["low_usage", "balanced", "high_responsiveness"]), frameSamplingIntervalSec: z.number().min(1).max(30), imageQuality: z.number().min(0.3).max(1), imageCompression: z.boolean() }).partial().optional(),
  }),
]);
export async function GET(req: NextRequest) {
  if (!verifyAdminRequest(req).authenticated) return NextResponse.json({ error: "Sesi admin berakhir." }, { status: 401, headers: NO_STORE });
  return NextResponse.json(ServerConfigStore.getAdminDashboardState(), { headers: NO_STORE });
}
export async function POST(req: NextRequest) {
  const rejected = rejectCrossOrigin(req); if (rejected) return rejected;
  if (!verifyAdminRequest(req).authenticated) return NextResponse.json({ error: "Sesi admin berakhir." }, { status: 401, headers: NO_STORE });
  try {
    let json: unknown; try { json = await req.json(); } catch { return NextResponse.json({ error: "Format permintaan tidak valid." }, { status: 400, headers: NO_STORE }); }
    const result = actions.safeParse(json);
    if (!result.success) return NextResponse.json({ error: "Konfigurasi tidak valid. Periksa model, penyedia, dan alamat API." }, { status: 400, headers: NO_STORE });
    const body = result.data;
    let state;
    if (body.action === "save_provider_config") state = ServerConfigStore.updateProviderConfig(body);
    else if (body.action === "set_active_provider") state = ServerConfigStore.setActiveProvider(body.provider);
    else if (body.action === "reset_provider_config") state = ServerConfigStore.resetProviderConfig(body.provider);
    else if (body.action === "update_settings") state = ServerConfigStore.updateSettings(body);
    else return NextResponse.json({ error: "Aksi tidak valid." }, { status: 400, headers: NO_STORE });
    return NextResponse.json({ message: "Pengaturan disimpan.", state }, { headers: NO_STORE });
  } catch (err) {
    const message = err instanceof Error && err.message.startsWith("Set CONFIG_") ? err.message : "Pengaturan gagal disimpan. Periksa izin tulis folder .data dan konfigurasi server.";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
