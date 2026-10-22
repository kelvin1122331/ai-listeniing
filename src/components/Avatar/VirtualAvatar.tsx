"use client";
import { useEffect, useState } from "react";
import { AvatarExpression, AvatarPreset, ConversationState } from "@/types/companion";
import { VisemeFrame } from "@/services/LipSyncService";

interface Props {
  preset: AvatarPreset; aiName: string; conversationState: ConversationState;
  expression: AvatarExpression; visemeFrame: VisemeFrame; audioLevel: number;
  customAvatarUrl: string | null; subtitleText?: string; isDark: boolean;
  onSelectExpression?: (expression: AvatarExpression) => void;
}
export function VirtualAvatar({ preset, aiName, conversationState, expression, visemeFrame, customAvatarUrl }: Props) {
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => setBlink(true), 4200);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => { if (!blink) return; const timer = setTimeout(() => setBlink(false), 140); return () => clearTimeout(timer); }, [blink]);
  if (customAvatarUrl) return <img className="avatar-custom" src={customAvatarUrl} alt={"Avatar " + aiName} />;
  const speaking = conversationState === "SPEAKING";
  const mouth = speaking ? Math.max(3, visemeFrame.openness * 15) : 2;
  const happy = expression === "happy";
  return <svg viewBox="0 0 280 300" role="img" aria-label={"Avatar " + aiName} className="companion-avatar">
    <circle cx="140" cy="140" r="118" fill="var(--accent-soft)" />
    <path d="M47 300c0-63 28-91 93-91s93 28 93 91" fill="var(--accent)" />
    <path d="M117 195v29c10 17 36 17 46 0v-29" fill={preset.skinShadow} />
    <path d="M79 145c-15-100 130-111 124 2l-5 88-40-20-50 5-34 14z" fill={preset.hairColor} />
    <ellipse cx="83" cy="153" rx="12" ry="18" fill={preset.skinShadow} />
    <ellipse cx="197" cy="153" rx="12" ry="18" fill={preset.skinShadow} />
    <path d="M83 119q0-65 57-65t57 65v38c0 39-25 64-57 64s-57-25-57-64z" fill={preset.skinTone} />
    <path d="M79 132c-6-67 31-93 67-89 42 0 64 27 58 90-22-4-43-30-49-47-15 25-45 41-76 46" fill={preset.hairColor} />
    <path d="M103 137q12-6 23 0M155 137q12-6 23 0" fill="none" stroke={preset.hairColor} strokeWidth="3" strokeLinecap="round" />
    {blink ? <path d="M104 150h18m36 0h18" stroke={preset.hairColor} strokeWidth="3" strokeLinecap="round" /> : <g>
      <ellipse cx="114" cy="150" rx="5" ry="6" fill={preset.hairColor} /><ellipse cx="166" cy="150" rx="5" ry="6" fill={preset.hairColor} />
      <circle cx="115" cy="148" r="1.6" fill="white" /><circle cx="167" cy="148" r="1.6" fill="white" />
    </g>}
    <path d="m140 154-4 18h7" fill="none" stroke={preset.skinShadow} strokeWidth="2.5" strokeLinecap="round" />
    {speaking ? <ellipse cx="140" cy="188" rx={10 + visemeFrame.width * 6} ry={mouth} fill="#773d3d" /> : <path d={happy ? "M128 186q12 13 24 0" : "M130 188q10 6 20 0"} fill="none" stroke={preset.lipColor} strokeWidth="3" strokeLinecap="round" />}
  </svg>;
}
