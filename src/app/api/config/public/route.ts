import { NextResponse } from "next/server";
import { ServerConfigStore } from "@/lib/serverConfigStore";

export async function GET() {
  return NextResponse.json(ServerConfigStore.getPublicCompanionConfig());
}
