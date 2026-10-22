import { NextResponse } from "next/server";
import { clearAdminCookie } from "@/lib/adminAuth";

export async function POST() {
  const res = NextResponse.json({
    authenticated: false,
    message: "Admin logged out successfully.",
  });
  clearAdminCookie(res);
  return res;
}
