import { z } from "zod";
const model = z.string().trim().min(1).max(120).regex(/^[a-zA-Z0-9_./:-]+$/);
export const providerFormSchema = z.object({
  provider: z.enum(["gemini", "openai", "custom"]),
  apiKey: z.string().trim().max(500).optional(),
  textModel: model.optional(), visionModel: model.optional(), realtimeModel: model.optional(),
  voiceModel: z.string().trim().max(120).optional(), transcriptionModel: model.optional(), speechModel: model.optional(),
  baseUrl: z.string().trim().url().max(500).refine(value => {
    const url = new URL(value);
    return !url.username && !url.password && !url.search && !url.hash && (url.protocol === "https:" || process.env.NODE_ENV !== "production" && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname));
  }).optional(),
  clearKey: z.boolean().optional(), setAsActive: z.boolean().optional(),
}).refine(value => {
  if (!value.baseUrl || value.provider === "custom") return true;
  const url = new URL(value.baseUrl);
  return value.provider === "gemini" ? url.origin === "https://generativelanguage.googleapis.com" && url.pathname.replace(/\/$/, "") === "/v1beta" : url.origin === "https://api.openai.com" && url.pathname.replace(/\/$/, "") === "/v1";
}, "Alamat API penyedia resmi tidak valid.");
