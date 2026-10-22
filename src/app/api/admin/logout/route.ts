import { NextRequest, NextResponse } from "next/server";
import { clearAdminCookie } from "@/lib/adminAuth";
import { NO_STORE, rejectCrossOrigin } from "@/lib/http";
export async function POST(req: NextRequest) {
  const rejected = rejectCrossOrigin(req); if (rejected) return rejected;
  const res = NextResponse.json({ authenticated: false }, { headers: NO_STORE });
  clearAdminCookie(res); return res;
}
