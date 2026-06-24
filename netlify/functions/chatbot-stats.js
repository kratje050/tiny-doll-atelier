const STORE_NAME = "tiny-doll-atelier";
const DATA_KEY = "site-data";

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

function safeText(value, maxLength = 180) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, maxLength);
}

async function getBlobStore() {
  const siteID = process.env.NETLIFY_BLOBS_SITE_ID || "";
  const token = process.env.NETLIFY_BLOBS_TOKEN || "";
  if (!siteID || !token) {
    const error = new Error("Online opslag is niet ingesteld.");
    error.code = "BLOBS_CONFIG_MISSING";
    throw error;
  }

  const { getStore } = await import("@netlify/blobs");
  return getStore({ name: STORE_NAME, siteID, token });
}

function defaultStats() {
  return {
    opens: 0,
    questions: 0,
    unknownQuestions: 0,
    contactClicks: 0,
    productSearches: 0,
    cartAdds: 0,
    quickQuestions: {},
  };
}

function updateStats(settings, payload) {
  const stats = { ...defaultStats(), ...(settings.chatbotStats || {}) };
  stats.quickQuestions = { ...(stats.quickQuestions || {}) };

  if (payload.type === "open") stats.opens += 1;
  if (payload.type === "question") stats.questions += 1;
  if (payload.type === "unknown") stats.unknownQuestions += 1;
  if (payload.type === "contact") stats.contactClicks += 1;
  if (payload.type === "productSearch") stats.productSearches += 1;
  if (payload.type === "cartAdd") stats.cartAdds += 1;
  if (payload.type === "quick") {
    const label = safeText(payload.detail, 60) || "Snelle vraag";
    stats.quickQuestions[label] = Number(stats.quickQuestions[label] || 0) + 1;
  }

  return stats;
}

function updateUnknownQuestions(settings, payload) {
  if (payload.type !== "unknownQuestion") {
    return settings.chatbotUnknownQuestions || [];
  }

  const question = safeText(payload.question);
  if (!question) {
    return settings.chatbotUnknownQuestions || [];
  }

  const questions = Array.isArray(settings.chatbotUnknownQuestions)
    ? [...settings.chatbotUnknownQuestions]
    : [];
  const normalized = question.toLowerCase();
  const existing = questions.find((item) => String(item.question || "").toLowerCase() === normalized);
  if (existing) {
    existing.count = Number(existing.count || 1) + 1;
    existing.updatedAt = new Date().toISOString();
  } else {
    questions.unshift({
      question,
      count: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  return questions.slice(0, 30);
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, message: "Deze actie is niet toegestaan." });
  }

  try {
    const payload = JSON.parse(event.body || "{}");
    const store = await getBlobStore();
    const data = (await store.get(DATA_KEY, { type: "json" })) || {};
    const settings = data.settings && typeof data.settings === "object" ? data.settings : {};

    const nextSettings = {
      ...settings,
      chatbotStats: updateStats(settings, payload),
      chatbotUnknownQuestions: updateUnknownQuestions(settings, payload),
    };

    const nextData = {
      ...data,
      settings: nextSettings,
      updatedAt: new Date().toISOString(),
    };

    await store.setJSON(DATA_KEY, nextData);
    return json(200, { ok: true });
  } catch (error) {
    return json(200, {
      ok: false,
      message: error.code === "BLOBS_CONFIG_MISSING" ? "Online opslag is niet ingesteld." : "Chatbotstatistiek is niet opgeslagen.",
    });
  }
};
