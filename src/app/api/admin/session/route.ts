import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  const session = verifyAdminRequest(req);
  if (!session.authenticated) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({
    authenticated: true,
    username: session.username,
    expiresAt: session.expiresAt,
  });
}
