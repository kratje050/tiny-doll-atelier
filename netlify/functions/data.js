const crypto = require("crypto");

const COOKIE_NAME = "tiny_doll_admin_session";
const SESSION_MAX_AGE = 60 * 60 * 2;
const STORE_NAME = "tiny-doll-atelier";
const DATA_KEY = "site-data";
const PRIVATE_KEYS = [
  "products",
  "categories",
  "discounts",
  "giftCards",
  "orders",
  "customers",
  "visits",
  "settings",
  "reviews",
  "emailTemplates",
];
const PUBLIC_KEYS = ["products", "categories", "discounts", "settings", "reviews"];

function getBlobConfig() {
  const siteID = process.env.NETLIFY_BLOBS_SITE_ID || "";
  const token = process.env.NETLIFY_BLOBS_TOKEN || "";
  const missing = [];

  if (!siteID) {
    missing.push("NETLIFY_BLOBS_SITE_ID");
  }
  if (!token) {
    missing.push("NETLIFY_BLOBS_TOKEN");
  }

  return { siteID, token, missing };
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

function safeEquals(left = "", right = "") {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function sign(value) {
  return crypto
    .createHmac("sha256", process.env.ADMIN_SESSION_SECRET || "")
    .update(value)
    .digest("hex");
}

function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((item) => item.trim().split("="))
      .filter(([key, value]) => key && value)
      .map(([key, value]) => [key, decodeURIComponent(value)]),
  );
}

function hasValidSession(event) {
  if (!process.env.ADMIN_SESSION_SECRET) {
    return false;
  }

  const cookies = parseCookies(event.headers.cookie || event.headers.Cookie || "");
  const session = cookies[COOKIE_NAME];
  if (!session) {
    return false;
  }

  const [timestamp, signature] = session.split(".");
  if (!timestamp || !signature || !safeEquals(sign(timestamp), signature)) {
    return false;
  }

  const createdAt = Number(timestamp);
  return Number.isFinite(createdAt) && Date.now() - createdAt < SESSION_MAX_AGE * 1000;
}

async function getBlobStore() {
  const config = getBlobConfig();
  if (config.missing.length) {
    const error = new Error(`Online opslag mist: ${config.missing.join(", ")}.`);
    error.code = "BLOBS_CONFIG_MISSING";
    error.missing = config.missing;
    throw error;
  }

  const { getStore } = await import("@netlify/blobs");
  return getStore({
    name: STORE_NAME,
    siteID: config.siteID,
    token: config.token,
  });
}

async function getStorageStatus() {
  const config = getBlobConfig();
  if (config.missing.length) {
    return {
      ok: true,
      blobsConfigured: false,
      storageMode: "local",
      writable: false,
      missing: config.missing,
      message: `Online opslag mist: ${config.missing.join(", ")}.`,
    };
  }

  try {
    const store = await getBlobStore();
    const status = {
      checkedAt: new Date().toISOString(),
      ok: true,
    };
    await store.setJSON("storage-status", status);
    const savedStatus = await store.get("storage-status", { type: "json" });

    return {
      ok: true,
      blobsConfigured: true,
      storageMode: "online",
      writable: Boolean(savedStatus?.ok),
      message: "Online opslag is gekoppeld. Winkeldata wordt centraal opgeslagen.",
    };
  } catch {
    return {
      ok: true,
      blobsConfigured: true,
      storageMode: "error",
      writable: false,
      message:
        "Online opslag is ingesteld, maar schrijven naar Netlify Blobs lukt nog niet. Controleer tokenrechten.",
    };
  }
}

function pickData(data, keys) {
  const result = {};
  keys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      result[key] = data[key];
    }
  });
  return result;
}

function cleanPublicData(data) {
  const publicData = pickData(data, PUBLIC_KEYS);
  if (Array.isArray(publicData.products)) {
    publicData.products = publicData.products.filter((product) => product && product.active !== false);
  }
  if (Array.isArray(publicData.discounts)) {
    publicData.discounts = publicData.discounts.filter((discount) => discount && discount.active !== false);
  }
  if (Array.isArray(publicData.reviews)) {
    publicData.reviews = publicData.reviews.filter((review) => review && review.active !== false);
  }
  if (publicData.settings && typeof publicData.settings === "object") {
    publicData.settings = { ...publicData.settings };
    delete publicData.settings.chatbotStats;
    delete publicData.settings.chatbotUnknownQuestions;
  }
  return publicData;
}

function sanitizeIncomingData(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const data = pickData(value, PRIVATE_KEYS);
  PRIVATE_KEYS.forEach((key) => {
    if (key !== "settings" && key in data && !Array.isArray(data[key])) {
      delete data[key];
    }
  });
  if (data.settings && (typeof data.settings !== "object" || Array.isArray(data.settings))) {
    delete data.settings;
  }
  return data;
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "GET") {
      const params = new URLSearchParams(event.rawQuery || "");
      const privateRequest = params.get("private") === "1";
      const statusRequest = params.get("status") === "1";

      if (privateRequest && !hasValidSession(event)) {
        return json(401, { ok: false, message: "Log opnieuw in bij beheer." });
      }

      if (statusRequest) {
        if (!hasValidSession(event)) {
          return json(401, { ok: false, message: "Log opnieuw in bij beheer." });
        }

        return json(200, await getStorageStatus());
      }

      const store = await getBlobStore();
      const data = (await store.get(DATA_KEY, { type: "json" })) || {};
      return json(200, {
        ok: true,
        data: privateRequest ? pickData(data, PRIVATE_KEYS) : cleanPublicData(data),
        updatedAt: data.updatedAt || "",
      });
    }

    if (event.httpMethod === "POST") {
      if (!hasValidSession(event)) {
        return json(401, { ok: false, message: "Log opnieuw in bij beheer om wijzigingen op te slaan." });
      }

      const store = await getBlobStore();
      const payload = JSON.parse(event.body || "{}");
      const incoming = sanitizeIncomingData(payload.data);
      const current = (await store.get(DATA_KEY, { type: "json" })) || {};
      const data = {
        ...current,
        ...incoming,
        updatedAt: new Date().toISOString(),
      };

      await store.setJSON(DATA_KEY, data);
      return json(200, { ok: true, updatedAt: data.updatedAt });
    }

    return json(405, { ok: false, message: "Deze actie is niet toegestaan." });
  } catch (error) {
    const missing = error.code === "BLOBS_CONFIG_MISSING" ? error.missing || [] : [];
    return json(500, {
      ok: false,
      blobsConfigured: false,
      storageMode: "local",
      missing,
      message: missing.length
        ? `Online opslag mist: ${missing.join(", ")}.`
        : error.message || "Online opslag kon niet worden bereikt.",
    });
  }
};
