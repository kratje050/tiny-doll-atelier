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
  const { getStore } = await import("@netlify/blobs");
  const siteID =
    process.env.NETLIFY_BLOBS_SITE_ID ||
    process.env.NETLIFY_SITE_ID ||
    process.env.SITE_ID ||
    "";
  const token =
    process.env.NETLIFY_BLOBS_TOKEN ||
    process.env.NETLIFY_AUTH_TOKEN ||
    process.env.NETLIFY_API_TOKEN ||
    "";

  if (siteID && token) {
    return getStore(STORE_NAME, { siteID, token });
  }

  return getStore(STORE_NAME);
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
    const store = await getBlobStore();

    if (event.httpMethod === "GET") {
      const privateRequest = new URLSearchParams(event.rawQuery || "").get("private") === "1";
      if (privateRequest && !hasValidSession(event)) {
        return json(401, { ok: false, message: "Log opnieuw in bij beheer." });
      }

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
    const needsBlobConfig = /siteID|token|Netlify Blobs|environment has not been configured/i.test(
      error.message || "",
    );
    return json(500, {
      ok: false,
      message: needsBlobConfig
        ? "Online opslag is nog niet gekoppeld. Voeg NETLIFY_BLOBS_SITE_ID en NETLIFY_BLOBS_TOKEN toe bij de omgevingsvariabelen in Netlify."
        : error.message || "Online opslag kon niet worden bereikt.",
    });
  }
};
