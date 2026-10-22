import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AURA — AI Virtual Companion | Realtime Voice, Chat & Vision",
  description:
    "Talk to AI like it's really there. Chat, talk, and interact face-to-face with your AI companion powered by real-time voice, lip-sync, and camera vision.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body>
        {children}
      </body>
    </html>
  );
}
