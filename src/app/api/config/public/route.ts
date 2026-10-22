import { NextResponse } from "next/server";
import { ServerConfigStore } from "@/lib/serverConfigStore";
export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json(ServerConfigStore.getPublicCompanionConfig(), { headers: { "Cache-Control": "no-store" } }); }
