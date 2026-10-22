"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AvatarExpression,
  AvatarPreset,
  ConversationState,
  VisemeShape,
} from "@/types/companion";
import { VisemeFrame, VISEME_SHAPES } from "@/services/LipSyncService";
import {
  Sparkles,
  Volume2,
  Mic,
  Brain,
  Eye,
  ScanEye,
  Zap,
} from "lucide-react";

interface VirtualAvatarProps {
  preset: AvatarPreset;
  aiName: string;
  conversationState: ConversationState;
  expression: AvatarExpression;
  visemeFrame: VisemeFrame;
  audioLevel: number; // 0.0 to 1.0
  customAvatarUrl: string | null;
  subtitleText?: string;
  isDark: boolean;
  onSelectExpression?: (expr: AvatarExpression) => void;
}

const ALL_EXPRESSIONS: AvatarExpression[] = [
  "idle",
  "listening",
  "thinking",
  "speaking",
  "watching",
  "interrupted",
  "happy",
  "confused",
  "surprised",
  "neutral",
];

export const VirtualAvatar: React.FC<VirtualAvatarProps> = ({
  preset,
  aiName,
  conversationState,
  expression,
  visemeFrame,
  audioLevel,
  customAvatarUrl,
  subtitleText,
  isDark,
  onSelectExpression,
}) => {
  // Natural eye blinking state
  const [isBlinking, setIsBlinking] = useState(false);
  // Subtle eye gaze target (-1 to 1)
  const [gaze, setGaze] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  // Subtle organic head tilt/nod
  const [headPose, setHeadPose] = useState<{ rotate: number; y: number }>({
    rotate: 0,
    y: 0,
  });

  // Natural blinking loop (random interval 2.4s - 5.2s)
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let blinkResetId: NodeJS.Timeout;

    const scheduleBlink = () => {
      const nextDelay = 2400 + Math.random() * 2800;
      timeoutId = setTimeout(() => {
        setIsBlinking(true);
        blinkResetId = setTimeout(() => {
          setIsBlinking(false);
          scheduleBlink();
        }, 140);
      }, nextDelay);
    };

    scheduleBlink();
    return () => {
      clearTimeout(timeoutId);
      clearTimeout(blinkResetId);
    };
  }, []);

  // Eye gaze & subtle head motion driven by Gemini conversationState & expression
  useEffect(() => {
    const interval = setInterval(() => {
      if (conversationState === "WATCHING" || expression === "watching") {
        // Scanning visual frame (left/center/right inspection)
        setGaze({
          x: Math.sin(Date.now() / 650) * 0.55,
          y: 0.12 + (Math.random() - 0.5) * 0.15,
        });
        setHeadPose({
          rotate: Math.sin(Date.now() / 900) * 2.4,
          y: 1.5,
        });
      } else if (
        conversationState === "INTERRUPTED" ||
        expression === "interrupted"
      ) {
        // Alert, attentive acknowledgment of user barge-in
        setGaze({ x: 0, y: -0.08 });
        setHeadPose({ rotate: 2.0, y: -2.5 });
      } else if (
        conversationState === "LISTENING" ||
        expression === "listening"
      ) {
        // Attentive focus on user with gentle nod
        setGaze({
          x: (Math.random() - 0.5) * 0.18,
          y: (Math.random() - 0.5) * 0.15,
        });
        setHeadPose({
          rotate: (Math.random() - 0.5) * 1.6,
          y: Math.sin(Date.now() / 400) * 2.5,
        });
      } else if (
        conversationState === "PROCESSING" ||
        expression === "thinking"
      ) {
        // Thoughtful upward/sideways gaze
        setGaze({
          x: 0.45 + (Math.random() - 0.5) * 0.15,
          y: -0.42 + (Math.random() - 0.5) * 0.15,
        });
        setHeadPose({
          rotate: -3.2,
          y: -2,
        });
      } else if (expression === "confused") {
        setGaze({ x: -0.25, y: -0.1 });
        setHeadPose({ rotate: 4.2, y: 0 });
      } else if (expression === "surprised") {
        setGaze({ x: 0, y: -0.15 });
        setHeadPose({ rotate: 0, y: -3.5 });
      } else {
        // Natural micro-saccades
        setGaze({
          x: (Math.random() - 0.5) * 0.35,
          y: (Math.random() - 0.5) * 0.25,
        });
        setHeadPose({
          rotate: (Math.random() - 0.5) * 2.2,
          y: (Math.random() - 0.5) * 2.0,
        });
      }
    }, 1100);

    return () => clearInterval(interval);
  }, [conversationState, expression]);

  // Compute eyebrow geometry based on expression
  const getEyebrowTransform = (side: "left" | "right") => {
    const dir = side === "left" ? 1 : -1;
    switch (expression) {
      case "surprised":
      case "interrupted":
        return { y: -5.5, rotate: -3.5 * dir };
      case "watching":
        return { y: -2.0, rotate: 2.5 * dir };
      case "confused":
        return {
          y: side === "left" ? -5 : 2,
          rotate: side === "left" ? -8 : 6,
        };
      case "thinking":
        return {
          y: side === "left" ? -3 : 1.5,
          rotate: side === "left" ? -5 : 4,
        };
      case "listening":
        return { y: -2.5, rotate: -2 * dir };
      case "happy":
        return { y: -2, rotate: -3 * dir };
      default:
        return { y: 0, rotate: 0 };
    }
  };

  // Compute mouth geometry from LipSync visemeFrame + audio amplitude fallback
  const isSpeaking =
    conversationState === "SPEAKING" || expression === "speaking";
  const activeViseme: VisemeFrame = isSpeaking
    ? visemeFrame
    : expression === "surprised"
      ? { viseme: "O", openness: 0.45, width: -0.25, jawDrop: 0.38 }
      : expression === "interrupted"
        ? { viseme: "E", openness: 0.18, width: 0.1, jawDrop: 0.14 }
        : VISEME_SHAPES.rest;

  const mouthOpenPx = Math.max(
    1.5,
    activeViseme.openness * 22 + (isSpeaking ? audioLevel * 8 : 0)
  );
  const mouthHalfWidth =
    21 +
    activeViseme.width * 10 +
    (expression === "happy" ? 4.5 : expression === "confused" ? -2.5 : 0);
  const smileCurve =
    expression === "happy"
      ? 8
      : expression === "confused"
        ? -3.5
        : expression === "listening" || expression === "watching"
          ? 3.0
          : 2.5;

  // Status badge configuration connected to Gemini state
  const getStateBadge = () => {
    switch (conversationState) {
      case "LISTENING":
        return {
          text: "Listening...",
          color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
          dot: "bg-emerald-400 animate-ping",
          icon: <Mic className="w-3.5 h-3.5 text-emerald-400" />,
        };
      case "PROCESSING":
        return {
          text: "Gemini Thinking...",
          color: "bg-amber-500/20 text-amber-300 border-amber-500/40",
          dot: "bg-amber-400 animate-pulse",
          icon: <Brain className="w-3.5 h-3.5 text-amber-400 animate-spin" />,
        };
      case "SPEAKING":
        return {
          text: "Speaking...",
          color: "bg-sky-500/20 text-sky-300 border-sky-500/40",
          dot: "bg-sky-400 animate-ping",
          icon: <Volume2 className="w-3.5 h-3.5 text-sky-400" />,
        };
      case "WATCHING":
        return {
          text: "Gemini Watching Frame...",
          color: "bg-indigo-500/20 text-indigo-300 border-indigo-500/40",
          dot: "bg-indigo-400 animate-ping",
          icon: <ScanEye className="w-3.5 h-3.5 text-indigo-400" />,
        };
      case "INTERRUPTED":
        return {
          text: "Interrupted • Listening...",
          color: "bg-rose-500/20 text-rose-300 border-rose-500/40",
          dot: "bg-rose-400 animate-ping",
          icon: <Zap className="w-3.5 h-3.5 text-rose-400" />,
        };
      default:
        return {
          text: "Gemini Ready",
          color: isDark
            ? "bg-slate-800/70 text-slate-300 border-slate-700/60"
            : "bg-white/80 text-slate-700 border-slate-300",
          dot: "bg-cyan-400",
          icon: <Sparkles className="w-3.5 h-3.5 text-cyan-400" />,
        };
    }
  };

  const badge = getStateBadge();
  const leftBrow = getEyebrowTransform("left");
  const rightBrow = getEyebrowTransform("right");
  const jawOffset = isSpeaking ? activeViseme.jawDrop * 6.5 : 0;

  return (
    <div className="relative flex flex-col items-center justify-center w-full min-h-0 select-none">
      {/* Ambient Futuristic Neural Glow Rings */}
      <div className="relative flex items-center justify-center w-[210px] h-[230px] sm:w-[250px] sm:h-[275px] md:w-[275px] md:h-[300px]">
        <motion.div
          animate={{
            scale:
              conversationState === "SPEAKING"
                ? [1, 1.08 + audioLevel * 0.12, 1]
                : conversationState === "LISTENING" ||
                    conversationState === "WATCHING"
                  ? [1, 1.05, 1]
                  : [1, 1.02, 1],
            opacity: conversationState === "IDLE" ? 0.35 : 0.65,
          }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-4 rounded-full blur-3xl pointer-events-none"
          style={{
            background: `radial-gradient(circle, ${preset.primaryColor}55 0%, ${preset.secondaryColor}25 55%, transparent 80%)`,
          }}
        />

        {/* Outer Futuristic HUD Ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 36, repeat: Infinity, ease: "linear" }}
          className="absolute w-[195px] h-[195px] sm:w-[235px] sm:h-[235px] md:w-[255px] md:h-[255px] rounded-full border border-dashed pointer-events-none opacity-30"
          style={{ borderColor: preset.primaryColor }}
        />

        {/* State Reactive Pulse Ring */}
        <AnimatePresence>
          {conversationState !== "IDLE" && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{
                scale: [0.96, 1.06, 0.96],
                opacity: [0.3, 0.7, 0.3],
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.8, repeat: Infinity }}
              className="absolute w-[180px] h-[180px] sm:w-[220px] sm:h-[220px] md:w-[240px] md:h-[240px] rounded-full border-2 pointer-events-none"
              style={{
                borderColor:
                  conversationState === "LISTENING"
                    ? "#10b981"
                    : conversationState === "PROCESSING"
                      ? "#f59e0b"
                      : conversationState === "WATCHING"
                        ? "#818cf8"
                        : conversationState === "INTERRUPTED"
                          ? "#f43f5e"
                          : preset.primaryColor,
              }}
            />
          )}
        </AnimatePresence>

        {/* Main Avatar Stage Container */}
        <motion.div
          animate={{
            y: [0, -5, 0],
          }}
          transition={{
            duration: 5.2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="relative z-10 flex items-center justify-center w-full h-full"
        >
          {customAvatarUrl ? (
            <div
              className="relative w-48 h-48 sm:w-56 sm:h-56 rounded-full overflow-hidden border-2 shadow-2xl"
              style={{ borderColor: preset.primaryColor }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={customAvatarUrl}
                alt={aiName}
                className="w-full h-full object-cover"
              />
              {isSpeaking && (
                <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-sky-500/40 to-transparent flex items-end justify-center pb-4">
                  <div className="px-3 py-1 rounded-full bg-slate-950/80 text-xs font-mono text-sky-300 border border-sky-400/40">
                    Viseme: {activeViseme.viseme}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Semi-Realistic Articulated Neural Human SVG Rig */
            <svg
              viewBox="0 0 320 380"
              className="w-full h-full drop-shadow-[0_18px_36px_rgba(0,0,0,0.45)]"
            >
              <defs>
                <radialGradient id="skinGrad" cx="48%" cy="38%" r="58%">
                  <stop offset="0%" stopColor={preset.skinTone} />
                  <stop offset="75%" stopColor={preset.skinTone} />
                  <stop offset="100%" stopColor={preset.skinShadow} />
                </radialGradient>

                <linearGradient id="neckGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={preset.skinShadow} />
                  <stop offset="40%" stopColor={preset.skinTone} />
                  <stop offset="100%" stopColor={preset.skinShadow} />
                </linearGradient>

                <linearGradient id="hairGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={preset.hairColor} />
                  <stop offset="50%" stopColor="#283556" />
                  <stop offset="100%" stopColor={preset.hairColor} />
                </linearGradient>

                <linearGradient id="suitGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#0f172a" />
                  <stop offset="50%" stopColor="#1e293b" />
                  <stop offset="100%" stopColor="#090d16" />
                </linearGradient>

                <radialGradient id="irisGrad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.2" />
                  <stop offset="35%" stopColor={preset.eyeColor} />
                  <stop offset="100%" stopColor="#082f49" />
                </radialGradient>
              </defs>

              {preset.hairStyle !== "neo_crop" && (
                <path
                  d="M 86 140 Q 70 235 92 305 L 228 305 Q 250 235 234 140 Z"
                  fill="url(#hairGrad)"
                />
              )}

              {/* Neck & Torso / Futuristic Collar */}
              <g>
                <path
                  d="M 134 242 L 134 305 L 186 305 L 186 242 Z"
                  fill="url(#neckGrad)"
                />
                <path
                  d="M 134 248 Q 160 272 186 248 L 186 266 Q 160 282 134 266 Z"
                  fill="rgba(0,0,0,0.18)"
                />
                <path
                  d="M 52 365 Q 68 302 128 292 L 160 315 L 192 292 Q 252 302 268 365 Z"
                  fill="url(#suitGrad)"
                  stroke={preset.primaryColor}
                  strokeWidth="1.5"
                  strokeOpacity="0.55"
                />
                <path
                  d="M 118 298 L 160 330 L 202 298"
                  fill="none"
                  stroke={preset.primaryColor}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  opacity="0.85"
                />
              </g>

              {/* Articulated Head Group */}
              <motion.g
                animate={{
                  rotate: headPose.rotate,
                  y: headPose.y,
                }}
                transition={{ duration: 0.75, ease: "easeOut" }}
                style={{ originX: "160px", originY: "210px" }}
              >
                <ellipse
                  cx="93"
                  cy="176"
                  rx="10"
                  ry="20"
                  fill={preset.skinShadow}
                />
                <ellipse
                  cx="227"
                  cy="176"
                  rx="10"
                  ry="20"
                  fill={preset.skinShadow}
                />

                <path
                  d={`M 96 135 Q 96 74 160 74 Q 224 74 224 135 Q 224 202 198 ${
                    236 + jawOffset * 0.6
                  } Q 160 ${268 + jawOffset} 122 ${
                    236 + jawOffset * 0.6
                  } Q 96 202 96 135 Z`}
                  fill="url(#skinGrad)"
                />

                <ellipse
                  cx="120"
                  cy="192"
                  rx="16"
                  ry="9"
                  fill="#f43f5e"
                  opacity={expression === "happy" ? 0.22 : 0.11}
                />
                <ellipse
                  cx="200"
                  cy="192"
                  rx="16"
                  ry="9"
                  fill="#f43f5e"
                  opacity={expression === "happy" ? 0.22 : 0.11}
                />

                {/* Eyebrows */}
                <motion.path
                  animate={{
                    y: leftBrow.y,
                    rotate: leftBrow.rotate,
                  }}
                  transition={{ duration: 0.22 }}
                  d="M 112 142 Q 128 134 145 140"
                  fill="none"
                  stroke={preset.hairColor}
                  strokeWidth="4.2"
                  strokeLinecap="round"
                />
                <motion.path
                  animate={{
                    y: rightBrow.y,
                    rotate: rightBrow.rotate,
                  }}
                  transition={{ duration: 0.22 }}
                  d="M 175 140 Q 192 134 208 142"
                  fill="none"
                  stroke={preset.hairColor}
                  strokeWidth="4.2"
                  strokeLinecap="round"
                />

                {/* Left Eye */}
                <g transform="translate(128, 162)">
                  {isBlinking ? (
                    <path
                      d="M -16 1 Q 0 6 16 1"
                      fill="none"
                      stroke={preset.hairColor}
                      strokeWidth="3.2"
                      strokeLinecap="round"
                    />
                  ) : (
                    <>
                      <path
                        d={
                          expression === "happy"
                            ? "M -16 1 Q 0 -11 16 1 Q 0 6 -16 1 Z"
                            : expression === "surprised" ||
                                expression === "interrupted"
                              ? "M -16 0 Q 0 -14 16 0 Q 0 13 -16 0 Z"
                              : "M -16 0 Q 0 -11 16 0 Q 0 10 -16 0 Z"
                        }
                        fill="#f8fafc"
                      />
                      <g
                        transform={`translate(${gaze.x * 5.5}, ${gaze.y * 3.5})`}
                      >
                        <circle cx="0" cy="0" r="7.5" fill="url(#irisGrad)" />
                        <circle cx="0" cy="0" r="3.6" fill="#090d16" />
                        <circle cx="-2.4" cy="-2.4" r="2.1" fill="#ffffff" />
                        <circle
                          cx="2.2"
                          cy="2.0"
                          r="1.0"
                          fill="#ffffff"
                          opacity="0.8"
                        />
                      </g>
                      <path
                        d="M -17 0 Q 0 -12 17 0"
                        fill="none"
                        stroke={preset.hairColor}
                        strokeWidth="2.8"
                        strokeLinecap="round"
                      />
                    </>
                  )}
                </g>

                {/* Right Eye */}
                <g transform="translate(192, 162)">
                  {isBlinking ? (
                    <path
                      d="M -16 1 Q 0 6 16 1"
                      fill="none"
                      stroke={preset.hairColor}
                      strokeWidth="3.2"
                      strokeLinecap="round"
                    />
                  ) : (
                    <>
                      <path
                        d={
                          expression === "happy"
                            ? "M -16 1 Q 0 -11 16 1 Q 0 6 -16 1 Z"
                            : expression === "surprised" ||
                                expression === "interrupted"
                              ? "M -16 0 Q 0 -14 16 0 Q 0 13 -16 0 Z"
                              : "M -16 0 Q 0 -11 16 0 Q 0 10 -16 0 Z"
                        }
                        fill="#f8fafc"
                      />
                      <g
                        transform={`translate(${gaze.x * 5.5}, ${gaze.y * 3.5})`}
                      >
                        <circle cx="0" cy="0" r="7.5" fill="url(#irisGrad)" />
                        <circle cx="0" cy="0" r="3.6" fill="#090d16" />
                        <circle cx="-2.4" cy="-2.4" r="2.1" fill="#ffffff" />
                        <circle
                          cx="2.2"
                          cy="2.0"
                          r="1.0"
                          fill="#ffffff"
                          opacity="0.8"
                        />
                      </g>
                      <path
                        d="M -17 0 Q 0 -12 17 0"
                        fill="none"
                        stroke={preset.hairColor}
                        strokeWidth="2.8"
                        strokeLinecap="round"
                      />
                    </>
                  )}
                </g>

                {/* Nose Bridge */}
                <path
                  d="M 158 158 L 155 190 Q 160 195 166 190"
                  fill="none"
                  stroke={preset.skinShadow}
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />

                {/* Lip-Sync Mouth */}
                <g transform={`translate(160, ${218 + jawOffset * 0.45})`}>
                  {mouthOpenPx > 3.2 ? (
                    <>
                      <path
                        d={`M ${-mouthHalfWidth} ${-smileCurve * 0.3} Q 0 ${
                          -mouthOpenPx * 0.55
                        } ${mouthHalfWidth} ${-smileCurve * 0.3} Q 0 ${
                          mouthOpenPx * 1.15 + smileCurve
                        } ${-mouthHalfWidth} ${-smileCurve * 0.3} Z`}
                        fill="#4c1d24"
                      />
                      <path
                        d={`M ${-mouthHalfWidth * 0.68} ${
                          -mouthOpenPx * 0.18
                        } Q 0 ${-mouthOpenPx * 0.05} ${mouthHalfWidth * 0.68} ${
                          -mouthOpenPx * 0.18
                        }`}
                        fill="none"
                        stroke="#f8fafc"
                        strokeWidth="3.2"
                        strokeLinecap="round"
                        opacity="0.9"
                      />
                      {mouthOpenPx > 7 && (
                        <ellipse
                          cx="0"
                          cy={mouthOpenPx * 0.35}
                          rx={mouthHalfWidth * 0.48}
                          ry={mouthOpenPx * 0.28}
                          fill="#e11d48"
                          opacity="0.55"
                        />
                      )}
                      <path
                        d={`M ${-mouthHalfWidth} ${-smileCurve * 0.3} Q 0 ${
                          -mouthOpenPx * 0.55
                        } ${mouthHalfWidth} ${-smileCurve * 0.3} Q 0 ${
                          mouthOpenPx * 1.15 + smileCurve
                        } ${-mouthHalfWidth} ${-smileCurve * 0.3} Z`}
                        fill="none"
                        stroke={preset.lipColor}
                        strokeWidth="3.6"
                        strokeLinejoin="round"
                      />
                    </>
                  ) : (
                    <path
                      d={`M ${-mouthHalfWidth} ${-smileCurve * 0.35} Q 0 ${smileCurve} ${mouthHalfWidth} ${-smileCurve * 0.35}`}
                      fill="none"
                      stroke={preset.lipColor}
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                  )}
                </g>

                {/* Front Hair */}
                <path
                  d={
                    preset.hairStyle === "neo_crop"
                      ? "M 92 140 Q 95 62 160 62 Q 225 62 228 140 Q 212 102 182 98 Q 160 112 135 96 Q 108 104 92 140 Z"
                      : "M 88 158 Q 88 60 160 60 Q 232 60 232 158 Q 220 105 188 96 Q 162 122 126 98 Q 100 114 88 158 Z"
                  }
                  fill="url(#hairGrad)"
                />

                {/* Cyber Neural Temple Accent */}
                <circle
                  cx="218"
                  cy="146"
                  r="3.5"
                  fill={preset.primaryColor}
                  className="animate-pulse"
                />
              </motion.g>
            </svg>
          )}
        </motion.div>

        {/* Floating Status Indicator Pill Around Avatar */}
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
          <div
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border backdrop-blur-md text-xs font-medium shadow-lg transition-all whitespace-nowrap ${badge.color}`}
          >
            <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
            {badge.icon}
            <span>{badge.text}</span>
          </div>

          <div
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full border backdrop-blur-md text-[11px] font-mono whitespace-nowrap ${
              isDark
                ? "bg-slate-900/70 border-slate-700/60 text-slate-300"
                : "bg-white/80 border-slate-300 text-slate-700"
            }`}
          >
            <Eye className="w-3 h-3 text-cyan-400" />
            <span className="capitalize">{expression}</span>
            <span className="opacity-40">|</span>
            <span className="text-sky-400">
              Lip:{activeViseme.viseme as VisemeShape}
            </span>
          </div>
        </div>

        {/* Voice Audio Waveform Bars Around Bottom of Avatar */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 h-7 px-3 py-1 rounded-full bg-slate-950/60 backdrop-blur-md border border-slate-800/70">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((idx) => {
            const centerDist = Math.abs(4 - idx);
            const activeFactor =
              conversationState === "SPEAKING" ||
              conversationState === "LISTENING"
                ? Math.max(
                    0.22,
                    (audioLevel || 0.35) * (1 - centerDist * 0.14)
                  )
                : 0.16;
            return (
              <motion.span
                key={idx}
                animate={{
                  height: `${Math.round(activeFactor * 22)}px`,
                }}
                transition={{ duration: 0.1 }}
                className="w-1 rounded-full"
                style={{
                  backgroundColor:
                    conversationState === "LISTENING"
                      ? "#10b981"
                      : conversationState === "WATCHING"
                        ? "#818cf8"
                        : conversationState === "INTERRUPTED"
                          ? "#f43f5e"
                          : preset.primaryColor,
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Live Subtitle / Spoken Response Overlay */}
      <AnimatePresence mode="wait">
        {subtitleText && (
          <motion.div
            key={subtitleText.slice(0, 35)}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className={`mt-1.5 max-w-xl text-center px-3.5 py-1.5 rounded-2xl border backdrop-blur-md text-xs sm:text-sm leading-snug shadow-lg line-clamp-2 ${
              isDark
                ? "bg-slate-900/75 border-slate-800 text-slate-200"
                : "bg-white/85 border-slate-200 text-slate-800"
            }`}
          >
            <span className="font-semibold text-sky-400 mr-1.5">{aiName}:</span>
            <span>
              {subtitleText.length > 140
                ? `${subtitleText.slice(0, 140)}...`
                : subtitleText}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expression State Selector Bar */}
      {onSelectExpression && (
        <div className="mt-1.5 hidden md:flex flex-wrap items-center justify-center gap-1 px-2 max-w-xl">
          {ALL_EXPRESSIONS.map((expr) => {
            const isActive = expression === expr;
            return (
              <button
                key={expr}
                type="button"
                onClick={() => onSelectExpression(expr)}
                className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize transition-all border ${
                  isActive
                    ? "bg-sky-500/20 text-sky-300 border-sky-400/50 shadow-sm"
                    : isDark
                      ? "bg-slate-900/50 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700"
                      : "bg-white/70 text-slate-600 border-slate-200 hover:text-slate-900"
                }`}
              >
                {expr}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
