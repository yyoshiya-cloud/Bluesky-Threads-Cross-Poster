var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server.ts
var server_exports = {};
module.exports = __toCommonJS(server_exports);
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_vite = require("vite");
var import_crypto = __toESM(require("crypto"), 1);
var import_multer = __toESM(require("multer"), 1);
var import_genai = require("@google/genai");
var geminiClient = null;
function getGeminiClient() {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY \u304C\u8A2D\u5B9A\u3055\u308C\u3066\u3044\u307E\u305B\u3093\u3002AI Studio \u306E Secrets \u30D1\u30CD\u30EB\u3067\u8A2D\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
    }
    geminiClient = new import_genai.GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return geminiClient;
}
async function generateGeminiContentWithFallback(params) {
  const ai = getGeminiClient();
  const candidateModels = [
    params.preferredModel || "gemini-3.8-flash",
    "gemini-flash-latest",
    "gemini-3.1-flash-lite"
  ];
  const models = Array.from(new Set(candidateModels));
  let lastError = null;
  for (let mIdx = 0; mIdx < models.length; mIdx++) {
    const modelName = models[mIdx];
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        if (attempt > 1) {
          console.log(`[Gemini API] Retrying ${modelName} after 1.5s backoff (attempt ${attempt})...`);
          await new Promise((resolve) => setTimeout(resolve, 1500));
        } else if (mIdx > 0) {
          console.log(`[Gemini API] Falling back to alternative model: ${modelName}...`);
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
        const response = await ai.models.generateContent({
          model: modelName,
          contents: params.contents,
          config: params.config
        });
        return response;
      } catch (err) {
        lastError = err;
        const errMsg = err?.message || String(err);
        console.warn(`[Gemini API Warning] Model ${modelName} (attempt ${attempt}) failed:`, errMsg);
        const isTransient = errMsg.includes("503") || errMsg.includes("UNAVAILABLE") || errMsg.includes("high demand") || errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("overloaded") || errMsg.includes("FetchError") || errMsg.includes("ECONNRESET");
        if (!isTransient) {
          throw err;
        }
      }
    }
  }
  throw lastError;
}
function formatGeminiErrorMessage(err) {
  const raw = err?.message || String(err);
  if (raw.includes("503") || raw.includes("UNAVAILABLE") || raw.includes("high demand")) {
    return "\u73FE\u5728Google Gemini AI\u306E\u30B5\u30FC\u30D0\u30FC\u304C\u4E16\u754C\u7684\u306B\u4E00\u6642\u7684\u306A\u9AD8\u8CA0\u8377\uFF08\u6DF7\u96D1\uFF09\u3068\u306A\u3063\u3066\u3044\u307E\u3059\u3002\u6570\u5341\u79D2\u5F85\u3063\u3066\u304B\u3089\u518D\u5EA6\u300C\u5B9F\u884C\u300D\u3092\u304A\u8A66\u3057\u304F\u3060\u3055\u3044\u3002";
  }
  if (raw.includes("429") || raw.includes("RESOURCE_EXHAUSTED")) {
    return "Gemini AI\u306E\u30EA\u30AF\u30A8\u30B9\u30C8\u4E0A\u9650\u306B\u9054\u3057\u307E\u3057\u305F\u30021\u301C2\u5206\u307B\u3069\u6642\u9593\u3092\u7F6E\u3044\u3066\u304B\u3089\u518D\u5EA6\u304A\u8A66\u3057\u304F\u3060\u3055\u3044\u3002";
  }
  if (raw.includes("GEMINI_API_KEY")) {
    return "GEMINI_API_KEY \u304C\u672A\u8A2D\u5B9A\u3067\u3059\u3002AI Studio \u306E\u8A2D\u5B9A\u753B\u9762\u3067API\u30AD\u30FC\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002";
  }
  try {
    const jsonMatch = raw.match(/\{"error":\{.*\}\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed?.error?.message) {
        return `AI\u30A2\u30B7\u30B9\u30C8\u30A8\u30E9\u30FC: ${parsed.error.message}`;
      }
    }
  } catch {
  }
  return `AI\u30A2\u30B7\u30B9\u30C8\u30A8\u30E9\u30FC: ${raw}`;
}
var uploadMiddleware = (0, import_multer.default)({
  storage: import_multer.default.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }
  // 最大100MB
});
var mediaStorage = /* @__PURE__ */ new Map();
function resolveMediaBuffer(item) {
  const originalName = item.name || "";
  const ext = originalName.split(".").pop()?.toLowerCase() || "";
  const isExplicitVideo = item.mediaType === "video" || ["mp4", "mov", "webm", "m4v"].includes(ext);
  if (item.mediaId) {
    const cached = mediaStorage.get(item.mediaId);
    if (cached) {
      let mime = cached.mimeType || "application/octet-stream";
      if (isExplicitVideo && (!mime.startsWith("video/") || mime === "application/octet-stream")) {
        mime = ext === "mov" ? "video/quicktime" : "video/mp4";
      }
      return { buffer: cached.buffer, mimeType: mime };
    }
  }
  if (item.dataUrl && typeof item.dataUrl === "string") {
    const match = item.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      const mime = match[1];
      if (isExplicitVideo && mime.startsWith("image/")) {
        console.warn(`[resolveMediaBuffer] dataUrl is thumbnail image for video ${originalName}, skipping as video payload`);
        return null;
      }
      return {
        mimeType: mime,
        buffer: Buffer.from(match[2], "base64")
      };
    }
  }
  return null;
}
setInterval(() => {
  const now = Date.now();
  for (const [id, item] of mediaStorage.entries()) {
    if (now - item.createdAt > 30 * 60 * 1e3) {
      mediaStorage.delete(id);
    }
  }
}, 5 * 60 * 1e3);
function sanitizeInput(val) {
  if (typeof val !== "string") return "";
  return val.trim().replace(/^['"`]|['"`]$/g, "").replace(/[\u3000]/g, " ").trim();
}
function getExtensionFromMime(mimeType) {
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("quicktime") || mimeType.includes("mov")) return "mov";
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("gif")) return "gif";
  if (mimeType.includes("heic")) return "heic";
  if (mimeType.includes("avif")) return "avif";
  return "jpg";
}
function isVideoMime(mimeType) {
  return mimeType.startsWith("video/") || mimeType.includes("mp4") || mimeType.includes("quicktime") || mimeType.includes("webm");
}
async function uploadMediaToPublicHost(buffer, mimeType, fileName) {
  const ext = getExtensionFromMime(mimeType);
  const safeName = (fileName || "media").replace(/[^a-zA-Z0-9_-]/g, "_");
  const uploadName = `${safeName}.${ext}`;
  const isVideo = isVideoMime(mimeType);
  const sizeMb = (buffer.length / 1024 / 1024).toFixed(2);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const formData = new FormData();
      formData.append("files[]", new Blob([buffer], { type: mimeType }), uploadName);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), isVideo ? 9e4 : 3e4);
      const res = await fetch("https://uguu.se/upload", {
        method: "POST",
        body: formData,
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ThreadsPostBot/1.0"
        }
      });
      clearTimeout(timeout);
      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        const url = json?.files?.[0]?.url;
        if (url && typeof url === "string" && url.startsWith("http")) {
          console.log(`[PublicMedia] Fast Upload to Uguu success: ${url} (${mimeType}, size: ${sizeMb}MB)`);
          return url;
        }
      }
    } catch (err) {
      console.warn(`[PublicMedia] Uguu upload attempt #${attempt + 1} note: ${err.message}`);
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 1200));
      }
    }
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const formData = new FormData();
      formData.append("reqtype", "fileupload");
      formData.append("time", "24h");
      formData.append("fileToUpload", new Blob([buffer], { type: mimeType }), uploadName);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), isVideo ? 12e4 : 45e3);
      const res = await fetch("https://litterbox.catbox.moe/resources/internals/api.php", {
        method: "POST",
        body: formData,
        signal: controller.signal
      });
      clearTimeout(timeout);
      const text = (await res.text()).trim();
      if (res.ok && text.startsWith("http")) {
        console.log(`[PublicMedia] Uploaded to Litterbox success: ${text} (${mimeType}, size: ${sizeMb}MB)`);
        return text;
      }
    } catch (err) {
      console.warn(`[PublicMedia] Litterbox attempt #${attempt + 1} note: ${err.message}`);
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }
  return null;
}
async function uploadAllMediaForThreads(mediaList, baseUrl) {
  const results = [];
  const hasAnyVideo = mediaList.some((item) => {
    const ext = (item.name || "").split(".").pop()?.toLowerCase() || "";
    return item.mediaType === "video" || item.mimeType && isVideoMime(item.mimeType) || ["mp4", "mov", "webm", "m4v"].includes(ext) || item.dataUrl && item.dataUrl.startsWith("data:video/");
  });
  const BATCH_SIZE = hasAnyVideo ? 1 : 3;
  for (let i = 0; i < mediaList.length; i += BATCH_SIZE) {
    const batch = mediaList.slice(i, i + BATCH_SIZE);
    const batchItems = await Promise.all(
      batch.map(async (item, idx) => {
        const globalIdx = i + idx;
        const ext = (item.name || "").split(".").pop()?.toLowerCase() || "";
        const isExplicitVideo = item.mediaType === "video" || item.mimeType && isVideoMime(item.mimeType) || ["mp4", "mov", "webm", "m4v"].includes(ext) || item.dataUrl && item.dataUrl.startsWith("data:video/");
        if (item.dataUrl && (item.dataUrl.startsWith("http://") || item.dataUrl.startsWith("https://"))) {
          if (!item.dataUrl.includes(".run.app") && !item.dataUrl.includes("localhost")) {
            const detectedVideo = isExplicitVideo || isVideoMime(item.name || item.dataUrl);
            return {
              url: item.dataUrl,
              type: detectedVideo ? "VIDEO" : "IMAGE",
              alt: item.alt
            };
          }
        }
        const resolved = resolveMediaBuffer(item);
        if (!resolved) {
          console.warn(`[uploadAllMediaForThreads] Failed to resolve media buffer for item #${globalIdx + 1} (${item.name || "unnamed"})`);
          return null;
        }
        const { buffer, mimeType } = resolved;
        const isVideo = isExplicitVideo || isVideoMime(mimeType);
        const mediaId = item.mediaId || import_crypto.default.randomBytes(16).toString("hex");
        const existingCached = item.mediaId ? mediaStorage.get(item.mediaId) : null;
        if (existingCached?.publicUrl) {
          console.log(`[uploadAllMediaForThreads] Reusing cached public URL for #${globalIdx + 1}: ${existingCached.publicUrl}`);
          return {
            url: existingCached.publicUrl,
            fallbackUrl: `${baseUrl}/api/media/${mediaId}`,
            type: isVideo ? "VIDEO" : "IMAGE",
            alt: item.alt
          };
        }
        const cachedItem = existingCached || {
          buffer,
          mimeType,
          createdAt: Date.now()
        };
        mediaStorage.set(mediaId, cachedItem);
        const selfServerUrl = `${baseUrl}/api/media/${mediaId}`;
        console.log(`[uploadAllMediaForThreads] Uploading item #${globalIdx + 1}/${mediaList.length} (${isVideo ? "VIDEO" : "IMAGE"}, ${(buffer.length / 1024 / 1024).toFixed(2)}MB) to public CDN...`);
        const publicUrl = await uploadMediaToPublicHost(
          buffer,
          mimeType,
          item.name || (isVideo ? `video_${globalIdx + 1}.${ext || "mp4"}` : `image_${globalIdx + 1}.${ext || "jpg"}`)
        );
        if (publicUrl) {
          cachedItem.publicUrl = publicUrl;
        } else {
          console.warn(`[uploadAllMediaForThreads] Public CDN upload returned null for item #${globalIdx + 1}`);
          const isDevOrInternal = baseUrl.includes(".run.app") || baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1");
          if (isDevOrInternal) {
            throw new Error(`[Threads \u30E1\u30C7\u30A3\u30A2\u8EE2\u9001\u30A8\u30E9\u30FC] \u30E1\u30C7\u30A3\u30A2 #${globalIdx + 1}\uFF08${item.name || (isVideo ? "\u52D5\u753B" : "\u753B\u50CF")}\uFF09\u306E\u5916\u90E8\u516C\u958B\u30DB\u30B9\u30C6\u30A3\u30F3\u30B0\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002\u540C\u6642\u6295\u7A3F\u306B\u3088\u308B\u30CD\u30C3\u30C8\u30EF\u30FC\u30AF\u6DF7\u96D1\u306E\u53EF\u80FD\u6027\u304C\u3042\u308A\u307E\u3059\u3002\u518D\u5EA6\u304A\u8A66\u3057\u304F\u3060\u3055\u3044\u3002`);
          }
        }
        return {
          url: publicUrl || selfServerUrl,
          fallbackUrl: selfServerUrl,
          type: isVideo ? "VIDEO" : "IMAGE",
          alt: item.alt
        };
      })
    );
    for (const resItem of batchItems) {
      if (resItem) {
        results.push(resItem);
      }
    }
  }
  return results;
}
async function checkContainerStatus(containerId, accessToken) {
  try {
    const res = await fetch(
      `https://graph.threads.net/v1.0/${containerId}?fields=status,id,error_message&access_token=${encodeURIComponent(accessToken)}`
    );
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const code = errData?.error?.code ? `Code: ${errData.error.code}` : `HTTP ${res.status}`;
      return {
        status: "ERROR",
        error: `[Threads API\u30A8\u30E9\u30FC (${code})] ${errData?.error?.message || res.statusText}`,
        rawData: errData
      };
    }
    const data = await res.json().catch(() => ({}));
    const rawStatus = data.status || "";
    const status = typeof rawStatus === "string" ? rawStatus.toUpperCase() : data.error_message ? "ERROR" : void 0;
    const errMsg = data.error_message || data.error?.message || (data.status === "ERROR" ? "Meta\u5074\u3067\u306E\u753B\u50CF/\u52D5\u753B\u30A8\u30F3\u30B3\u30FC\u30C9\u51E6\u7406\u306B\u5931\u6557\u3057\u307E\u3057\u305F" : void 0);
    return { status, error: errMsg, rawData: data };
  } catch (err) {
    return { status: "ERROR", error: err.message };
  }
}
async function waitForContainerFinished(containerId, accessToken, maxWaitMs = 12e4) {
  const start = Date.now();
  let lastStatus = "UNKNOWN";
  let checkCount = 0;
  while (Date.now() - start < maxWaitMs) {
    checkCount++;
    const result = await checkContainerStatus(containerId, accessToken);
    lastStatus = result.status || "UNKNOWN";
    const elapsedSec = ((Date.now() - start) / 1e3).toFixed(1);
    if (checkCount === 1 || checkCount % 4 === 0 || result.status === "FINISHED") {
      console.log(`[Threads Container ${containerId}] Status: ${lastStatus} (elapsed: ${elapsedSec}s)`);
    }
    if (result.status === "FINISHED" || result.status === "PUBLISHED") {
      return;
    }
    if (result.status === "ERROR" || result.error) {
      const rawErrMsg = result.error || "Meta\u5074\u3067\u306E\u753B\u50CF/\u52D5\u753B\u51E6\u7406\u306B\u5931\u6557\u3057\u307E\u3057\u305F";
      let ratioHint = "";
      const lower = rawErrMsg.toLowerCase();
      if (lower.includes("aspect ratio") || lower.includes("ratio") || lower.includes("dimension")) {
        ratioHint = "\uFF08Threads\u5BFE\u5FDC\u306E\u30A2\u30B9\u30DA\u30AF\u30C8\u6BD4\u306F 1.91:1 \u304B\u3089 4:5 \u307E\u305F\u306F 9:16 \u3067\u3059\u3002\u6975\u7AEF\u306B\u6A2A\u9577\u307E\u305F\u306F\u7E26\u9577\u306E\u52D5\u753B\u306F\u62D2\u5426\u3055\u308C\u307E\u3059\uFF09";
      } else if (lower.includes("duration") || lower.includes("length")) {
        ratioHint = "\uFF08\u52D5\u753B\u306E\u518D\u751F\u6642\u9593\u306F 1\u79D2\u4EE5\u4E0A 5\u5206(300\u79D2) \u4EE5\u5185\u3067\u3042\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059\uFF09";
      } else if (lower.includes("format") || lower.includes("codec") || lower.includes("webm")) {
        ratioHint = "\uFF08Threads\u306F MP4 \u307E\u305F\u306F MOV \u5F62\u5F0F (H.264 / AAC) \u306E\u307F\u5BFE\u5FDC\u3057\u3066\u3044\u307E\u3059\uFF09";
      } else if (lower.includes("size") || lower.includes("large")) {
        ratioHint = "\uFF08\u30E1\u30C7\u30A3\u30A2\u30D5\u30A1\u30A4\u30EB\u306E\u5BB9\u91CF\u304C\u4E0A\u9650\u3092\u8D85\u3048\u3066\u3044\u307E\u3059\uFF09";
      } else if (lower.includes("download") || lower.includes("fetch") || lower.includes("timeout")) {
        ratioHint = "\uFF08Meta\u5074\u30B5\u30FC\u30D0\u30FC\u306B\u3088\u308B\u30E1\u30C7\u30A3\u30A2\u306E\u30C0\u30A6\u30F3\u30ED\u30FC\u30C9\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002\u5916\u90E8\u30CD\u30C3\u30C8\u30EF\u30FC\u30AF\u306E\u4E00\u6642\u7684\u306A\u6DF7\u96D1\u306E\u53EF\u80FD\u6027\u304C\u3042\u308A\u307E\u3059\uFF09";
      }
      throw new Error(`[Threads \u30E1\u30C7\u30A3\u30A2\u51E6\u7406\u30A8\u30E9\u30FC: ERROR] ${rawErrMsg}${ratioHint ? ` ${ratioHint}` : ""}`);
    }
    if (result.status === "EXPIRED") {
      throw new Error("[Threads API\u30A8\u30E9\u30FC: EXPIRED] \u30E1\u30C7\u30A3\u30A2\u30B3\u30F3\u30C6\u30CA\u306E\u6709\u52B9\u671F\u9650\u304C\u5207\u308C\u307E\u3057\u305F\u3002\u518D\u8A66\u884C\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
    }
    const waitDelay = checkCount === 1 ? 500 : checkCount <= 4 ? 800 : checkCount <= 8 ? 1200 : 1800;
    await new Promise((r) => setTimeout(r, waitDelay));
  }
  if (lastStatus === "IN_PROGRESS" || lastStatus === "UNKNOWN") {
    throw new Error(`[Threads API] \u30E1\u30C7\u30A3\u30A2\uFF08\u52D5\u753B\uFF09\u306E\u5909\u63DB\u51E6\u7406\u304C\u30BF\u30A4\u30E0\u30A2\u30A6\u30C8\u3057\u307E\u3057\u305F\uFF08Meta\u5074\u30B9\u30C6\u30FC\u30BF\u30B9: ${lastStatus}\uFF09\u3002Meta\u5074\u306E\u52D5\u753B\u30A8\u30F3\u30B3\u30FC\u30C9\u306B\u6642\u9593\u304C\u304B\u304B\u3063\u3066\u3044\u307E\u3059\u3002\u52D5\u753B\u304C\u9577\u5C3A\uFF08\u6570\u5206\uFF09\u306E\u5834\u5408\u306F\u3001\u5C11\u3057\u77ED\u304F\u3059\u308B\u304B\u5BB9\u91CF\u3092\u5C0F\u3055\u304F\u3057\u3066\u518D\u8A66\u884C\u3057\u3066\u304F\u3060\u3055\u3044\u3002`);
  }
}
var blueskyHandleDidCache = /* @__PURE__ */ new Map();
async function resolveBlueskyHandleToDid(handle, pdsEndpoint) {
  const cleanHandle = handle.replace(/^@/, "").trim().toLowerCase();
  if (!cleanHandle) return null;
  if (blueskyHandleDidCache.has(cleanHandle)) {
    return blueskyHandleDidCache.get(cleanHandle);
  }
  const endpoints = [
    pdsEndpoint,
    "https://public.api.bsky.app",
    "https://bsky.social"
  ];
  for (const ep of endpoints) {
    try {
      const url = `${ep.replace(/\/+$/, "")}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(cleanHandle)}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(url, { method: "GET", signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        if (data?.did && typeof data.did === "string") {
          blueskyHandleDidCache.set(cleanHandle, data.did);
          return data.did;
        }
      }
    } catch {
    }
  }
  return null;
}
async function generateBlueskyFacets(text, pdsEndpoint) {
  if (!text || typeof text !== "string") return [];
  const facets = [];
  const urlRegex = /https?:\/\/[^\s<>()"']+/g;
  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    let url = match[0];
    let endIndex = match.index + url.length;
    while (/[.,!?:;)\]\}'"]$/.test(url) && url.length > 0) {
      url = url.slice(0, -1);
      endIndex -= 1;
    }
    if (url.length > 0) {
      const byteStart = Buffer.from(text.slice(0, match.index), "utf8").length;
      const byteEnd = Buffer.from(text.slice(0, endIndex), "utf8").length;
      facets.push({
        index: { byteStart, byteEnd },
        features: [
          {
            $type: "app.bsky.richtext.facet#link",
            uri: url
          }
        ]
      });
    }
  }
  const mentionRegex = /(^|\s)(@([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)/g;
  while ((match = mentionRegex.exec(text)) !== null) {
    const prefix = match[1] || "";
    const fullMention = match[2];
    const handle = fullMention.replace(/^@/, "");
    const matchIndex = match.index + prefix.length;
    const matchEndIndex = matchIndex + fullMention.length;
    const did = await resolveBlueskyHandleToDid(handle, pdsEndpoint);
    if (did) {
      const byteStart = Buffer.from(text.slice(0, matchIndex), "utf8").length;
      const byteEnd = Buffer.from(text.slice(0, matchEndIndex), "utf8").length;
      facets.push({
        index: { byteStart, byteEnd },
        features: [
          {
            $type: "app.bsky.richtext.facet#mention",
            did
          }
        ]
      });
    }
  }
  const tagRegex = /(^|\s)(#([^\s#.,!?:;()[\]{}'"]+))/g;
  while ((match = tagRegex.exec(text)) !== null) {
    const prefix = match[1] || "";
    const fullTag = match[2];
    const tagValue = match[3];
    const matchIndex = match.index + prefix.length;
    const matchEndIndex = matchIndex + fullTag.length;
    if (tagValue && tagValue.length > 0) {
      const byteStart = Buffer.from(text.slice(0, matchIndex), "utf8").length;
      const byteEnd = Buffer.from(text.slice(0, matchEndIndex), "utf8").length;
      facets.push({
        index: { byteStart, byteEnd },
        features: [
          {
            $type: "app.bsky.richtext.facet#tag",
            tag: tagValue
          }
        ]
      });
    }
  }
  facets.sort((a, b) => a.index.byteStart - b.index.byteStart);
  return facets;
}
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json({ limit: "100mb" }));
  app.use(import_express.default.urlencoded({ extended: true, limit: "100mb" }));
  app.use("/api", (req, _res, next) => {
    if (req.path !== "/health") {
      const ua = req.headers["user-agent"] || "";
      let clientBrowser = "Unknown";
      if (ua.includes("Edg/")) {
        const ver = ua.match(/Edg\/([\d.]+)/)?.[1] || "";
        clientBrowser = `Microsoft Edge ${ver}`.trim();
      } else if (ua.includes("Chrome/")) {
        const ver = ua.match(/Chrome\/([\d.]+)/)?.[1] || "";
        clientBrowser = `Google Chrome ${ver}`.trim();
      } else if (ua.includes("Firefox/")) {
        const ver = ua.match(/Firefox\/([\d.]+)/)?.[1] || "";
        clientBrowser = `Mozilla Firefox ${ver}`.trim();
      } else if (ua.includes("Safari/")) {
        clientBrowser = "Safari";
      }
      console.log(`[API] ${req.method} /api${req.path} [${clientBrowser}]`);
    }
    next();
  });
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", time: (/* @__PURE__ */ new Date()).toISOString() });
  });
  app.get("/api/clipboard/read", (_req, res) => {
    res.json({ text: "" });
  });
  app.post("/api/clipboard/write", import_express.default.json(), (_req, res) => {
    res.json({ status: "ok" });
  });
  const ogpCache = /* @__PURE__ */ new Map();
  app.get("/api/ogp", async (req, res) => {
    try {
      const targetUrl = typeof req.query.url === "string" ? req.query.url.trim() : "";
      if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
        res.status(400).json({ success: false, error: "\u6709\u52B9\u306AURL\uFF08http\u307E\u305F\u306Fhttps\uFF09\u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044\u3002" });
        return;
      }
      const cached = ogpCache.get(targetUrl);
      if (cached && cached.expiresAt > Date.now()) {
        res.json({ success: true, ...cached.data, cached: true });
        return;
      }
      let parsedDomain = "";
      try {
        parsedDomain = new URL(targetUrl).hostname;
      } catch {
        parsedDomain = targetUrl;
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6e3);
      const response = await fetch(targetUrl, {
        method: "GET",
        signal: controller.signal,
        headers: {
          "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php) Twitterbot/1.0 Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "ja,en-US;q=0.9,en;q=0.8"
        }
      });
      clearTimeout(timeout);
      if (!response.ok) {
        res.json({
          success: true,
          url: targetUrl,
          domain: parsedDomain,
          title: parsedDomain,
          description: "",
          image: ""
        });
        return;
      }
      const htmlText = await response.text();
      const cleanHtml = htmlText.slice(0, 5e5);
      const extractMeta = (regexes) => {
        for (const regex of regexes) {
          const match = regex.exec(cleanHtml);
          if (match && match[1]) {
            return match[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
          }
        }
        return "";
      };
      const title = extractMeta([
        /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
        /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i,
        /<title[^>]*>([^<]+)<\/title>/i
      ]) || parsedDomain;
      const description = extractMeta([
        /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i,
        /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']+)["']/i
      ]);
      let image = extractMeta([
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
        /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i
      ]);
      if (image && !image.startsWith("http://") && !image.startsWith("https://")) {
        try {
          image = new URL(image, targetUrl).toString();
        } catch {
        }
      }
      const ogpResult = {
        url: targetUrl,
        domain: parsedDomain,
        title,
        description,
        image
      };
      ogpCache.set(targetUrl, { data: ogpResult, expiresAt: Date.now() + 3600 * 1e3 });
      res.json({
        success: true,
        ...ogpResult
      });
    } catch (err) {
      console.warn("[OGP Fetch Error]:", err.message);
      let domain = "";
      try {
        domain = new URL(typeof req.query.url === "string" ? req.query.url : "").hostname;
      } catch {
      }
      res.json({
        success: true,
        url: req.query.url,
        domain: domain || "link",
        title: domain || "Web\u30DA\u30FC\u30B8",
        description: "",
        image: ""
      });
    }
  });
  app.post("/api/shorten-url", async (req, res) => {
    try {
      const { url } = req.body;
      const cleanUrl = typeof url === "string" ? url.trim() : "";
      if (!cleanUrl || !/^https?:\/\//i.test(cleanUrl)) {
        res.status(400).json({ success: false, error: "\u6709\u52B9\u306AURL\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002" });
        return;
      }
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6e3);
        const tinyRes = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(cleanUrl)}`, {
          signal: controller.signal
        });
        clearTimeout(timeout);
        if (tinyRes.ok) {
          const shortUrl = (await tinyRes.text()).trim();
          if (shortUrl.startsWith("http")) {
            res.json({ success: true, originalUrl: cleanUrl, shortUrl });
            return;
          }
        }
      } catch (e) {
        console.warn("[TinyURL error]:", e.message);
      }
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6e3);
        const isgdRes = await fetch(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(cleanUrl)}`, {
          signal: controller.signal
        });
        clearTimeout(timeout);
        if (isgdRes.ok) {
          const shortUrl = (await isgdRes.text()).trim();
          if (shortUrl.startsWith("http")) {
            res.json({ success: true, originalUrl: cleanUrl, shortUrl });
            return;
          }
        }
      } catch (e) {
        console.warn("[is.gd error]:", e.message);
      }
      res.status(500).json({
        success: false,
        error: "URL\u77ED\u7E2E\u30B5\u30FC\u30D3\u30B9\u3078\u306E\u30A2\u30AF\u30BB\u30B9\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002\u5F8C\u307B\u3069\u518D\u8A66\u884C\u3057\u3066\u304F\u3060\u3055\u3044\u3002"
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: `URL\u77ED\u7E2E\u30A8\u30E9\u30FC: ${err.message || "\u5185\u90E8\u30A8\u30E9\u30FC"}`
      });
    }
  });
  app.post("/api/ai/thread-split", async (req, res) => {
    try {
      const { text, targetPlatform = "both", includeNumbering = true } = req.body;
      const cleanText = typeof text === "string" ? text.trim() : "";
      if (!cleanText) {
        res.status(400).json({ success: false, error: "\u5206\u5272\u5BFE\u8C61\u306E\u30C6\u30AD\u30B9\u30C8\u304C\u5165\u529B\u3055\u308C\u3066\u3044\u307E\u305B\u3093\u3002" });
        return;
      }
      const platformConstraints = targetPlatform === "bluesky" ? "\u5BFE\u8C61\u30D7\u30E9\u30C3\u30C8\u30D5\u30A9\u30FC\u30E0: Bluesky (\u5404\u30DD\u30B9\u30C8\u306F\u5168\u89D2300\u6587\u5B57\u4EE5\u5185\u3001\u7C21\u6F54\u3067\u77E5\u7684\u306A\u77E5\u898B\u5171\u6709)" : targetPlatform === "threads" ? "\u5BFE\u8C61\u30D7\u30E9\u30C3\u30C8\u30D5\u30A9\u30FC\u30E0: Threads (\u5404\u30DD\u30B9\u30C8\u306F\u5168\u89D2500\u6587\u5B57\u4EE5\u5185\u3001\u89AA\u3057\u307F\u3084\u3059\u304F\u8AAD\u307F\u3084\u3059\u3044\u30D5\u30C3\u30AF\u91CD\u8996)" : "\u5BFE\u8C61\u30D7\u30E9\u30C3\u30C8\u30D5\u30A9\u30FC\u30E0: Bluesky(300\u6587\u5B57\u4EE5\u5185) \u3068 Threads(500\u6587\u5B57\u4EE5\u5185) \u306E\u4E21\u7ACB\u3002\u5404\u30DD\u30B9\u30C8\u306F\u5B89\u5168\u306E\u305F\u3081\u5168\u89D2280\u6587\u5B57\u4EE5\u5185\u306B\u53CE\u3081\u3066\u304F\u3060\u3055\u3044\u3002";
      const prompt = `\u3042\u306A\u305F\u306FSNS\u904B\u7528\u306E\u30D7\u30ED\u30D5\u30A7\u30C3\u30B7\u30E7\u30CA\u30EB\u3067\u3059\u3002\u4EE5\u4E0B\u306E\u9577\u6587\u30C6\u30AD\u30B9\u30C8\u3092\u3001\u8AAD\u307F\u3084\u3059\u304F\u9B45\u529B\u7684\u306A\u300C\u30C4\u30EA\u30FC\u5F62\u5F0F\uFF08\u30B9\u30EC\u30C3\u30C9\u5206\u5272\u6295\u7A3F\uFF09\u300D\u306B\u518D\u69CB\u6210\u30FB\u5206\u5272\u3057\u3066\u304F\u3060\u3055\u3044\u3002

\u3010\u91CD\u8981\u306A\u5236\u7D04\u3068\u76EE\u7684\u3011
1. \u6A5F\u68B0\u7684\u306A\u6587\u5B57\u6570\u30AB\u30A6\u30F3\u30C8\u306B\u3088\u308B\u3076\u3064\u5207\u308A\uFF08\u5358\u8A9E\u306E\u9014\u4E2D\u3084\u53E5\u8AAD\u70B9\u524D\u3067\u306E\u4E0D\u81EA\u7136\u306A\u5207\u65AD\uFF09\u306F\u53B3\u7981\u3067\u3059\u3002
2. \u610F\u5473\u306E\u307E\u3068\u307E\u308A\u3001\u6BB5\u843D\u3001\u8D77\u627F\u8EE2\u7D50\u3001\u6587\u672B\uFF08\u3067\u3059\u30FB\u307E\u3059\u7B49\uFF09\u306E\u81EA\u7136\u306A\u533A\u5207\u308A\u3092\u5FC5\u305A\u7DAD\u6301\u3057\u3066\u304F\u3060\u3055\u3044\u3002
3. 1\u30DD\u30B9\u30C8\u76EE\u306B\u306F\u3001\u8AAD\u8005\u306E\u95A2\u5FC3\u3092\u60F9\u304F\u30D5\u30C3\u30AF\uFF08\u6982\u8981\u30FB\u554F\u3044\u304B\u3051\u30FB\u8981\u70B9\uFF09\u3092\u7F6E\u304D\u3001\u4EE5\u964D\u306E\u30DD\u30B9\u30C8\u3067\u8A73\u7D30\u3084\u7D50\u8AD6\u3092\u5C55\u958B\u3057\u3066\u304F\u3060\u3055\u3044\u3002
4. ${platformConstraints}
5. \u30CA\u30F3\u30D0\u30EA\u30F3\u30B0(${includeNumbering ? "\u6709\u52B9: \u4F8B\u300C(1/3)\u300D\u300C(2/3)\u300D" : "\u4E0D\u8981"})\uFF1A${includeNumbering ? "\u5404\u30DD\u30B9\u30C8\u306E\u672B\u5C3E\u306B (1/N) \u3084 (2/N) \u306A\u3069\u306E\u9023\u756A\u3092\u4ED8\u4E0E\u3057\u3066\u304F\u3060\u3055\u3044\u3002" : "\u9023\u756A\u306F\u542B\u3081\u306A\u3044\u3067\u304F\u3060\u3055\u3044\u3002"}
6. \u5143\u30C6\u30AD\u30B9\u30C8\u306E\u91CD\u8981\u306A\u60C5\u5831\u3084URL\u3001\u30CB\u30E5\u30A2\u30F3\u30B9\u3092\u6B20\u843D\u3055\u305B\u306A\u3044\u3067\u304F\u3060\u3055\u3044\u3002

\u3010\u5165\u529B\u30C6\u30AD\u30B9\u30C8\u3011
${cleanText}
`;
      const response = await generateGeminiContentWithFallback({
        preferredModel: "gemini-3.8-flash",
        contents: prompt,
        config: {
          systemInstruction: "\u3042\u306A\u305F\u306F\u65E5\u672C\u8A9E\u306ESNS\u30E9\u30A4\u30C6\u30A3\u30F3\u30B0\u30FB\u30B9\u30EC\u30C3\u30C9\u69CB\u6210\u306E\u5C02\u9580\u5BB6\u3067\u3059\u3002\u6307\u5B9A\u3055\u308C\u305FJSON\u5F62\u5F0F\u306E\u307F\u3092\u51FA\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
          responseMimeType: "application/json",
          responseSchema: {
            type: import_genai.Type.OBJECT,
            properties: {
              posts: {
                type: import_genai.Type.ARRAY,
                items: { type: import_genai.Type.STRING },
                description: "\u81EA\u7136\u306A\u6587\u8108\u3067\u5206\u5272\u3055\u308C\u305F\u5404\u30DD\u30B9\u30C8\u306E\u672C\u6587\u914D\u5217"
              },
              summary: {
                type: import_genai.Type.STRING,
                description: "\u30B9\u30EC\u30C3\u30C9\u69CB\u6210\u306E\u610F\u56F3\u3084\u5DE5\u592B\u3057\u305F\u30DD\u30A4\u30F3\u30C8\uFF081\u301C2\u6587\uFF09"
              }
            },
            required: ["posts", "summary"]
          }
        }
      });
      const responseText = response.text || "{}";
      let parsed;
      try {
        parsed = JSON.parse(responseText);
      } catch {
        res.status(500).json({ success: false, error: "AI\u304B\u3089\u306E\u30EC\u30B9\u30DD\u30F3\u30B9\u89E3\u6790\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002" });
        return;
      }
      if (!parsed.posts || !Array.isArray(parsed.posts) || parsed.posts.length === 0) {
        res.status(500).json({ success: false, error: "\u30B9\u30EC\u30C3\u30C9\u5206\u5272\u7D50\u679C\u3092\u751F\u6210\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002" });
        return;
      }
      const formattedText = parsed.posts.join("\n---\n");
      res.json({
        success: true,
        posts: parsed.posts,
        formattedText,
        summary: parsed.summary || "\u6587\u8108\u3092\u8003\u616E\u3057\u3066\u8AAD\u307F\u3084\u3059\u3044\u30B9\u30EC\u30C3\u30C9\u306B\u5206\u5272\u3057\u307E\u3057\u305F\u3002",
        postCount: parsed.posts.length
      });
    } catch (err) {
      console.error("[AI Thread Split Error]:", err);
      res.status(500).json({
        success: false,
        error: formatGeminiErrorMessage(err)
      });
    }
  });
  app.post("/api/ai/rewrite-tone", async (req, res) => {
    try {
      const { text } = req.body;
      const cleanText = typeof text === "string" ? text.trim() : "";
      if (!cleanText) {
        res.status(400).json({ success: false, error: "\u30EA\u30E9\u30A4\u30C8\u5BFE\u8C61\u306E\u30C6\u30AD\u30B9\u30C8\u304C\u5165\u529B\u3055\u308C\u3066\u3044\u307E\u305B\u3093\u3002" });
        return;
      }
      const prompt = `\u3042\u306A\u305F\u306FSNS\uFF08Bluesky\u3068Threads\uFF09\u306E\u7279\u6027\u3092\u719F\u77E5\u3057\u305F\u30D7\u30ED\u306E\u30BD\u30FC\u30B7\u30E3\u30EB\u30E1\u30C7\u30A3\u30A2\u30E9\u30A4\u30BF\u30FC\u3067\u3059\u3002
\u4E0E\u3048\u3089\u308C\u305F\u6295\u7A3F\u30C6\u30AD\u30B9\u30C8\u306E\u4E3B\u8981\u60C5\u5831\u3001URL\u3001\u544A\u77E5\u5185\u5BB9\u3092\u6B63\u78BA\u306B\u7DAD\u6301\u3057\u305F\u307E\u307E\u3001\u4EE5\u4E0B\u306E2\u3064\u306E\u30D7\u30E9\u30C3\u30C8\u30D5\u30A9\u30FC\u30E0\u306B\u6700\u9069\u5316\u3055\u308C\u305F\u30C8\u30FC\u30F3\uFF06\u30DE\u30CA\u30FC\u306B\u66F8\u304D\u5206\u3051\u3066\u304F\u3060\u3055\u3044\u3002

\u3010\u30D7\u30E9\u30C3\u30C8\u30D5\u30A9\u30FC\u30E0\u7279\u6027\u306E\u9055\u3044\u3011
\u25A0 Bluesky\u5411\u3051 (blueskyText):
- \u60F3\u5B9A\u8AAD\u8005: \u958B\u767A\u8005\u3001\u30C6\u30C3\u30AF\u5C64\u3001\u30AF\u30EA\u30A8\u30A4\u30BF\u30FC\u3001\u843D\u3061\u7740\u3044\u305F\u77E5\u898B\u30FB\u30AA\u30D4\u30CB\u30AA\u30F3\u3092\u597D\u3080\u30E6\u30FC\u30B6\u30FC\u3002
- \u30C8\u30FC\u30F3: \u77E5\u7684\u30FB\u8AD6\u7406\u7684\u30FB\u660E\u5FEB\u30FB\u843D\u3061\u7740\u3044\u305F\u30C8\u30FC\u30F3\u3002\u904E\u5EA6\u306A\u611F\u60C5\u8868\u73FE\u3084\u6D3E\u624B\u306A\u7D75\u6587\u5B57\u306E\u591A\u7528\u306F\u907F\u3051\u3001\u8981\u70B9\u3084\u80CC\u666F\u3001\u5B9F\u7528\u7684\u306A\u4FA1\u5024\u3092\u30AF\u30EA\u30A2\u306B\u63D0\u793A\u3002
- \u6587\u5B57\u6570: \u5168\u89D2300\u6587\u5B57\u4EE5\u5185\u3002
- \u30CF\u30C3\u30B7\u30E5\u30BF\u30B0: 1\u301C2\u500B\u7A0B\u5EA6\u306E\u9069\u5207\u306A\u30CF\u30C3\u30B7\u30E5\u30BF\u30B0\uFF08\u4F8B: #\u30D7\u30ED\u30B0\u30E9\u30DF\u30F3\u30B0 #Web\u958B\u767A \u306A\u3069\uFF09\u3002

\u25A0 Threads\u5411\u3051 (threadsText):
- \u60F3\u5B9A\u8AAD\u8005: \u30AB\u30B8\u30E5\u30A2\u30EB\u3001\u65E5\u5E38\u7684\u3001\u5171\u611F\u3092\u91CD\u8996\u3059\u308B\u5E45\u5E83\u3044\u4E00\u822C\u301C\u30D3\u30B8\u30CD\u30B9\u30E6\u30FC\u30B6\u30FC\u3002
- \u30C8\u30FC\u30F3: \u89AA\u3057\u307F\u3084\u3059\u304F\u6E29\u304B\u307F\u306E\u3042\u308B\u8A9E\u308A\u53E3\u3002\u9069\u5EA6\u306A\u7D75\u6587\u5B57\uFF08\u6587\u982D\u3084\u7B87\u6761\u66F8\u304D\u306E\u88C5\u98FE\uFF09\u3001\u8AAD\u8005\u306E\u5171\u611F\u3092\u547C\u3076\u5192\u982D\u306E1\u884C\u30D5\u30C3\u30AF\u3001\u6700\u5F8C\u306B\u300C\u301C\u7686\u3055\u3093\u306F\u3069\u3046\u601D\u3044\u307E\u3059\u304B\uFF1F\u300D\u306A\u3069\u306E\u30EA\u30A2\u30AF\u30B7\u30E7\u30F3\u3092\u4FC3\u3059\u554F\u3044\u304B\u3051\u3002
- \u6587\u5B57\u6570: \u5168\u89D2500\u6587\u5B57\u4EE5\u5185\u3002
- \u30CF\u30C3\u30B7\u30E5\u30BF\u30B0: \u30C8\u30D4\u30C3\u30AF\u306B\u6EB6\u3051\u8FBC\u30801\u500B\u7A0B\u5EA6\u3001\u307E\u305F\u306F\u672C\u6587\u4E2D\u306E\u30AD\u30FC\u30EF\u30FC\u30C9\u3002

\u3010\u5165\u529B\u30C6\u30AD\u30B9\u30C8\u3011
${cleanText}
`;
      const response = await generateGeminiContentWithFallback({
        preferredModel: "gemini-3.8-flash",
        contents: prompt,
        config: {
          systemInstruction: "\u3042\u306A\u305F\u306FSNS\u6587\u4F53\u6700\u9069\u5316\u306E\u5C02\u9580\u5BB6\u3067\u3059\u3002\u6307\u5B9A\u3055\u308C\u305FJSON\u5F62\u5F0F\u306E\u307F\u3092\u51FA\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
          responseMimeType: "application/json",
          responseSchema: {
            type: import_genai.Type.OBJECT,
            properties: {
              blueskyText: {
                type: import_genai.Type.STRING,
                description: "Bluesky\u5411\u3051\u306B\u843D\u3061\u7740\u3044\u305F\u77E5\u898B\u30FB\u958B\u767A\u8005\u5411\u3051\u30C8\u30FC\u30F3\u306B\u30EA\u30E9\u30A4\u30C8\u3057\u305F\u672C\u6587\uFF08300\u6587\u5B57\u4EE5\u5185\uFF09"
              },
              threadsText: {
                type: import_genai.Type.STRING,
                description: "Threads\u5411\u3051\u306B\u89AA\u3057\u307F\u3084\u3059\u304F\u5171\u611F\u30FB\u30D5\u30C3\u30AF\u3092\u91CD\u8996\u3057\u3066\u30EA\u30E9\u30A4\u30C8\u3057\u305F\u672C\u6587\uFF08500\u6587\u5B57\u4EE5\u5185\uFF09"
              },
              notes: {
                type: import_genai.Type.STRING,
                description: "\u30C8\u30FC\u30F3\u66F8\u304D\u5206\u3051\u306E\u30DD\u30A4\u30F3\u30C8\u3084\u5DE5\u592B\uFF081\u301C2\u6587\uFF09"
              }
            },
            required: ["blueskyText", "threadsText", "notes"]
          }
        }
      });
      const responseText = response.text || "{}";
      let parsed;
      try {
        parsed = JSON.parse(responseText);
      } catch {
        res.status(500).json({ success: false, error: "AI\u304B\u3089\u306E\u30EC\u30B9\u30DD\u30F3\u30B9\u89E3\u6790\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002" });
        return;
      }
      res.json({
        success: true,
        blueskyText: parsed.blueskyText,
        threadsText: parsed.threadsText,
        notes: parsed.notes || "\u5404SNS\u306E\u8AAD\u8005\u5C64\u3068\u30AB\u30EB\u30C1\u30E3\u30FC\u306B\u5408\u308F\u305B\u3066\u30C8\u30FC\u30F3\u3092\u8ABF\u6574\u3057\u307E\u3057\u305F\u3002"
      });
    } catch (err) {
      console.error("[AI Rewrite Tone Error]:", err);
      res.status(500).json({
        success: false,
        error: formatGeminiErrorMessage(err)
      });
    }
  });
  app.post("/api/ai/check-safety", async (req, res) => {
    try {
      const { text, checkLinks = true } = req.body;
      const cleanText = typeof text === "string" ? text.trim() : "";
      if (!cleanText) {
        res.status(400).json({ success: false, error: "\u30C1\u30A7\u30C3\u30AF\u5BFE\u8C61\u306E\u30C6\u30AD\u30B9\u30C8\u304C\u5165\u529B\u3055\u308C\u3066\u3044\u307E\u305B\u3093\u3002" });
        return;
      }
      const urlRegex = /https?:\/\/[^\s"'<>\(\)]+/gi;
      const matchedUrls = Array.from(new Set(cleanText.match(urlRegex) || []));
      const linkCheckResults = [];
      if (checkLinks && matchedUrls.length > 0) {
        const linkPromises = matchedUrls.map(async (targetUrl) => {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 6e3);
            let checkRes = await fetch(targetUrl, {
              method: "HEAD",
              signal: controller.signal,
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
              }
            }).catch(() => null);
            if (!checkRes || checkRes.status === 405) {
              checkRes = await fetch(targetUrl, {
                method: "GET",
                signal: controller.signal,
                headers: {
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                }
              }).catch(() => null);
            }
            clearTimeout(timeout);
            if (!checkRes) {
              return { url: targetUrl, status: "unreachable", error: "\u30B5\u30FC\u30D0\u30FC\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\uFF08\u7121\u5FDC\u7B54\u307E\u305F\u306F\u30C9\u30E1\u30A4\u30F3\u672A\u89E3\u6C7A\uFF09" };
            }
            if (checkRes.status >= 200 && checkRes.status < 400) {
              return { url: targetUrl, status: "ok", statusCode: checkRes.status };
            } else {
              return { url: targetUrl, status: "broken", statusCode: checkRes.status, error: `\u30B9\u30C6\u30FC\u30BF\u30B9\u30B3\u30FC\u30C9: ${checkRes.status}` };
            }
          } catch (e) {
            return { url: targetUrl, status: "unreachable", error: e.message || "\u63A5\u7D9A\u30A8\u30E9\u30FC" };
          }
        });
        const resolvedLinks = await Promise.all(linkPromises);
        linkCheckResults.push(...resolvedLinks);
      }
      const prompt = `\u3042\u306A\u305F\u306FSNS\uFF08Bluesky / AT Protocol\u3001Threads / Meta\uFF09\u306E\u30B3\u30F3\u30C6\u30F3\u30C4\u30BB\u30FC\u30D5\u30C6\u30A3\u30FB\u6821\u6B63\u306E\u6700\u9AD8\u8CAC\u4EFB\u8005\u3067\u3059\u3002
\u4EE5\u4E0B\u306E\u6295\u7A3F\u30C6\u30AD\u30B9\u30C8\u3092\u591A\u89D2\u7684\u306B\u5206\u6790\u3057\u3001\u6295\u7A3F\u524D\u306B\u6539\u5584\u3059\u3079\u304D\u30EA\u30B9\u30AF\u3084\u8AA4\u5B57\u8131\u5B57\u3092\u5831\u544A\u3057\u3066\u304F\u3060\u3055\u3044\u3002

\u3010\u5206\u6790\u9805\u76EE\u3011
1. \u8AA4\u5B57\u8131\u5B57\u30FB\u65E5\u672C\u8A9E\u306E\u4E0D\u81EA\u7136\u3055 (category: 'typo')
   - \u3066\u306B\u3092\u306F\u306E\u8AA4\u308A\u3001\u540C\u97F3\u7570\u7FA9\u8A9E\u306E\u8AA4\u5909\u63DB\u3001\u8131\u5B57\u3001\u91CD\u8907\u8A9E\u306A\u3069\u3002
2. \u30B7\u30E3\u30C9\u30A6\u30D0\u30F3\u30FB\u30B9\u30D1\u30E0\u5224\u5B9A\u30EA\u30B9\u30AF (category: 'shadowban')
   - Meta\u3084Bluesky\u306E\u30A2\u30EB\u30B4\u30EA\u30BA\u30E0\u304C\u30EA\u30FC\u30C1\u5236\u9650\uFF08\u30B7\u30E3\u30C9\u30A6\u30D0\u30F3\uFF09\u3084\u30B9\u30D1\u30E0\u5224\u5B9A\u3057\u3084\u3059\u3044\u8868\u73FE\u3002
   - \u4F8B: \u904E\u5EA6\u306A\u91D1\u92AD\u8A98\u5C0E\uFF08\u300C\u6708\u53CE100\u4E07\u300D\u300C\u5373\u91D1\u300D\u300C\u526F\u696D\u3067\u7A3C\u3050\u300D\uFF09\u3001\u9732\u9AA8\u306A\u8A87\u5927\u5E83\u544A\u3001\u30D5\u30A9\u30ED\u30FC\uFF06\u30EA\u30DD\u30B9\u30C8\u306E\u5F37\u8981\uFF08\u300C\u62E1\u6563\u5E0C\u671B\uFF01\u7D76\u5BFERT\u3057\u3066\u300D\uFF09\u3001\u904E\u5EA6\u306A\u717D\u308A\u6587\u53E5\u3002
3. \u8A18\u53F7\u306E\u904E\u5270\u9023\u7D9A\u4F7F\u7528 (category: 'symbols')
   - \u300C\uFF01\uFF01\uFF01\uFF01\u300D\u300C\uFF1F\uFF1F\uFF1F\uFF1F\u300D\u300C$$$$\u300D\u300C\u2605\u2605\u2605\u300D\u306A\u3069\u3001\u30B9\u30D1\u30E0\u30D5\u30A3\u30EB\u30BF\u30FC\u306B\u6355\u6349\u3055\u308C\u3084\u3059\u3044\u8A18\u53F7\u306E\u9023\u7D9A\u3002
4. \u30B3\u30DF\u30E5\u30CB\u30C6\u30A3\u898F\u7D04\u30FB\u30AC\u30A4\u30C9\u30E9\u30A4\u30F3\u30EA\u30B9\u30AF (category: 'policy')
   - \u653B\u6483\u7684\u8868\u73FE\u3001\u8AB9\u8B17\u4E2D\u50B7\u3068\u53D7\u3051\u53D6\u3089\u308C\u304B\u306D\u306A\u3044\u8A00\u3044\u56DE\u3057\u3001\u30BB\u30F3\u30B7\u30C6\u30A3\u30D6\u306A\u65AD\u5B9A\u8868\u73FE\u3002

\u3010\u6DF1\u523B\u5EA6\u30EC\u30D9\u30EB (severity)\u3011
- 'error': \u6295\u7A3F\u505C\u6B62\u3092\u5F37\u304F\u63A8\u5968\uFF08\u898F\u7D04\u9055\u53CD\u30FB\u30A2\u30AB\u30A6\u30F3\u30C8\u5236\u9650\u30FB\u30EA\u30F3\u30AF\u5207\u308C\u306E\u7591\u3044\u306A\u3069\uFF09
- 'warning': \u6539\u5584\u3092\u63A8\u5968\uFF08\u30B7\u30E3\u30C9\u30A6\u30D0\u30F3\u3067\u30A4\u30F3\u30D7\u30EC\u30C3\u30B7\u30E7\u30F3\u6FC0\u6E1B\u30EA\u30B9\u30AF\u3001\u660E\u767D\u306A\u8AA4\u5B57\u306A\u3069\uFF09
- 'info': \u3088\u308A\u826F\u304F\u306A\u308B\u30A2\u30C9\u30D0\u30A4\u30B9\uFF08\u8868\u73FE\u306E\u6D17\u7DF4\u3001\u8AAD\u8005\u3078\u306E\u914D\u616E\u306A\u3069\uFF09

\u3010\u5165\u529B\u30C6\u30AD\u30B9\u30C8\u3011
${cleanText}
`;
      const response = await generateGeminiContentWithFallback({
        preferredModel: "gemini-3.8-flash",
        contents: prompt,
        config: {
          systemInstruction: "\u3042\u306A\u305F\u306FSNS\u30B3\u30F3\u30C6\u30F3\u30C4\u306E\u6821\u6B63\u3068\u898F\u7D04\u30BB\u30FC\u30D5\u30C6\u30A3\u306E\u5C02\u9580\u5BB6\u3067\u3059\u3002\u6307\u5B9A\u3055\u308C\u305FJSON\u5F62\u5F0F\u306E\u307F\u3092\u51FA\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
          responseMimeType: "application/json",
          responseSchema: {
            type: import_genai.Type.OBJECT,
            properties: {
              safetyScore: {
                type: import_genai.Type.INTEGER,
                description: "0\u301C100\u70B9\u6E80\u70B9\u306E\u7DCF\u5408\u5065\u5168\u6027\u30FB\u5B89\u5168\u6027\u30B9\u30B3\u30A2\uFF08100\u70B9\u304C\u6975\u3081\u3066\u5B89\u5168\u30FB\u81EA\u7136\uFF09"
              },
              issues: {
                type: import_genai.Type.ARRAY,
                items: {
                  type: import_genai.Type.OBJECT,
                  properties: {
                    severity: { type: import_genai.Type.STRING, description: "error | warning | info" },
                    category: { type: import_genai.Type.STRING, description: "typo | shadowban | symbols | policy" },
                    title: { type: import_genai.Type.STRING, description: "\u6307\u6458\u306E\u7C21\u6F54\u306A\u30BF\u30A4\u30C8\u30EB" },
                    description: { type: import_genai.Type.STRING, description: "\u554F\u984C\u306E\u7406\u7531\u3068\u6539\u5584\u306E\u30E1\u30EA\u30C3\u30C8" },
                    suggestion: { type: import_genai.Type.STRING, description: "\u5177\u4F53\u7684\u306A\u4FEE\u6B63\u6848\u30FB\u8A00\u3044\u63DB\u3048\u8868\u73FE" },
                    targetText: { type: import_genai.Type.STRING, description: "\u8A72\u5F53\u3059\u308B\u5143\u306E\u6587\u5B57\u5217" }
                  },
                  required: ["severity", "category", "title", "description"]
                },
                description: "\u691C\u51FA\u3055\u308C\u305F\u554F\u984C\u30FB\u6539\u5584\u70B9\u306E\u4E00\u89A7"
              },
              improvedText: {
                type: import_genai.Type.STRING,
                description: "\u8AA4\u5B57\u8131\u5B57\u3084\u904E\u5270\u306A\u8A18\u53F7\u30FBNG\u8868\u73FE\u3092\u4FEE\u6B63\u3057\u305F\u5B89\u5168\u306A\u63A8\u5968\u30C6\u30AD\u30B9\u30C8"
              },
              summary: {
                type: import_genai.Type.STRING,
                description: "\u5168\u4F53\u8A55\u4FA1\u306E\u307E\u3068\u3081\uFF081\u301C2\u6587\uFF09"
              }
            },
            required: ["safetyScore", "issues", "improvedText", "summary"]
          }
        }
      });
      const responseText = response.text || "{}";
      let parsed;
      try {
        parsed = JSON.parse(responseText);
      } catch {
        res.status(500).json({ success: false, error: "AI\u30BB\u30FC\u30D5\u30C6\u30A3\u89E3\u6790\u306E\u30EC\u30B9\u30DD\u30F3\u30B9\u89E3\u6790\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002" });
        return;
      }
      const combinedIssues = [...parsed.issues || []];
      for (const link of linkCheckResults) {
        if (link.status === "broken" || link.status === "unreachable") {
          combinedIssues.unshift({
            severity: "error",
            category: "policy",
            title: `\u30EA\u30F3\u30AF\u5207\u308C\u306E\u53EF\u80FD\u6027 (${link.statusCode ? `HTTP ${link.statusCode}` : "\u63A5\u7D9A\u4E0D\u53EF"})`,
            description: `URL\u300C${link.url}\u300D\u3078\u306E\u30A2\u30AF\u30BB\u30B9\u304C\u78BA\u8A8D\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002${link.error || ""}\u3002\u6295\u7A3F\u524D\u306BURL\u304C\u6709\u52B9\u304B\u518D\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002`,
            targetText: link.url,
            suggestion: "URL\u306E\u30B9\u30DA\u30EB\u30DF\u30B9\u3084\u516C\u958B\u8A2D\u5B9A\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044"
          });
        }
      }
      let adjustedScore = parsed.safetyScore ?? 100;
      const brokenCount = linkCheckResults.filter((l) => l.status !== "ok").length;
      if (brokenCount > 0) {
        adjustedScore = Math.max(20, adjustedScore - brokenCount * 25);
      }
      res.json({
        success: true,
        safetyScore: adjustedScore,
        issues: combinedIssues,
        improvedText: parsed.improvedText || cleanText,
        summary: parsed.summary || "\u89E3\u6790\u304C\u5B8C\u4E86\u3057\u307E\u3057\u305F\u3002",
        linkChecks: linkCheckResults
      });
    } catch (err) {
      console.error("[AI Safety Check Error]:", err);
      res.status(500).json({
        success: false,
        error: formatGeminiErrorMessage(err)
      });
    }
  });
  app.post("/api/media/upload", uploadMiddleware.single("file"), (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: "\u30A2\u30C3\u30D7\u30ED\u30FC\u30C9\u3055\u308C\u305F\u30D5\u30A1\u30A4\u30EB\u304C\u3042\u308A\u307E\u305B\u3093\u3002" });
        return;
      }
      const mediaId = import_crypto.default.randomBytes(16).toString("hex");
      const originalName = req.file.originalname || "media";
      const ext = originalName.split(".").pop()?.toLowerCase() || "";
      let mimeType = req.file.mimetype || "application/octet-stream";
      if (ext === "mp4" || ext === "m4v") {
        mimeType = "video/mp4";
      } else if (ext === "mov") {
        mimeType = "video/quicktime";
      } else if (ext === "webm") {
        mimeType = "video/webm";
      } else if (ext === "jpg" || ext === "jpeg") {
        mimeType = "image/jpeg";
      } else if (ext === "png") {
        mimeType = "image/png";
      }
      const isVideo = isVideoMime(mimeType) || ["mp4", "mov", "webm", "m4v"].includes(ext);
      if (isVideo && (!mimeType.startsWith("video/") || mimeType === "application/octet-stream")) {
        mimeType = "video/mp4";
      }
      mediaStorage.set(mediaId, {
        buffer: req.file.buffer,
        mimeType,
        createdAt: Date.now()
      });
      res.json({
        success: true,
        mediaId,
        mimeType,
        size: req.file.size,
        name: req.file.originalname,
        mediaType: isVideo ? "video" : "image"
      });
    } catch (err) {
      console.error("Media upload error:", err);
      res.status(500).json({
        success: false,
        error: `\u30E1\u30C7\u30A3\u30A2\u306E\u53D7\u4FE1\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${err.message || "\u4E0D\u660E\u306A\u30A8\u30E9\u30FC"}`
      });
    }
  });
  app.all("/api/media/:id", (req, res) => {
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "*");
      res.status(204).end();
      return;
    }
    const item = mediaStorage.get(req.params.id);
    if (!item) {
      res.status(404).send("Media not found or expired");
      return;
    }
    const totalSize = item.buffer.length;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Cache-Control", "public, max-age=3600, immutable");
    res.setHeader("Accept-Ranges", "bytes");
    if (req.method === "HEAD") {
      res.setHeader("Content-Type", item.mimeType);
      res.setHeader("Content-Length", totalSize);
      res.status(200).end();
      return;
    }
    const rangeHeader = req.headers.range;
    if (rangeHeader && typeof rangeHeader === "string" && rangeHeader.startsWith("bytes=")) {
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10) || 0;
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
      if (start >= totalSize || end >= totalSize || start > end) {
        res.setHeader("Content-Range", `bytes */${totalSize}`);
        res.status(416).send("Requested Range Not Satisfiable");
        return;
      }
      const chunkSize = end - start + 1;
      const chunk = item.buffer.subarray(start, end + 1);
      res.status(206);
      res.setHeader("Content-Type", item.mimeType);
      res.setHeader("Content-Length", chunkSize);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${totalSize}`);
      res.send(chunk);
      return;
    }
    res.setHeader("Content-Type", item.mimeType);
    res.setHeader("Content-Length", totalSize);
    res.send(item.buffer);
  });
  async function uploadBlueskyVideo(buffer, mimeType, fileName, did, accessJwt, pdsEndpoint) {
    const uploadName = fileName || "video.mp4";
    const videoServiceUrl = "https://video.bsky.app";
    const cleanMime = mimeType.startsWith("video/") && !mimeType.includes("quicktime") && !mimeType.includes("webm") ? mimeType : "video/mp4";
    let serviceAuthToken = accessJwt;
    try {
      const authUrl = `${pdsEndpoint.replace(/\/+$/, "")}/xrpc/com.atproto.server.getServiceAuth?aud=did:web:video.bsky.app&lxm=app.bsky.video.uploadVideo`;
      const saRes = await fetch(authUrl, {
        headers: { Authorization: `Bearer ${accessJwt}` }
      });
      if (saRes.ok) {
        const saData = await saRes.json().catch(() => ({}));
        if (saData?.token) {
          serviceAuthToken = saData.token;
          console.log("[Bluesky Video] Successfully obtained service auth token for video.bsky.app");
        }
      }
    } catch (saErr) {
      console.warn(`[Bluesky Video] Note on getServiceAuth: ${saErr.message}`);
    }
    try {
      const url = `${videoServiceUrl}/xrpc/app.bsky.video.uploadVideo?did=${encodeURIComponent(did)}&name=${encodeURIComponent(uploadName)}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45e3);
      const uploadRes = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceAuthToken}`,
          "Content-Type": cleanMime
        },
        body: buffer,
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (uploadRes.ok) {
        const uploadData = await uploadRes.json().catch(() => ({}));
        if (uploadData?.blob) {
          return uploadData.blob;
        }
        if (uploadData?.jobId) {
          const jobId = uploadData.jobId;
          for (let attempt = 0; attempt < 25; attempt++) {
            const waitTime = attempt === 0 ? 400 : attempt <= 3 ? 700 : 1200;
            await new Promise((r) => setTimeout(r, waitTime));
            const statusRes = await fetch(
              `${videoServiceUrl}/xrpc/app.bsky.video.getJobStatus?jobId=${encodeURIComponent(jobId)}`,
              {
                headers: {
                  Authorization: `Bearer ${serviceAuthToken}`
                }
              }
            );
            if (statusRes.ok) {
              const statusData = await statusRes.json().catch(() => ({}));
              if (statusData?.jobStatus?.blob) {
                return statusData.jobStatus.blob;
              }
              if (statusData?.jobStatus?.state === "JOB_STATE_FAILED") {
                console.warn("[Bluesky Video] Encode failed:", statusData.jobStatus.error);
                break;
              }
            }
          }
        }
      } else {
        const errJson = await uploadRes.json().catch(() => ({}));
        console.warn(`[Bluesky Video] video.bsky.app responded with ${uploadRes.status}:`, errJson);
      }
    } catch (err) {
      console.warn(`[Bluesky Video] video.bsky.app upload note: ${err.message}`);
    }
    console.log("[Bluesky Video] Falling back to PDS uploadBlob...");
    const fallbackRes = await fetch(`${pdsEndpoint}/xrpc/com.atproto.repo.uploadBlob`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessJwt}`,
        "Content-Type": "video/mp4"
      },
      body: buffer
    });
    if (fallbackRes.ok) {
      const fallbackData = await fallbackRes.json().catch(() => ({}));
      if (fallbackData?.blob) {
        return fallbackData.blob;
      }
    }
    throw new Error("Bluesky\u3078\u306E\u52D5\u753B\u30A2\u30C3\u30D7\u30ED\u30FC\u30C9\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002\u30D5\u30A1\u30A4\u30EB\u5F62\u5F0F(MP4/MOV)\u304A\u3088\u3073\u30B5\u30A4\u30BA(\u6700\u592750MB)\u3092\u3054\u78BA\u8A8D\u304F\u3060\u3055\u3044\u3002");
  }
  app.post("/api/bluesky/auth", async (req, res) => {
    try {
      const { identifier, appPassword, serviceUrl = "https://bsky.social" } = req.body;
      let cleanIdentifier = sanitizeInput(identifier).replace(/^@/, "").replace(/\s+/g, "");
      const cleanPassword = sanitizeInput(appPassword).replace(/\s+/g, "").replace(/[−―ー－]/g, "-");
      if (!cleanIdentifier || !cleanPassword) {
        res.status(400).json({
          success: false,
          error: "\u30CF\u30F3\u30C9\u30EB\uFF08\u307E\u305F\u306F\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\uFF09\u3068\u30A2\u30D7\u30EA\u30D1\u30B9\u30EF\u30FC\u30C9\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002"
        });
        return;
      }
      if (!cleanIdentifier.includes(".")) {
        cleanIdentifier = `${cleanIdentifier}.bsky.social`;
      }
      if (cleanIdentifier.includes("demo") || cleanPassword.includes("demo")) {
        res.json({
          success: true,
          isDemo: true,
          session: {
            did: "did:plc:democreator1029384756",
            handle: cleanIdentifier.includes(".") ? cleanIdentifier : `${cleanIdentifier}.bsky.social`,
            accessJwt: "demo_access_jwt",
            refreshJwt: "demo_refresh_jwt"
          }
        });
        return;
      }
      const pdsEndpoint = serviceUrl.replace(/\/+$/, "");
      const response = await fetch(`${pdsEndpoint}/xrpc/com.atproto.server.createSession`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: cleanIdentifier,
          password: cleanPassword
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errorDesc = response.status === 401 ? "\u30CF\u30F3\u30C9\u30EB\u540D\u307E\u305F\u306F\u30A2\u30D7\u30EA\u30D1\u30B9\u30EF\u30FC\u30C9\u304C\u6B63\u3057\u304F\u3042\u308A\u307E\u305B\u3093\u3002Bluesky\u516C\u5F0F\u306E\u30A2\u30D7\u30EA\u30D1\u30B9\u30EF\u30FC\u30C9\uFF08xxxx-xxxx-xxxx-xxxx\u5F62\u5F0F\uFF09\u3092\u3054\u78BA\u8A8D\u304F\u3060\u3055\u3044\u3002" : data.message || `Bluesky\u8A8D\u8A3C\u30A8\u30E9\u30FC (${response.statusText || response.status})`;
        res.status(400).json({
          success: false,
          error: errorDesc
        });
        return;
      }
      res.json({
        success: true,
        session: {
          did: data.did,
          handle: data.handle,
          accessJwt: data.accessJwt,
          refreshJwt: data.refreshJwt,
          email: data.email
        }
      });
    } catch (err) {
      console.error("Bluesky auth error:", err);
      res.status(500).json({
        success: false,
        error: `Bluesky\u30B5\u30FC\u30D0\u30FC\u901A\u4FE1\u30A8\u30E9\u30FC: ${err.message || "\u63A5\u7D9A\u306B\u5931\u6557\u3057\u307E\u3057\u305F"}`
      });
    }
  });
  app.post("/api/bluesky/post", async (req, res) => {
    try {
      const { credentials, posts, images = [], isDemo = false } = req.body;
      const { blueskyIdentifier, blueskyAppPassword, blueskyServiceUrl = "https://bsky.social", isDemoMode } = credentials || {};
      let cleanIdentifier = sanitizeInput(blueskyIdentifier).replace(/^@/, "");
      const cleanPassword = sanitizeInput(blueskyAppPassword).replace(/\s+/g, "").replace(/[−―ー－]/g, "-");
      const isDemoRequest = isDemo || isDemoMode || cleanIdentifier.includes("demo") || cleanPassword.includes("demo") || !cleanIdentifier || !cleanPassword;
      if (isDemoRequest) {
        const handle2 = cleanIdentifier || "demo-creator.bsky.social";
        const imgList = Array.isArray(images) ? images : [];
        const isVideoItem = (m) => m?.mediaType === "video" || typeof m?.mimeType === "string" && m.mimeType.startsWith("video/") || typeof m?.dataUrl === "string" && m.dataUrl.includes("video/");
        let demoMediaChunksCount = 0;
        let curImgCount = 0;
        for (const m of imgList) {
          if (isVideoItem(m)) {
            if (curImgCount > 0) {
              demoMediaChunksCount++;
              curImgCount = 0;
            }
            demoMediaChunksCount++;
          } else {
            curImgCount++;
            if (curImgCount === 4) {
              demoMediaChunksCount++;
              curImgCount = 0;
            }
          }
        }
        if (curImgCount > 0) demoMediaChunksCount++;
        const totalCount = Math.max(
          Array.isArray(posts) ? posts.length : 0,
          demoMediaChunksCount
        ) || 1;
        const hasVideo = imgList.some(isVideoItem);
        const hasImage = imgList.some((m) => !isVideoItem(m));
        const demoUrls = Array.from({ length: totalCount }).map(
          (_, idx) => `https://bsky.app/profile/${handle2}/post/demo-${Date.now()}-${idx + 1}`
        );
        let demoMsg = "\u3010\u30C7\u30E2\u30E2\u30FC\u30C9\u3011\u30B7\u30DF\u30E5\u30EC\u30FC\u30B7\u30E7\u30F3\u6295\u7A3F\u304C\u5B8C\u4E86\u3057\u307E\u3057\u305F\u3002";
        if (hasVideo && hasImage) {
          demoMsg = `\u3010\u30C7\u30E2\u30E2\u30FC\u30C9\u3011\u52D5\u753B\u3068\u753B\u50CF\u304C\u6DF7\u5728\u3057\u3066\u3044\u308B\u305F\u3081\u30012\u3064\u76EE\u4EE5\u964D\u306E\u30B3\u30F3\u30C6\u30F3\u30C4\u3092\u30B9\u30EC\u30C3\u30C9\uFF08\u8FD4\u4FE1\u30C4\u30EA\u30FC\u8A08${totalCount}\u4EF6\uFF09\u3078\u81EA\u52D5\u5206\u5272\u3057\u3066\u30B7\u30DF\u30E5\u30EC\u30FC\u30B7\u30E7\u30F3\u6295\u7A3F\u304C\u5B8C\u4E86\u3057\u307E\u3057\u305F\u3002`;
        } else if (hasVideo) {
          demoMsg = "\u3010\u30C7\u30E2\u30E2\u30FC\u30C9\u3011\u52D5\u753B\u4ED8\u304D\u30B9\u30EC\u30C3\u30C9\u6295\u7A3F\u30B7\u30DF\u30E5\u30EC\u30FC\u30B7\u30E7\u30F3\u304C\u5B8C\u4E86\u3057\u307E\u3057\u305F\uFF08\u52D5\u753B\u30D7\u30EC\u30A4\u30E4\u30FC\u30FBEmbed\u5BFE\u5FDC\uFF09\u3002";
        } else if (imgList.length > 4) {
          demoMsg = `\u3010\u30C7\u30E2\u30E2\u30FC\u30C9\u3011\u753B\u50CF${imgList.length}\u679A\u30924\u679A\u6BCE\u306B\u5206\u5272\u3057\u3001${totalCount}\u4EF6\u306E\u30B9\u30EC\u30C3\u30C9\u3068\u3057\u3066\u30B7\u30DF\u30E5\u30EC\u30FC\u30B7\u30E7\u30F3\u6295\u7A3F\u304C\u5B8C\u4E86\u3057\u307E\u3057\u305F\u3002`;
        }
        res.json({
          success: true,
          isDemo: true,
          postsCount: totalCount,
          postIds: demoUrls.map((u) => u.split("/").pop()),
          urls: demoUrls,
          message: demoMsg
        });
        return;
      }
      if (!cleanIdentifier || !cleanPassword) {
        res.status(400).json({
          success: false,
          error: "Bluesky\u306E\u8A8D\u8A3C\u60C5\u5831\uFF08\u30CF\u30F3\u30C9\u30EB\u3001\u30A2\u30D7\u30EA\u30D1\u30B9\u30EF\u30FC\u30C9\uFF09\u304C\u8A2D\u5B9A\u3055\u308C\u3066\u3044\u307E\u305B\u3093\u3002"
        });
        return;
      }
      if (!cleanIdentifier.includes(".")) {
        cleanIdentifier = `${cleanIdentifier}.bsky.social`;
      }
      if ((!Array.isArray(posts) || posts.length === 0) && (!Array.isArray(images) || images.length === 0)) {
        res.status(400).json({
          success: false,
          error: "\u6295\u7A3F\u3059\u308B\u30C6\u30AD\u30B9\u30C8\u307E\u305F\u306F\u753B\u50CF\u30FB\u52D5\u753B\u304C\u3042\u308A\u307E\u305B\u3093\u3002"
        });
        return;
      }
      const pdsEndpoint = blueskyServiceUrl.replace(/\/+$/, "");
      const authRes = await fetch(`${pdsEndpoint}/xrpc/com.atproto.server.createSession`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: cleanIdentifier,
          password: cleanPassword
        })
      });
      const authData = await authRes.json().catch(() => ({}));
      if (!authRes.ok) {
        res.status(authRes.status).json({
          success: false,
          error: `Bluesky\u30ED\u30B0\u30A4\u30F3\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${authData.message || authRes.statusText}`
        });
        return;
      }
      const { did, handle, accessJwt } = authData;
      const uploadedMediaItems = [];
      if (Array.isArray(images) && images.length > 0) {
        for (let bIdx = 0; bIdx < images.length; bIdx++) {
          const item = images[bIdx];
          const resolved = resolveMediaBuffer(item);
          if (resolved) {
            const { buffer, mimeType } = resolved;
            const altText = typeof item.alt === "string" ? item.alt.trim() : "";
            const isVideo = item.mediaType === "video" || isVideoMime(mimeType);
            if (isVideo) {
              console.log(`[Bluesky] Uploading video #${bIdx + 1} (${mimeType}, size: ${buffer.length} bytes)...`);
              const videoBlob = await uploadBlueskyVideo(
                buffer,
                mimeType,
                item.name || `video_${bIdx + 1}.mp4`,
                did,
                accessJwt,
                pdsEndpoint
              );
              uploadedMediaItems.push({
                type: "video",
                blob: videoBlob,
                alt: altText,
                name: item.name
              });
            } else {
              const blobRes = await fetch(`${pdsEndpoint}/xrpc/com.atproto.repo.uploadBlob`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${accessJwt}`,
                  "Content-Type": mimeType
                },
                body: buffer
              });
              if (blobRes.ok) {
                const blobData = await blobRes.json();
                if (blobData?.blob) {
                  uploadedMediaItems.push({
                    type: "image",
                    blob: blobData.blob,
                    alt: altText,
                    name: item.name
                  });
                }
              } else {
                const blobErrData = await blobRes.json().catch(() => ({}));
                const blobErrMsg = blobErrData.message || blobErrData.error || `HTTP ${blobRes.status}`;
                const blobErrCode = blobErrData.error || (blobRes.status === 413 ? "BlobTooLarge" : "UploadBlobFailed");
                console.warn(`Blob upload #${bIdx + 1} failed:`, blobErrCode, blobErrMsg);
                throw new Error(`[Bluesky API\u30A8\u30E9\u30FC: ${blobErrCode}] \u753B\u50CF #${bIdx + 1} \u306E\u30A2\u30C3\u30D7\u30ED\u30FC\u30C9\u306B\u5931\u6557\u3057\u307E\u3057\u305F (${blobErrMsg})`);
              }
            }
          }
        }
      }
      const mediaChunks = [];
      let currentImagesChunk = [];
      for (const item of uploadedMediaItems) {
        if (item.type === "video") {
          if (currentImagesChunk.length > 0) {
            mediaChunks.push({ type: "images", images: currentImagesChunk });
            currentImagesChunk = [];
          }
          mediaChunks.push({
            type: "video",
            video: { blob: item.blob, alt: item.alt }
          });
        } else {
          currentImagesChunk.push({ blob: item.blob, alt: item.alt });
          if (currentImagesChunk.length === 4) {
            mediaChunks.push({ type: "images", images: currentImagesChunk });
            currentImagesChunk = [];
          }
        }
      }
      if (currentImagesChunk.length > 0) {
        mediaChunks.push({ type: "images", images: currentImagesChunk });
      }
      const createdPostKeys = [];
      const createdUrls = [];
      let rootRef = null;
      let parentRef = null;
      const safePosts = Array.isArray(posts) ? posts : [];
      const totalPostCount = Math.max(
        safePosts.length,
        mediaChunks.length
      ) || 1;
      for (let i = 0; i < totalPostCount; i++) {
        const postText = i < safePosts.length ? safePosts[i] || "" : totalPostCount > 1 ? `(${i + 1}/${totalPostCount})` : "";
        const facets = await generateBlueskyFacets(postText, pdsEndpoint);
        const record = {
          $type: "app.bsky.feed.post",
          text: postText,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        if (facets.length > 0) {
          record.facets = facets;
        }
        if (i < mediaChunks.length) {
          const chunk = mediaChunks[i];
          if (chunk.type === "video") {
            record.embed = {
              $type: "app.bsky.embed.video",
              video: chunk.video.blob,
              alt: chunk.video.alt || ""
            };
          } else if (chunk.type === "images" && chunk.images.length > 0) {
            record.embed = {
              $type: "app.bsky.embed.images",
              images: chunk.images.map((item) => ({
                image: item.blob,
                alt: item.alt || ""
              }))
            };
          }
        }
        if (rootRef && parentRef) {
          record.reply = {
            root: rootRef,
            parent: parentRef
          };
        }
        const postRes = await fetch(`${pdsEndpoint}/xrpc/com.atproto.repo.createRecord`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessJwt}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            repo: did,
            collection: "app.bsky.feed.post",
            record
          })
        });
        const postData = await postRes.json().catch(() => ({}));
        if (!postRes.ok) {
          const rawCode = postData.error || (postRes.status === 400 ? "InvalidRequest" : `HTTP_${postRes.status}`);
          const rawMsg = postData.message || `\u6295\u7A3F #${i + 1} \u306E\u9001\u4FE1\u306B\u5931\u6557\u3057\u307E\u3057\u305F`;
          let hint = "";
          if (rawCode === "DuplicateCreate" || rawMsg.toLowerCase().includes("duplicate")) {
            hint = "\uFF08\u76F4\u8FD1\u306B\u5168\u304F\u540C\u3058\u5185\u5BB9\u304C\u6295\u7A3F\u3055\u308C\u3066\u3044\u308B\u305F\u3081\u3001\u91CD\u8907\u6295\u7A3F\u5236\u9650\u3067\u62D2\u5426\u3055\u308C\u307E\u3057\u305F\uFF09";
          } else if (rawCode === "BlobTooLarge" || rawMsg.toLowerCase().includes("blob")) {
            hint = "\uFF08\u6DFB\u4ED8\u753B\u50CF\u306E\u5BB9\u91CF\u304C\u4E0A\u9650\u3092\u8D85\u3048\u3066\u3044\u307E\u3059\uFF09";
          } else if (rawCode === "ExpiredToken" || rawCode === "AuthenticationRequired") {
            hint = "\uFF08\u8A8D\u8A3C\u30BB\u30C3\u30B7\u30E7\u30F3\u304C\u5207\u308C\u307E\u3057\u305F\u3002\u8A2D\u5B9A\u753B\u9762\u304B\u3089\u518D\u30ED\u30B0\u30A4\u30F3\u3057\u3066\u304F\u3060\u3055\u3044\uFF09";
          }
          throw new Error(`[Bluesky API\u30A8\u30E9\u30FC: ${rawCode}] ${rawMsg}${hint ? ` ${hint}` : ""}`);
        }
        const { uri, cid } = postData;
        const rkey = uri.split("/").pop();
        createdPostKeys.push(rkey);
        createdUrls.push(`https://bsky.app/profile/${handle}/post/${rkey}`);
        if (i === 0) {
          rootRef = { uri, cid };
        }
        parentRef = { uri, cid };
        if (i < totalPostCount - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
      res.json({
        success: true,
        postsCount: createdUrls.length,
        postIds: createdPostKeys,
        urls: createdUrls
      });
    } catch (err) {
      console.error("Bluesky post error:", err);
      res.status(500).json({
        success: false,
        error: err.message || "Bluesky\u6295\u7A3F\u4E2D\u306B\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F\u3002"
      });
    }
  });
  app.post("/api/threads/verify", async (req, res) => {
    try {
      const { userId = "me", accessToken } = req.body;
      const cleanToken = sanitizeInput(accessToken).replace(/\s+/g, "");
      const rawUserId = sanitizeInput(userId);
      const cleanUserId = rawUserId && rawUserId.toLowerCase() !== "me" ? rawUserId : "me";
      if (!cleanToken) {
        res.status(400).json({
          success: false,
          error: "Threads\u306E\u30A2\u30AF\u30BB\u30B9\u30C8\u30FC\u30AF\u30F3\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002"
        });
        return;
      }
      if (cleanToken.includes("DEMO") || cleanToken.includes("demo")) {
        res.json({
          success: true,
          isDemo: true,
          id: "threads_user_demo_10293",
          username: "Demo_Threads_Official"
        });
        return;
      }
      const candidateIds = cleanUserId === "me" ? ["me"] : ["me", cleanUserId];
      let lastData = {};
      let lastResponseStatus = 400;
      let lastStatusText = "";
      for (const targetId of candidateIds) {
        try {
          const verifyUrl = `https://graph.threads.net/v1.0/${targetId}?fields=id,username,threads_profile_picture_url&access_token=${encodeURIComponent(cleanToken)}`;
          const response = await fetch(verifyUrl);
          lastResponseStatus = response.status;
          lastStatusText = response.statusText;
          const data = await response.json().catch(() => ({}));
          if (response.ok && (data.id || data.username)) {
            res.json({
              success: true,
              id: data.id || targetId,
              username: data.username,
              pictureUrl: data.threads_profile_picture_url
            });
            return;
          }
          lastData = data;
        } catch {
        }
      }
      const errorMsg = lastData.error?.message || `Threads\u30A2\u30AF\u30BB\u30B9\u30C8\u30FC\u30AF\u30F3\u691C\u8A3C\u306B\u5931\u6557\u3057\u307E\u3057\u305F (${lastStatusText || lastResponseStatus})\u3002\u30A2\u30AF\u30BB\u30B9\u30C8\u30FC\u30AF\u30F3\u304C\u6709\u52B9\u304B\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002`;
      res.status(400).json({
        success: false,
        error: errorMsg
      });
    } catch (err) {
      console.error("Threads verify error:", err);
      res.status(500).json({
        success: false,
        error: `Threads API\u901A\u4FE1\u30A8\u30E9\u30FC: ${err.message || "\u691C\u8A3C\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F"}`
      });
    }
  });
  app.post("/api/threads/refresh-token", async (req, res) => {
    try {
      const { accessToken } = req.body;
      const cleanToken = sanitizeInput(accessToken).replace(/\s+/g, "");
      if (!cleanToken) {
        res.status(400).json({
          success: false,
          error: "\u66F4\u65B0\u5BFE\u8C61\u306EThreads\u30A2\u30AF\u30BB\u30B9\u30C8\u30FC\u30AF\u30F3\u304C\u6307\u5B9A\u3055\u308C\u3066\u3044\u307E\u305B\u3093\u3002"
        });
        return;
      }
      if (cleanToken.includes("DEMO") || cleanToken.includes("demo") || cleanToken === "TH_LONG_LIVED_TOKEN_DEMO_91238") {
        const expiresIn2 = 5184e3;
        const expiresAt2 = Date.now() + expiresIn2 * 1e3;
        res.json({
          success: true,
          isDemo: true,
          accessToken: "TH_LONG_LIVED_TOKEN_DEMO_91238",
          expiresIn: expiresIn2,
          expiresAt: expiresAt2,
          refreshedAt: Date.now(),
          message: "\u3010\u30C7\u30E2\u30E2\u30FC\u30C9\u3011Long-Lived Token\u306E\u6709\u52B9\u671F\u9650\u309260\u65E5\u9593\u5EF6\u9577\u3057\u307E\u3057\u305F\u3002"
        });
        return;
      }
      const refreshUrl = `https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${encodeURIComponent(cleanToken)}`;
      console.log("Refreshing Threads long-lived token via Meta Graph API...");
      const response = await fetch(refreshUrl, {
        method: "GET"
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.access_token) {
        console.error("Threads token refresh response:", data);
        const errMsg = data?.error?.message || "";
        const errCode = data?.error?.code;
        const errSubcode = data?.error?.error_subcode;
        if (errMsg.includes("less than 24 hours") || errMsg.includes("24 hours")) {
          const now = Date.now();
          const assumedExpiresAt = now + 5184e3 * 1e3;
          res.json({
            success: true,
            accessToken: cleanToken,
            tokenType: "bearer",
            expiresIn: 5184e3,
            expiresAt: assumedExpiresAt,
            refreshedAt: now,
            message: "\u2139\uFE0F \u3053\u306E\u30A2\u30AF\u30BB\u30B9\u30C8\u30FC\u30AF\u30F3\u306F\u767A\u884C\u30FB\u66F4\u65B0\u304B\u308924\u6642\u9593\u672A\u6E80\u306E\u305F\u3081\u5EF6\u9577\u4E0D\u8981\u3067\u3059\uFF08\u73FE\u5728\u3082\u6709\u52B9\u671F\u9650\u7D0460\u65E5\u9593\u304C\u4FDD\u6301\u3055\u308C\u3066\u3044\u307E\u3059\uFF09\u3002\u767A\u884C\u304B\u308924\u6642\u9593\u7D4C\u904E\u5F8C\u306B\u518D\u5EA6\u5EF6\u9577\u304C\u53EF\u80FD\u306B\u306A\u308A\u307E\u3059\u3002"
          });
          return;
        }
        const isExpiredOrInvalid = errCode === 190 || errSubcode === 463 || errSubcode === 467 || errMsg.toLowerCase().includes("expired") || errMsg.toLowerCase().includes("session") || errMsg.toLowerCase().includes("validat") || errMsg.toLowerCase().includes("invalid");
        const codeStr = errCode ? `Code: ${errCode}${errSubcode ? `, Subcode: ${errSubcode}` : ""}` : `HTTP ${response.status}`;
        if (isExpiredOrInvalid) {
          res.status(401).json({
            success: false,
            requiresReLogin: true,
            errorCode: errCode || 190,
            error: `[Threads API\u30A8\u30E9\u30FC (${codeStr})] \u3010\u518D\u30ED\u30B0\u30A4\u30F3\u304C\u5FC5\u8981\u3067\u3059\u3011Threads\u306ELong-Lived\u30C8\u30FC\u30AF\u30F3\u306F\u6709\u52B9\u671F\u9650\uFF08expires_in\uFF09\u304C\u6B8B\u3063\u3066\u3044\u308B\u9593\u3057\u304B\u81EA\u52D5\u66F4\u65B0\u3067\u304D\u307E\u305B\u3093\u3002\u6709\u52B9\u671F\u9650\u304C\u5B8C\u5168\u306B\u5207\u308C\u3066\u3044\u308B\u305F\u3081\u3001\u8A2D\u5B9A\u753B\u9762\u304B\u3089\u65B0\u3057\u3044\u30A2\u30AF\u30BB\u30B9\u30C8\u30FC\u30AF\u30F3\u3092\u5165\u529B\u3057\u3066\u518D\u30ED\u30B0\u30A4\u30F3\u3057\u3066\u304F\u3060\u3055\u3044\u3002`
          });
          return;
        }
        res.status(response.status || 400).json({
          success: false,
          errorCode: errCode,
          error: `[Threads API\u30A8\u30E9\u30FC (${codeStr})] ${errMsg || `Threads\u30C8\u30FC\u30AF\u30F3\u306E\u6709\u52B9\u671F\u9650\u66F4\u65B0\u306B\u5931\u6557\u3057\u307E\u3057\u305F (${response.statusText})`}`
        });
        return;
      }
      const expiresIn = data.expires_in || 5184e3;
      const expiresAt = Date.now() + expiresIn * 1e3;
      res.json({
        success: true,
        accessToken: data.access_token,
        tokenType: data.token_type || "bearer",
        expiresIn,
        expiresAt,
        refreshedAt: Date.now(),
        message: "Threads Long-Lived Token\u306E\u6709\u52B9\u671F\u9650\u3092\u66F4\u65B0\uFF0860\u65E5\u9593\u5EF6\u9577\uFF09\u3057\u307E\u3057\u305F\uFF01"
      });
    } catch (err) {
      console.error("Threads refresh error:", err);
      res.status(500).json({
        success: false,
        error: `Threads \u30C8\u30FC\u30AF\u30F3\u66F4\u65B0\u30A8\u30E9\u30FC: ${err.message || "\u901A\u4FE1\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F"}`
      });
    }
  });
  app.post("/api/threads/post", async (req, res) => {
    try {
      const { credentials, posts, images = [], topic, clientOrigin, isDemo = false } = req.body;
      const { threadsUserId = "me", threadsAccessToken, threadsUsername, isDemoMode } = credentials || {};
      const cleanToken = sanitizeInput(threadsAccessToken);
      const formatSafeThreadsTopic = (rawTopic) => {
        if (!rawTopic) return "";
        let cleaned = sanitizeInput(rawTopic).replace(/^#+/, "").replace(/[.&]/g, "").trim();
        if (cleaned.length > 50) {
          cleaned = cleaned.slice(0, 50);
        }
        const encoder = new TextEncoder();
        while (encoder.encode(cleaned).length > 50 && cleaned.length > 0) {
          cleaned = cleaned.slice(0, -1);
        }
        return cleaned.trim();
      };
      let cleanTopic = formatSafeThreadsTopic(topic);
      if (isDemo || isDemoMode || cleanToken.includes("DEMO") || cleanToken.includes("demo") || !cleanToken) {
        const username = threadsUsername || "@Demo_Threads_Official";
        const demoUrls = (Array.isArray(posts) && posts.length > 0 ? posts : ["demo"]).map(
          (_, idx) => `https://www.threads.net/${username}/post/demo-${Date.now()}-${idx + 1}`
        );
        const imageCount = Array.isArray(images) ? images.length : 0;
        const topicNote = cleanTopic ? `\uFF08\u30C8\u30D4\u30C3\u30AF\u300C#${cleanTopic}\u300D\u8A2D\u5B9A\u6E08\uFF09` : "";
        res.json({
          success: true,
          isDemo: true,
          postsCount: demoUrls.length,
          imagesCount: imageCount,
          topic: cleanTopic || void 0,
          postIds: demoUrls.map((u) => u.split("/").pop()),
          urls: demoUrls,
          message: imageCount > 1 ? `\u3010\u30C7\u30E2\u30E2\u30FC\u30C9\u3011\u753B\u50CF${imageCount}\u679A\u306E\u30AB\u30EB\u30FC\u30BB\u30EB\u6295\u7A3F\u30B7\u30DF\u30E5\u30EC\u30FC\u30B7\u30E7\u30F3\u304C\u5B8C\u4E86\u3057\u307E\u3057\u305F${topicNote}\u3002` : imageCount === 1 ? `\u3010\u30C7\u30E2\u30E2\u30FC\u30C9\u3011\u753B\u50CF1\u679A\u4ED8\u304D\u306E\u6295\u7A3F\u30B7\u30DF\u30E5\u30EC\u30FC\u30B7\u30E7\u30F3\u304C\u5B8C\u4E86\u3057\u307E\u3057\u305F${topicNote}\u3002` : `\u3010\u30C7\u30E2\u30E2\u30FC\u30C9\u3011\u30C6\u30AD\u30B9\u30C8\u6295\u7A3F\u30B7\u30DF\u30E5\u30EC\u30FC\u30B7\u30E7\u30F3\u304C\u5B8C\u4E86\u3057\u307E\u3057\u305F${topicNote}\u3002`
        });
        return;
      }
      if (!cleanToken) {
        res.status(400).json({
          success: false,
          error: "Threads\u306E\u30A2\u30AF\u30BB\u30B9\u30C8\u30FC\u30AF\u30F3\u304C\u8A2D\u5B9A\u3055\u308C\u3066\u3044\u307E\u305B\u3093\u3002"
        });
        return;
      }
      const safePosts = Array.isArray(posts) ? posts : [];
      const safeImages = Array.isArray(images) ? images : [];
      if (safePosts.length === 0 && safeImages.length === 0) {
        res.status(400).json({
          success: false,
          error: "\u6295\u7A3F\u3059\u308B\u30C6\u30AD\u30B9\u30C8\u307E\u305F\u306F\u753B\u50CF\u30FB\u52D5\u753B\u304C\u3042\u308A\u307E\u305B\u3093\u3002"
        });
        return;
      }
      const targetUser = (threadsUserId || "").trim() || "me";
      const createdPostIds = [];
      const createdUrls = [];
      let prevPublishedId = null;
      let baseUrl = "";
      if (clientOrigin && typeof clientOrigin === "string" && clientOrigin.startsWith("http")) {
        baseUrl = clientOrigin.trim().replace(/\/+$/, "");
      } else {
        const proto = req.headers["x-forwarded-proto"] || "https";
        const rawHost = (req.headers["x-forwarded-host"] || req.get("host") || "localhost").toString();
        const cleanHost = rawHost.split(",")[0].trim().replace(/:3000$/, "");
        baseUrl = `${proto}://${cleanHost}`;
      }
      console.log(`Uploading ${Array.isArray(images) ? images.length : 0} media items to public host for Meta Threads API...`);
      const mediaItems = await uploadAllMediaForThreads(
        Array.isArray(images) ? images.slice(0, 20) : [],
        baseUrl
      );
      console.log(`Threads post initiated: ${posts.length} text posts, ${mediaItems.length} media items generated.`);
      const MAX_PER_CAROUSEL = 20;
      const mediaChunks = [];
      for (let m = 0; m < mediaItems.length; m += MAX_PER_CAROUSEL) {
        mediaChunks.push(mediaItems.slice(m, m + MAX_PER_CAROUSEL));
      }
      const totalPostCount = Math.max(safePosts.length, mediaChunks.length) || 1;
      const threadsPostTexts = [];
      for (let p = 0; p < totalPostCount; p++) {
        if (p < safePosts.length) {
          threadsPostTexts.push(safePosts[p] || "");
        } else if (safePosts.length === 0 && p === 0) {
          threadsPostTexts.push("");
        } else {
          threadsPostTexts.push(`\u{1F4F7} \u6DFB\u4ED8\u30E1\u30C7\u30A3\u30A2 (${p * MAX_PER_CAROUSEL + 1}\u301C${Math.min((p + 1) * MAX_PER_CAROUSEL, mediaItems.length)})`);
        }
      }
      const formatMetaError = (data, statusText, context) => {
        const err = data?.error;
        if (!err) return `${context}: ${statusText || "\u901A\u4FE1\u30A8\u30E9\u30FC"}`;
        const rawMsg = err.message || "";
        const code = err.code ? `Code: ${err.code}` : "";
        const subcode = err.error_subcode ? `Subcode: ${err.error_subcode}` : "";
        const type = err.type ? `Type: ${err.type}` : "";
        const codeDetails = [code, subcode, type].filter(Boolean).join(", ");
        const userMsg = err.error_user_msg ? ` [\u8A73\u7D30: ${err.error_user_msg}]` : "";
        let hint = "";
        if (err.code === 36003 || err.code === 1363030 || rawMsg.toLowerCase().includes("aspect ratio") || rawMsg.toLowerCase().includes("dimension")) {
          hint = "\uFF08Threads\u5BFE\u5FDC\u306E\u30A2\u30B9\u30DA\u30AF\u30C8\u6BD4\u306F 1.91:1 \u304B\u3089 4:5 \u3067\u3059\u3002\u52D5\u753B\u30FB\u753B\u50CF\u306E\u30A2\u30B9\u30DA\u30AF\u30C8\u6BD4\u3092\u3054\u78BA\u8A8D\u304F\u3060\u3055\u3044\uFF09";
        } else if (err.code === 36001 || err.code === 36002 || rawMsg.toLowerCase().includes("size") || rawMsg.toLowerCase().includes("large")) {
          hint = "\uFF08\u30E1\u30C7\u30A3\u30A2\u30D5\u30A1\u30A4\u30EB\u306E\u5BB9\u91CF\u304CMeta\u306E\u5236\u9650\u3092\u8D85\u3048\u3066\u3044\u307E\u3059\uFF09";
        } else if (rawMsg.includes("An unknown error") || err.code === 1) {
          hint = "\uFF08Threads\u30A2\u30AF\u30BB\u30B9\u30C8\u30FC\u30AF\u30F3\u306E\u6295\u7A3F\u6A29\u9650 threads_content_publish \u304C\u4E0D\u8DB3\u3057\u3066\u3044\u308B\u53EF\u80FD\u6027\u304C\u3042\u308A\u307E\u3059\uFF09";
        } else if (err.code === 190 || rawMsg.toLowerCase().includes("expired") || rawMsg.toLowerCase().includes("session")) {
          hint = "\uFF08\u30A2\u30AF\u30BB\u30B9\u30C8\u30FC\u30AF\u30F3\u306E\u6709\u52B9\u671F\u9650\u304C\u5207\u308C\u3066\u3044\u307E\u3059\u3002\u518D\u30ED\u30B0\u30A4\u30F3\u304C\u5FC5\u8981\u3067\u3059\uFF09";
        }
        return `[Threads API\u30A8\u30E9\u30FC ${codeDetails ? `(${codeDetails})` : ""}] ${context}: ${rawMsg}${userMsg}${hint ? ` ${hint}` : ""}`;
      };
      for (let i = 0; i < threadsPostTexts.length; i++) {
        const postText = threadsPostTexts[i];
        const currentPostMedias = mediaChunks[i] || [];
        let containerId;
        if (currentPostMedias.length > 1) {
          const childContainerIds = [];
          for (let idx = 0; idx < currentPostMedias.length; idx++) {
            const mediaItem = currentPostMedias[idx];
            const isVideo = mediaItem.type === "VIDEO";
            let childId = null;
            let lastItemErr = "";
            for (let attempt = 0; attempt < 3; attempt++) {
              const urlToUse = attempt === 2 && mediaItem.fallbackUrl ? mediaItem.fallbackUrl : mediaItem.url;
              const itemParams = new URLSearchParams();
              itemParams.append("access_token", cleanToken);
              itemParams.append("media_type", isVideo ? "VIDEO" : "IMAGE");
              if (isVideo) {
                itemParams.append("video_url", urlToUse);
              } else {
                itemParams.append("image_url", urlToUse);
              }
              itemParams.append("is_carousel_item", "true");
              try {
                const itemRes = await fetch(`https://graph.threads.net/v1.0/${targetUser}/threads`, {
                  method: "POST",
                  body: itemParams
                });
                const itemData = await itemRes.json().catch(() => ({}));
                if (itemRes.ok && itemData.id) {
                  childId = itemData.id;
                  break;
                }
                lastItemErr = formatMetaError(itemData, itemRes.statusText, `\u30AB\u30EB\u30FC\u30BB\u30EB\u30A2\u30A4\u30C6\u30E0(#${idx + 1})\u306E\u4F5C\u6210`);
                console.warn(`[Threads Carousel Item #${idx + 1}] Attempt #${attempt + 1} failed: ${lastItemErr}`);
              } catch (fetchErr) {
                lastItemErr = fetchErr.message || "\u30CD\u30C3\u30C8\u30EF\u30FC\u30AF\u901A\u4FE1\u30A8\u30E9\u30FC";
                console.warn(`[Threads Carousel Item #${idx + 1}] Attempt #${attempt + 1} network error: ${lastItemErr}`);
              }
              if (attempt < 2) {
                await new Promise((r) => setTimeout(r, attempt === 0 ? 1200 : 2500));
              }
            }
            if (!childId) {
              throw new Error(`Threads\u30AB\u30EB\u30FC\u30BB\u30EB\u30A2\u30A4\u30C6\u30E0(#${idx + 1})\u306E\u4F5C\u6210\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${lastItemErr}`);
            }
            childContainerIds.push(childId);
            if (idx < currentPostMedias.length - 1) {
              await new Promise((r) => setTimeout(r, isVideo ? 500 : 300));
            }
          }
          const hasVideoInCarousel = currentPostMedias.some((m) => m.type === "VIDEO");
          console.log(`[Threads Carousel] Waiting for ${childContainerIds.length} child containers to be FINISHED (hasVideo: ${hasVideoInCarousel})...`);
          await Promise.all(
            childContainerIds.map((cid) => waitForContainerFinished(cid, cleanToken, hasVideoInCarousel ? 12e4 : 45e3))
          );
          let parentId = null;
          let lastParentErr = "";
          for (let pAttempt = 0; pAttempt < 3; pAttempt++) {
            const carouselParams = new URLSearchParams();
            carouselParams.append("access_token", cleanToken);
            carouselParams.append("media_type", "CAROUSEL");
            carouselParams.append("children", childContainerIds.join(","));
            if (postText && postText.trim()) {
              carouselParams.append("text", postText.trim());
            }
            if (cleanTopic) {
              carouselParams.append("topic_tag", cleanTopic);
            }
            if (prevPublishedId) {
              carouselParams.append("reply_to_id", prevPublishedId);
            }
            try {
              const carouselRes = await fetch(`https://graph.threads.net/v1.0/${targetUser}/threads`, {
                method: "POST",
                body: carouselParams
              });
              const carouselData = await carouselRes.json().catch(() => ({}));
              if (carouselRes.ok && carouselData.id) {
                parentId = carouselData.id;
                break;
              }
              lastParentErr = formatMetaError(carouselData, carouselRes.statusText, `\u30AB\u30EB\u30FC\u30BB\u30EB\u89AA\u30B3\u30F3\u30C6\u30CA\u306E\u4F5C\u6210(#${i + 1})`);
              console.warn(`[Threads Carousel Parent] Attempt #${pAttempt + 1} failed: ${lastParentErr}`);
              if (lastParentErr.includes("topic_tag") && cleanTopic) {
                console.warn(`[Threads Carousel Parent] topic_tag rejected by Meta API (${cleanTopic}). Retrying without topic_tag...`);
                cleanTopic = "";
              }
            } catch (pErr) {
              lastParentErr = pErr.message || "\u901A\u4FE1\u30A8\u30E9\u30FC";
            }
            if (pAttempt < 2) {
              await new Promise((r) => setTimeout(r, 2e3));
            }
          }
          if (!parentId) {
            throw new Error(`Threads\u30AB\u30EB\u30FC\u30BB\u30EB\u89AA\u30B3\u30F3\u30C6\u30CA\u306E\u4F5C\u6210\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${lastParentErr}`);
          }
          containerId = parentId;
        } else if (currentPostMedias.length === 1) {
          const mediaItem = currentPostMedias[0];
          const isVideo = mediaItem.type === "VIDEO";
          let singleId = null;
          let lastSingleErr = "";
          for (let attempt = 0; attempt < 3; attempt++) {
            const urlToUse = attempt === 2 && mediaItem.fallbackUrl ? mediaItem.fallbackUrl : mediaItem.url;
            const containerParams = new URLSearchParams();
            containerParams.append("access_token", cleanToken);
            containerParams.append("media_type", isVideo ? "VIDEO" : "IMAGE");
            if (isVideo) {
              containerParams.append("video_url", urlToUse);
            } else {
              containerParams.append("image_url", urlToUse);
            }
            if (postText && postText.trim()) {
              containerParams.append("text", postText.trim());
            }
            if (cleanTopic) {
              containerParams.append("topic_tag", cleanTopic);
            }
            if (prevPublishedId) {
              containerParams.append("reply_to_id", prevPublishedId);
            }
            try {
              const createContainerRes = await fetch(`https://graph.threads.net/v1.0/${targetUser}/threads`, {
                method: "POST",
                body: containerParams
              });
              const containerData = await createContainerRes.json().catch(() => ({}));
              if (createContainerRes.ok && containerData.id) {
                singleId = containerData.id;
                break;
              }
              lastSingleErr = formatMetaError(containerData, createContainerRes.statusText, `\u5358\u4E00\u30E1\u30C7\u30A3\u30A2\u30B3\u30F3\u30C6\u30CA\u4F5C\u6210(#${i + 1})`);
              console.warn(`[Threads Single Media] Attempt #${attempt + 1} failed: ${lastSingleErr}`);
              if (lastSingleErr.includes("topic_tag") && cleanTopic) {
                console.warn(`[Threads Single Media] topic_tag rejected by Meta API (${cleanTopic}). Retrying without topic_tag...`);
                cleanTopic = "";
              }
            } catch (sErr) {
              lastSingleErr = sErr.message || "\u901A\u4FE1\u30A8\u30E9\u30FC";
            }
            if (attempt < 2) {
              await new Promise((r) => setTimeout(r, attempt === 0 ? 1200 : 2500));
            }
          }
          if (!singleId) {
            throw new Error(`Threads\u5358\u4E00\u30E1\u30C7\u30A3\u30A2\u30B3\u30F3\u30C6\u30CA\u4F5C\u6210\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${lastSingleErr}`);
          }
          containerId = singleId;
        } else {
          const sendTextContainer = async (useTopic) => {
            const containerParams = new URLSearchParams();
            containerParams.append("access_token", cleanToken);
            containerParams.append("media_type", "TEXT");
            containerParams.append("text", postText);
            if (useTopic) {
              containerParams.append("topic_tag", useTopic);
            }
            if (prevPublishedId) {
              containerParams.append("reply_to_id", prevPublishedId);
            }
            const createContainerRes = await fetch(`https://graph.threads.net/v1.0/${targetUser}/threads`, {
              method: "POST",
              body: containerParams
            });
            const containerData = await createContainerRes.json().catch(() => ({}));
            return { ok: createContainerRes.ok && Boolean(containerData.id), data: containerData, statusText: createContainerRes.statusText };
          };
          let textResult = await sendTextContainer(cleanTopic);
          if (!textResult.ok && cleanTopic) {
            const errStr = formatMetaError(textResult.data, textResult.statusText, `\u30C6\u30AD\u30B9\u30C8\u30B3\u30F3\u30C6\u30CA\u4F5C\u6210(#${i + 1})`);
            if (errStr.includes("topic_tag")) {
              console.warn(`[Threads Text Container] topic_tag rejected (${cleanTopic}). Retrying without topic_tag...`);
              cleanTopic = "";
              textResult = await sendTextContainer("");
            }
          }
          if (!textResult.ok) {
            console.error("Threads text container error:", textResult.data);
            throw new Error(formatMetaError(textResult.data, textResult.statusText, `\u30C6\u30AD\u30B9\u30C8\u30B3\u30F3\u30C6\u30CA\u4F5C\u6210(#${i + 1})`));
          }
          containerId = textResult.data.id;
        }
        const isCurrentPostVideo = currentPostMedias.some((m) => m.type === "VIDEO");
        await waitForContainerFinished(containerId, cleanToken, isCurrentPostVideo ? 12e4 : 45e3);
        const publishParams = new URLSearchParams();
        publishParams.append("access_token", cleanToken);
        publishParams.append("creation_id", containerId);
        let publishedPostId = null;
        let lastPublishError = "";
        for (let attempt = 0; attempt < 5; attempt++) {
          const publishRes = await fetch(`https://graph.threads.net/v1.0/${targetUser}/threads_publish`, {
            method: "POST",
            body: publishParams
          });
          const publishData = await publishRes.json().catch(() => ({}));
          if (publishRes.ok && publishData.id) {
            publishedPostId = publishData.id;
            break;
          }
          lastPublishError = formatMetaError(publishData, publishRes.statusText, "\u516C\u958BAPI");
          console.warn(`Publish attempt #${attempt + 1} for post #${i + 1}: ${lastPublishError}`);
          if (attempt < 4) {
            await new Promise((resolve) => setTimeout(resolve, isCurrentPostVideo ? 3500 : 2e3));
          }
        }
        if (!publishedPostId) {
          throw new Error(`Threads\u516C\u958B\u51E6\u7406\u306E\u5931\u6557 (#${i + 1}): ${lastPublishError}`);
        }
        createdPostIds.push(publishedPostId);
        prevPublishedId = publishedPostId;
        const cleanUsername = (threadsUsername || "").replace(/^@/, "");
        const postUrl = cleanUsername ? `https://www.threads.net/@${cleanUsername}/post/${publishedPostId}` : `https://www.threads.net/post/${publishedPostId}`;
        createdUrls.push(postUrl);
        if (i < threadsPostTexts.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1e3));
        }
      }
      res.json({
        success: true,
        postsCount: createdUrls.length,
        postIds: createdPostIds,
        urls: createdUrls
      });
    } catch (err) {
      console.error("Threads post error:", err);
      res.status(500).json({
        success: false,
        error: err.message || "Threads\u6295\u7A3F\u4E2D\u306B\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F\u3002"
      });
    }
  });
  app.post("/api/analytics/engagement", async (req, res) => {
    try {
      const {
        blueskyUrls = [],
        blueskyPostUris = [],
        threadsUrls = [],
        threadsMediaIds = [],
        blueskyAccessJwt,
        blueskyServiceUrl = "https://bsky.social",
        threadsAccessToken
      } = req.body;
      let blueskyStats = { likes: 0, reposts: 0, replies: 0, quotes: 0, views: 0 };
      let threadsStats = { likes: 0, reposts: 0, replies: 0, views: 0 };
      const bskyUrisToFetch = [...blueskyPostUris];
      for (const bUrl of blueskyUrls) {
        if (!bUrl || typeof bUrl !== "string") continue;
        const match = bUrl.match(/bsky\.app\/profile\/([^/]+)\/post\/([^/?#]+)/);
        if (match) {
          const rawHandle = match[1];
          const rkey = match[2];
          const did = await resolveBlueskyHandleToDid(rawHandle, blueskyServiceUrl);
          if (did) {
            bskyUrisToFetch.push(`at://${did}/app.bsky.feed.post/${rkey}`);
          }
        }
      }
      if (bskyUrisToFetch.length > 0) {
        try {
          const uniqueUris = Array.from(new Set(bskyUrisToFetch));
          const queryParams = uniqueUris.map((u) => `uris=${encodeURIComponent(u)}`).join("&");
          const pds = (blueskyServiceUrl || "https://bsky.social").replace(/\/+$/, "");
          const bRes = await fetch(`${pds}/xrpc/app.bsky.feed.getPosts?${queryParams}`, {
            headers: blueskyAccessJwt ? { Authorization: `Bearer ${blueskyAccessJwt}` } : {}
          });
          if (bRes.ok) {
            const bData = await bRes.json();
            const posts = bData?.posts || [];
            for (const p of posts) {
              blueskyStats.likes += p.likeCount || 0;
              blueskyStats.reposts += p.repostCount || 0;
              blueskyStats.replies += p.replyCount || 0;
              blueskyStats.quotes += p.quoteCount || 0;
            }
          }
        } catch (bErr) {
          console.warn("[Engagement] Bluesky fetch error:", bErr);
        }
      }
      const tIdsToFetch = [...threadsMediaIds];
      for (const tUrl of threadsUrls) {
        if (!tUrl || typeof tUrl !== "string") continue;
        const match = tUrl.match(/threads\.net\/(?:@[^/]+\/)?post\/([0-9]+)/);
        if (match) {
          tIdsToFetch.push(match[1]);
        }
      }
      if (tIdsToFetch.length > 0 && threadsAccessToken) {
        try {
          for (const mediaId of Array.from(new Set(tIdsToFetch))) {
            const tRes = await fetch(
              `https://graph.threads.net/v1.0/${mediaId}?fields=id,like_count,reply_count,views&access_token=${threadsAccessToken}`
            );
            if (tRes.ok) {
              const tData = await tRes.json();
              threadsStats.likes += tData.like_count || 0;
              threadsStats.replies += tData.reply_count || 0;
              threadsStats.views += tData.views || 0;
            }
          }
        } catch (tErr) {
          console.warn("[Engagement] Threads fetch error:", tErr);
        }
      }
      res.json({
        success: true,
        bluesky: blueskyStats,
        threads: threadsStats,
        fetchedAt: Date.now()
      });
    } catch (err) {
      console.error("[Engagement API Error]", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app.post("/api/app/quit", (_req, res) => {
    res.json({ success: true, message: "\u30A2\u30D7\u30EA\u30B1\u30FC\u30B7\u30E7\u30F3\u3092\u7D42\u4E86\u3057\u307E\u3059" });
  });
  app.get("/api/desktop-package", async (_req, res) => {
    try {
      const JSZip = (await import("jszip")).default;
      const fs2 = await import("fs");
      const zip = new JSZip();
      const rootFiles = [
        "desktop_app.py",
        "requirements.txt",
        "run_desktop.bat",
        "run_desktop_silent.vbs",
        "run_desktop.sh",
        "make_windows_exe.bat",
        "build_exe.py",
        "README_DESKTOP.md"
      ];
      for (const fileName of rootFiles) {
        const filePath = import_path.default.join(process.cwd(), fileName);
        if (fs2.existsSync(filePath)) {
          zip.file(fileName, fs2.readFileSync(filePath));
        }
      }
      const distDir = import_path.default.join(process.cwd(), "desktop_ui");
      const fallbackDist = import_path.default.join(process.cwd(), "dist");
      const targetDir = fs2.existsSync(distDir) ? distDir : fallbackDist;
      if (fs2.existsSync(targetDir)) {
        const addDirToZip = (currentDir, zipDirName) => {
          const items = fs2.readdirSync(currentDir);
          for (const item of items) {
            const itemPath = import_path.default.join(currentDir, item);
            const stat = fs2.statSync(itemPath);
            if (stat.isDirectory()) {
              addDirToZip(itemPath, `${zipDirName}/${item}`);
            } else {
              if (!item.endsWith(".cjs") && !item.endsWith(".map")) {
                zip.file(`${zipDirName}/${item}`, fs2.readFileSync(itemPath));
              }
            }
          }
        };
        addDirToZip(targetDir, "desktop_ui");
        addDirToZip(targetDir, "dist");
      }
      zip.file(
        "START_HERE.txt",
        `============================================================
 CrossPost Desktop Studio (\u5358\u4F53\u30C7\u30B9\u30AF\u30C8\u30C3\u30D7\u30A2\u30D7\u30EA)
============================================================

\u2605 Web\u30D6\u30E9\u30A6\u30B6\uFF08\u30BF\u30D6\u3084\u30A2\u30C9\u30EC\u30B9\u30D0\u30FC\u306E\u3042\u308B\u901A\u5E38\u30D6\u30E9\u30A6\u30B6\uFF09\u306F\u8D77\u52D5\u305B\u305A\u3001
   \u5C02\u7528\u306E\u5358\u4F53\u30A2\u30D7\u30EA\u30A6\u30A3\u30F3\u30C9\u30A6\uFF08\u30CD\u30A4\u30C6\u30A3\u30D6GUI\uFF09\u3068\u3057\u3066\u8D77\u52D5\u3057\u307E\u3059\u3002

\u3010Windows\u3067\u306E\u8D77\u52D5\u624B\u9806\u3011
1. \u30C0\u30A6\u30F3\u30ED\u30FC\u30C9\u3057\u305F\u672CZIP\u30D5\u30A1\u30A4\u30EB\u3092\u53F3\u30AF\u30EA\u30C3\u30AF\u3057\u3001\u300C\u3059\u3079\u3066\u5C55\u958B\u300D\u3067\u89E3\u51CD\u3057\u307E\u3059\u3002
2. \u300Crun_desktop.bat\u300D\u3092\u30C0\u30D6\u30EB\u30AF\u30EA\u30C3\u30AF\u3057\u307E\u3059\u3002
   \u203B \u81EA\u52D5\u7684\u306B\u5C02\u7528GUI\u30A8\u30F3\u30B8\u30F3\u304C\u30BB\u30C3\u30C8\u30A2\u30C3\u30D7\u3055\u308C\u3001\u5358\u4F53\u30A2\u30D7\u30EA\u30A6\u30A3\u30F3\u30C9\u30A6\u304C\u8D77\u52D5\u3057\u307E\u3059\u3002

\u3010\u5358\u4F53EXE\u30D5\u30A1\u30A4\u30EB\uFF08.exe\uFF09\u3092\u30EF\u30F3\u30AF\u30EA\u30C3\u30AF\u3067\u4F5C\u308A\u305F\u3044\u5834\u5408\u3011
\u30FB\u300Cmake_windows_exe.bat\u300D\u3092\u30C0\u30D6\u30EB\u30AF\u30EA\u30C3\u30AF\u3059\u308B\u3068\u3001\u5358\u4F53\u3067\u52D5\u304F\u300CCrossPostStudio.exe\u300D\u304C\u81EA\u52D5\u751F\u6210\u3055\u308C\u307E\u3059\u3002

\u3010macOS / Linux\u3067\u306E\u8D77\u52D5\u624B\u9806\u3011
\u30BF\u30FC\u30DF\u30CA\u30EB\u3067\u672C\u30D5\u30A9\u30EB\u30C0\u3092\u958B\u304D\u3001\u4EE5\u4E0B\u3092\u5B9F\u884C\u3057\u307E\u3059:
   bash run_desktop.sh (\u307E\u305F\u306F python3 desktop_app.py)
`
      );
      const zipBuffer = await zip.generateAsync({
        type: "nodebuffer",
        compression: "DEFLATE",
        compressionOptions: { level: 6 }
      });
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", 'attachment; filename="crosspost-desktop-python.zip"');
      res.setHeader("Content-Length", zipBuffer.length.toString());
      res.send(zipBuffer);
    } catch (err) {
      console.error("Failed to generate desktop package zip:", err);
      res.status(500).json({
        success: false,
        error: "\u30C7\u30B9\u30AF\u30C8\u30C3\u30D7\u30D1\u30C3\u30B1\u30FC\u30B8ZIP\u306E\u751F\u6210\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002"
      });
    }
  });
  app.use((err, _req, res, next) => {
    if (res.headersSent) {
      return next(err);
    }
    console.error("[Express Global Error]:", err);
    if (err.status === 413 || err.type === "entity.too.large") {
      res.status(413).json({
        success: false,
        error: "\u9001\u4FE1\u30C7\u30FC\u30BF\uFF08\u753B\u50CF\uFF09\u306E\u30B5\u30A4\u30BA\u304C\u5927\u304D\u3059\u304E\u307E\u3059\u3002\u753B\u50CF\u30B5\u30A4\u30BA\u307E\u305F\u306F\u679A\u6570\u3092\u6E1B\u3089\u3057\u3066\u518D\u8A66\u884C\u3057\u3066\u304F\u3060\u3055\u3044\u3002"
      });
      return;
    }
    res.status(err.status || 500).json({
      success: false,
      error: err.message || "\u30B5\u30FC\u30D0\u30FC\u5185\u90E8\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F\u3002"
    });
  });
  const distPath = import_path.default.join(process.cwd(), "dist");
  const indexHtmlPath = import_path.default.join(distPath, "index.html");
  const hasDistIndexHtml = import_fs.default.existsSync(indexHtmlPath);
  const isProduction = process.env.NODE_ENV === "production" && hasDistIndexHtml;
  if (isProduction) {
    app.use(import_express.default.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");
        }
      }
    }));
    app.get("*", (_req, res) => {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.sendFile(indexHtmlPath);
    });
  } else {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`CrossPost Studio server listening on http://0.0.0.0:${PORT}`);
  });
}
startServer().catch((err) => {
  console.error("Server startup failed:", err);
  process.exit(1);
});
//# sourceMappingURL=server.cjs.map
