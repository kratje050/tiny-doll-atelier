const crypto = require("node:crypto");
const tls = require("node:tls");

const STORE_NAME = "tiny-doll-atelier";
const DATA_KEY = "site-data";
const COOKIE_NAME = "tiny_doll_account_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const RESET_MAX_AGE = 60 * 60;

function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

function clean(value = "", max = 1000) {
  return String(value ?? "")
    .replace(/[<>]/g, "")
    .replace(/[\u0000-\u001f]/g, "")
    .trim()
    .slice(0, max);
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));
}

function getEmailAddress(value) {
  const match = String(value || "").match(/<([^>]+)>/);
  return (match ? match[1] : value).trim().toLowerCase();
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function hashToken(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function hashPassword(password, salt = randomToken(18)) {
  const hash = crypto.scryptSync(password, salt, 64).toString("base64");
  return { salt, hash: `scrypt:${salt}:${hash}` };
}

function verifyPassword(password, storedHash = "") {
  const [, salt, hash] = String(storedHash).split(":");
  if (!salt || !hash) {
    return false;
  }
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "base64");
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
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

function sessionCookie(value, maxAge = SESSION_MAX_AGE) {
  const secure = process.env.URL || process.env.NETLIFY;
  return `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${
    secure ? "; Secure" : ""
  }`;
}

function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

async function getBlobStore() {
  const siteID = process.env.NETLIFY_BLOBS_SITE_ID || "";
  const token = process.env.NETLIFY_BLOBS_TOKEN || "";
  if (!siteID || !token) {
    throw new Error("Online opslag is nog niet gekoppeld.");
  }
  const { getStore } = await import("@netlify/blobs");
  return getStore({ name: STORE_NAME, siteID, token });
}

async function readData() {
  const store = await getBlobStore();
  return { store, data: (await store.get(DATA_KEY, { type: "json" })) || {} };
}

async function writeData(store, data) {
  await store.setJSON(DATA_KEY, { ...data, updatedAt: new Date().toISOString() });
}

function publicAccount(account) {
  if (!account) {
    return null;
  }
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    phone: account.phone || "",
    address: account.address || "",
    postalCode: account.postalCode || "",
    city: account.city || "",
    country: account.country || "Nederland",
    deliveryNote: account.deliveryNote || "",
    createdAt: account.createdAt,
  };
}

function isRestrictedStatus(status = "") {
  return ["Geblokkeerd", "Verwijderd", "Geanonimiseerd", "Verdacht / controleren"].includes(status);
}

function normalizedAccountStatus(account = {}) {
  const status = String(account.status || "").trim();
  if (isRestrictedStatus(status)) {
    return status;
  }
  if (!status || account.accountSource === "register" || account.registrationSource === "customer" || account.lastLoginAt || account.resetUsedAt) {
    return "Actief";
  }
  if (["Wachtwoordreset aangevraagd", "unconfirmed", "not_confirmed", "pending"].includes(status)) {
    return "Actief";
  }
  return status === "Nog niet bevestigd" ? "Nog niet bevestigd" : "Actief";
}

function shopBaseUrl() {
  return String(process.env.SHOP_BASE_URL || process.env.URL || "https://tiny-doll-atelier.netlify.app").replace(/\/+$/, "");
}

function publicAssetUrl(value = "") {
  const src = String(value || "").trim();
  if (!src || /^(data|blob|file):/i.test(src)) {
    return src;
  }
  try {
    return new URL(src, `${shopBaseUrl()}/`).href;
  } catch {
    return src;
  }
}

function productPageUrl(productId = "", value = "") {
  const url = String(value || "").trim();
  if (url && !/^(data|blob|file):/i.test(url)) {
    try {
      return new URL(url, `${shopBaseUrl()}/`).href;
    } catch {
      // Valt terug op productId.
    }
  }
  return productId ? `${shopBaseUrl()}/?product=${encodeURIComponent(productId)}` : "";
}

function productFallback(data, item) {
  const products = Array.isArray(data.products) ? data.products : [];
  return (
    products.find((product) => product.id && product.id === item.productId) ||
    products.find((product) => String(product.name || "").toLowerCase() === String(item.name || item.productName || "").toLowerCase()) ||
    null
  );
}

function publicOrder(data, order) {
  const safeHistory = (order.statusHistory || []).filter((entry) =>
    ["created", "status", "payment", "paid", "shipping", "track"].includes(entry.type),
  );
  return {
    id: order.id,
    createdAt: order.createdAt,
    status: order.status || "Aanvraag ontvangen",
    paymentStatus: order.paymentStatus || "Wacht op bevestiging",
    paymentInstructionsSentAt: order.paymentInstructionsSentAt || "",
    paidAt: order.paidAt || "",
    trackTrace: order.trackTrace || "",
    trackTraceMailSentAt: order.trackTraceMailSentAt || "",
    shippingMethod: order.shippingMethod || "Wordt afgestemd",
    items: Array.isArray(order.items)
      ? order.items.map((item) => {
          const product = productFallback(data, item);
          const image = publicAssetUrl(item.imageUrl || item.image || product?.image || "");
          const productId = item.productId || product?.id || "";
          return {
            productId,
            productName: item.productName || item.name || product?.name || "",
            name: item.name || item.productName || product?.name || "",
            quantity: Number(item.quantity || 1),
            price: Number(item.price || 0),
            lineTotal: Number(item.lineTotal || Number(item.price || 0) * Number(item.quantity || 1)),
            imageUrl: image,
            image,
            productUrl: productPageUrl(productId, item.productUrl),
            imageAlt: item.imageAlt || item.name || item.productName || product?.name || "",
            category: item.category || "",
            popSize: item.popSize || product?.size || product?.badge || "",
            material: item.material || product?.material || "",
            deliveryTime: item.deliveryTime || product?.leadTime || "",
          };
        })
      : [],
    discountCode: order.discountCode || "",
    discountAmount: Number(order.discountAmount || 0),
    giftCardCode: order.giftCardCode || "",
    giftCardAmount: Number(order.giftCardAmount || 0),
    giftCardRemainingBalance: Number(order.giftCardRemainingBalance || 0),
    freeShipping: Boolean(order.freeShipping),
    total: Number(order.total || 0),
    notes: order.notes || "",
    statusHistory: safeHistory,
  };
}

function publicGiftCard(giftCard) {
  return {
    code: giftCard.code,
    recipient: giftCard.recipient || "",
    email: giftCard.email || "",
    initialValue: Number(giftCard.initialValue || 0),
    balance: Number(giftCard.balance || 0),
    expiresAt: giftCard.expiresAt || "",
    paymentStatus: giftCard.paymentStatus || "",
    active: giftCard.active !== false,
  };
}

function accountOrders(data, account) {
  const email = account.email.toLowerCase();
  return (Array.isArray(data.orders) ? data.orders : [])
    .filter((order) => order.accountId === account.id || String(order.customer?.email || "").toLowerCase() === email)
    .map((order) => publicOrder(data, order));
}

function accountGiftCards(data, account) {
  const email = account.email.toLowerCase();
  return (Array.isArray(data.giftCards) ? data.giftCards : [])
    .filter((giftCard) => String(giftCard.email || "").toLowerCase() === email)
    .map(publicGiftCard);
}

function getAccountFromSession(data, event) {
  const cookies = parseCookies(event.headers.cookie || event.headers.Cookie || "");
  const rawSession = cookies[COOKIE_NAME];
  if (!rawSession) {
    return { account: null, session: null };
  }

  const [sessionId, token] = rawSession.split(".");
  if (!sessionId || !token) {
    return { account: null, session: null };
  }

  const sessions = Array.isArray(data.accountSessions) ? data.accountSessions : [];
  const session = sessions.find(
    (item) =>
      item.id === sessionId &&
      item.tokenHash === hashToken(token) &&
      new Date(item.expiresAt).getTime() > Date.now(),
  );
  if (!session) {
    return { account: null, session: null };
  }

  const accounts = Array.isArray(data.accounts) ? data.accounts : [];
  return { account: accounts.find((item) => item.id === session.accountId) || null, session };
}

function requireAccount(data, event) {
  const result = getAccountFromSession(data, event);
  if (!result.account) {
    const error = new Error("Log eerst in om je account te bekijken.");
    error.statusCode = 401;
    throw error;
  }
  if (isRestrictedStatus(normalizedAccountStatus(result.account))) {
    const error = new Error("Je account is tijdelijk geblokkeerd. Neem contact op met Tiny Doll Atelier.");
    error.statusCode = 403;
    throw error;
  }
  return result.account;
}

function smtpClient({ host, port }) {
  const socket = tls.connect({ host, port, servername: host });
  socket.setEncoding("utf8");
  let buffer = "";
  const wait = () =>
    new Promise((resolve, reject) => {
      const onData = (chunk) => {
        buffer += chunk;
        const lines = buffer.split(/\r?\n/).filter(Boolean);
        const lastLine = lines[lines.length - 1] || "";
        if (/^\d{3} /.test(lastLine)) {
          socket.off("data", onData);
          socket.off("error", onError);
          const response = buffer;
          buffer = "";
          resolve({ code: Number(lastLine.slice(0, 3)), response });
        }
      };
      const onError = (error) => {
        socket.off("data", onData);
        reject(error);
      };
      socket.on("data", onData);
      socket.once("error", onError);
    });
  const command = async (line, expected = []) => {
    socket.write(`${line}\r\n`);
    const result = await wait();
    if (expected.length && !expected.includes(result.code)) {
      throw new Error("De mailprovider kon het bericht niet verzenden.");
    }
    return result;
  };
  return { wait, command, close: () => socket.end() };
}

function escapeMailHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
  );
}

function accountMailHtml({ title, intro, buttonText = "", buttonUrl = "", footer = "" }) {
  const paragraphs = String(intro || "")
    .split(/\n{2,}/)
    .map((part) => `<p>${escapeMailHtml(part).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const button = buttonUrl
    ? `<p style="margin:28px 0 10px"><a href="${escapeMailHtml(buttonUrl)}" style="display:inline-block;background:#6f4328;color:#fff;text-decoration:none;padding:13px 18px;border-radius:8px;font-weight:800">${escapeMailHtml(buttonText || "Openen")}</a></p>`
    : "";
  return `<!doctype html>
<html lang="nl">
  <body style="margin:0;background:#fbf6ef;color:#342216;font-family:Arial,sans-serif">
    <div style="padding:28px 14px">
      <div style="max-width:620px;margin:0 auto;background:#fffaf4;border:1px solid #dcc8b7;border-radius:10px;overflow:hidden">
        <div style="background:#6f4328;color:#fff;padding:22px 26px">
          <p style="margin:0 0 6px;font-size:13px;letter-spacing:.12em;text-transform:uppercase">Tiny Doll Atelier</p>
          <h1 style="margin:0;font-size:28px;line-height:1.15">${escapeMailHtml(title)}</h1>
        </div>
        <div style="padding:26px;line-height:1.65;font-size:16px">
          ${paragraphs}
          ${button}
          <p>Liefs,<br>Tiny Doll Atelier</p>
        </div>
        <div style="border-top:1px solid #dcc8b7;padding:16px 26px;color:#806a59;font-size:13px">
          ${escapeMailHtml(footer || "Je ontvangt deze mail van Tiny Doll Atelier.")}
        </div>
      </div>
    </div>
  </body>
</html>`;
}

function composeMail({ from, to, subject, text, html, replyTo }) {
  const boundary = `tiny-${randomToken(12)}`;
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
    `Reply-To: ${replyTo || from}`,
    "MIME-Version: 1.0",
  ];
  if (!html) {
    return `${headers.join("\r\n")}\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${text.replace(/\n/g, "\r\n")}`;
  }
  return `${headers.join("\r\n")}\r\nContent-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${text.replace(/\n/g, "\r\n")}\r\n\r\n--${boundary}\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${html}\r\n\r\n--${boundary}--`;
}

async function sendAccountMail({ to, subject, text, html }) {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.EMAIL_FROM || user;
  const adminEmail = process.env.ADMIN_EMAIL || from;
  if (!user || !pass || !from) {
    throw new Error("Gmail SMTP is nog niet compleet ingesteld.");
  }

  const client = smtpClient({ host, port });
  try {
    const greeting = await client.wait();
    if (greeting.code !== 220) {
      throw new Error("De mailprovider kon het bericht niet verzenden.");
    }
    await client.command("EHLO tiny-doll-atelier.netlify.app", [250]);
    await client.command(`AUTH PLAIN ${Buffer.from(`\u0000${user}\u0000${pass}`).toString("base64")}`, [235]);
    await client.command(`MAIL FROM:<${getEmailAddress(from)}>`, [250]);
    await client.command(`RCPT TO:<${to}>`, [250, 251]);
    await client.command("DATA", [354]);
    await client.command(`${composeMail({ from, to, subject, text, html, replyTo: adminEmail })}\r\n.`, [250]);
    await client.command("QUIT", [221]);
  } finally {
    client.close();
  }
}

function buildAccountResponse(data, account) {
  return {
    ok: true,
    account: publicAccount(account),
    orders: accountOrders(data, account),
    giftCards: accountGiftCards(data, account),
    paymentSettings: {
      holder: data.settings?.paymentHolder || "R Stavasius",
      iban: data.settings?.paymentIban || "NL25 RABO 0316 0597 49",
      description: data.settings?.paymentDescription || "ordernummer",
      extraText: data.settings?.paymentExtraText || "",
    },
  };
}

exports.handler = async (event) => {
  try {
    const { store, data } = await readData();
    data.accounts = Array.isArray(data.accounts) ? data.accounts : [];
    data.accountSessions = Array.isArray(data.accountSessions) ? data.accountSessions : [];
    const params = event.rawQuery
      ? new URLSearchParams(event.rawQuery)
      : new URLSearchParams(event.queryStringParameters || {});
    const action = params.get("action") || "me";

    if (event.httpMethod === "GET") {
      const account = requireAccount(data, event);
      if (action === "order") {
        const orderId = clean(params.get("id"), 100);
        const order = accountOrders(data, account).find((item) => item.id === orderId);
        if (!order) {
          return json(404, { ok: false, message: "Deze bestelling is niet gevonden bij jouw account." });
        }
        return json(200, { ok: true, order });
      }
      return json(200, buildAccountResponse(data, account));
    }

    if (event.httpMethod !== "POST") {
      return json(405, { ok: false, message: "Deze actie is niet toegestaan." });
    }

    const payload = JSON.parse(event.body || "{}");

    if (action === "validate-reset") {
      const tokenHash = hashToken(clean(payload.token, 500));
      const valid = data.accounts.some(
        (item) =>
          item.resetTokenHash === tokenHash &&
          item.resetExpiresAt &&
          new Date(item.resetExpiresAt).getTime() > Date.now() &&
          !item.resetUsedAt,
      );
      if (!valid) {
        return json(400, { ok: false, message: "Deze resetlink is ongeldig of verlopen." });
      }
      return json(200, { ok: true });
    }

    if (action === "register") {
      const email = clean(payload.email, 220).toLowerCase();
      const name = clean(payload.name, 160);
      const password = String(payload.password || "");
      if (!name || !isEmail(email) || password.length < 8) {
        return json(400, { ok: false, message: "Vul een naam, geldig e-mailadres en wachtwoord van minimaal 8 tekens in." });
      }
      if (data.accounts.some((account) => account.email === email)) {
        return json(409, { ok: false, message: "Er bestaat al een account met dit e-mailadres." });
      }
      const passwordData = hashPassword(password);
      const account = {
        id: `acc-${Date.now()}-${randomToken(5)}`,
        name,
        email,
        passwordHash: passwordData.hash,
        phone: clean(payload.phone, 80),
        address: clean(payload.address, 220),
        postalCode: clean(payload.postalCode, 40),
        city: clean(payload.city, 120),
        country: clean(payload.country, 120) || "Nederland",
        deliveryNote: clean(payload.deliveryNote, 1000),
        status: "Actief",
        accountSource: "register",
        createdAt: new Date().toISOString(),
      };
      data.accounts.unshift(account);
      const sessionId = `sess-${Date.now()}-${randomToken(5)}`;
      const token = randomToken();
      data.accountSessions = [
        {
          id: sessionId,
          accountId: account.id,
          tokenHash: hashToken(token),
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + SESSION_MAX_AGE * 1000).toISOString(),
        },
        ...data.accountSessions,
      ];
      await writeData(store, data);
      try {
        await sendAccountMail({
          to: account.email,
          subject: "Je account bij Tiny Doll Atelier",
          text:
            `Hallo ${account.name},\n\n` +
            "Je account is aangemaakt. Je kunt nu je aanvragen, betaalstatus en track & trace bekijken.\n\n" +
            "Gebruik hetzelfde e-mailadres als bij je aanvragen, zodat we je bestellingen automatisch aan je account kunnen koppelen.\n\n" +
            "Liefs,\nTiny Doll Atelier",
          html: accountMailHtml({
            title: "Welkom bij Tiny Doll Atelier",
            intro:
              `Hallo ${account.name},\n\n` +
              "Je account is aangemaakt. Je kunt vanaf nu je aanvragen, betaalstatus, cadeaubonnen en track & trace makkelijk terugvinden.\n\n" +
              "Gebruik hetzelfde e-mailadres als bij je aanvragen, zodat we je bestellingen automatisch aan je account kunnen koppelen.",
            buttonText: "Naar mijn account",
            buttonUrl: `${process.env.URL || "https://tiny-doll-atelier.netlify.app"}/account`,
            footer: "Je ontvangt deze mail omdat er een account is aangemaakt bij Tiny Doll Atelier.",
          }),
        });
      } catch {
        // Account aanmaken blijft leidend; een tijdelijke mailstoring mag registratie niet blokkeren.
      }
      return json(200, buildAccountResponse(data, account), { "Set-Cookie": sessionCookie(`${sessionId}.${token}`) });
    }

    if (action === "login") {
      const email = clean(payload.email, 220).toLowerCase();
      const account = data.accounts.find((item) => item.email === email);
      if (!account || !verifyPassword(String(payload.password || ""), account.passwordHash)) {
        if (account) {
          account.failedLoginAttempts = Number(account.failedLoginAttempts || 0) + 1;
          account.lastFailedLoginAt = new Date().toISOString();
          await writeData(store, data);
        }
        return json(401, { ok: false, message: "E-mailadres of wachtwoord klopt niet." });
      }
      const nextStatus = normalizedAccountStatus(account);
      if (isRestrictedStatus(nextStatus)) {
        return json(403, {
          ok: false,
          message: "Je account is tijdelijk geblokkeerd. Neem contact op met Tiny Doll Atelier.",
        });
      }
      account.status = nextStatus;
      account.lastLoginAt = new Date().toISOString();
      account.failedLoginAttempts = 0;
      account.history = [
        {
          at: account.lastLoginAt,
          actor: "klant",
          action: "klant ingelogd",
          description: "Klant is ingelogd.",
        },
        ...(Array.isArray(account.history) ? account.history : []),
      ].slice(0, 200);
      const sessionId = `sess-${Date.now()}-${randomToken(5)}`;
      const token = randomToken();
      data.accountSessions = [
        {
          id: sessionId,
          accountId: account.id,
          tokenHash: hashToken(token),
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + SESSION_MAX_AGE * 1000).toISOString(),
        },
        ...data.accountSessions.filter((item) => new Date(item.expiresAt).getTime() > Date.now()).slice(0, 80),
      ];
      await writeData(store, data);
      return json(200, buildAccountResponse(data, account), { "Set-Cookie": sessionCookie(`${sessionId}.${token}`) });
    }

    if (action === "logout") {
      const { session } = getAccountFromSession(data, event);
      if (session) {
        data.accountSessions = data.accountSessions.filter((item) => item.id !== session.id);
        await writeData(store, data);
      }
      return json(200, { ok: true }, { "Set-Cookie": clearSessionCookie() });
    }

    if (action === "update") {
      const current = requireAccount(data, event);
      data.accounts = data.accounts.map((account) =>
        account.id === current.id
          ? {
              ...account,
              name: clean(payload.name, 160) || account.name,
              phone: clean(payload.phone, 80),
              address: clean(payload.address, 220),
              postalCode: clean(payload.postalCode, 40),
              city: clean(payload.city, 120),
              country: clean(payload.country, 120) || "Nederland",
              deliveryNote: clean(payload.deliveryNote, 1000),
              history: [
                {
                  at: new Date().toISOString(),
                  actor: "klant",
                  action: "klantgegevens aangepast",
                  description: "Klant heeft eigen gegevens aangepast.",
                },
                ...(Array.isArray(account.history) ? account.history : []),
              ].slice(0, 200),
            }
          : account,
      );
      const updated = data.accounts.find((account) => account.id === current.id);
      await writeData(store, data);
      return json(200, buildAccountResponse(data, updated));
    }

    if (action === "change-password") {
      const current = requireAccount(data, event);
      const newPassword = String(payload.newPassword || "");
      if (!verifyPassword(String(payload.currentPassword || ""), current.passwordHash)) {
        return json(401, { ok: false, message: "Je huidige wachtwoord klopt niet." });
      }
      if (newPassword.length < 8) {
        return json(400, { ok: false, message: "Gebruik een nieuw wachtwoord van minimaal 8 tekens." });
      }
      const passwordData = hashPassword(newPassword);
      data.accounts = data.accounts.map((account) =>
        account.id === current.id ? { ...account, passwordHash: passwordData.hash } : account,
      );
      await writeData(store, data);
      return json(200, { ok: true, message: "Wachtwoord gewijzigd." });
    }

    if (action === "forgot-password") {
      const email = clean(payload.email, 220).toLowerCase();
      const account = data.accounts.find((item) => item.email === email);
      if (account) {
        const token = randomToken();
        account.resetTokenHash = hashToken(token);
        account.resetExpiresAt = new Date(Date.now() + RESET_MAX_AGE * 1000).toISOString();
        account.resetUsedAt = "";
        await writeData(store, data);
        const origin = `https://${event.headers.host || "tiny-doll-atelier.netlify.app"}`;
        const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(token)}`;
        await sendAccountMail({
          to: account.email,
          subject: "Wachtwoord resetten voor Tiny Doll Atelier",
          text:
            `Hallo ${account.name},\n\n` +
            `Met deze link kun je je wachtwoord opnieuw instellen:\n${resetUrl}\n\n` +
            "Deze link is 1 uur geldig en kan maar een keer gebruikt worden.\n\nLiefs,\nTiny Doll Atelier",
          html: accountMailHtml({
            title: "Wachtwoord opnieuw instellen",
            intro:
              `Hallo ${account.name},\n\n` +
              "We hebben een verzoek ontvangen om je wachtwoord opnieuw in te stellen.\n\n" +
              "Klik op de knop hieronder om een nieuw wachtwoord te kiezen.\n\n" +
              "Deze link is tijdelijk geldig. Heb je dit niet aangevraagd? Dan hoef je niets te doen.",
            buttonText: "Wachtwoord opnieuw instellen",
            buttonUrl: resetUrl,
            footer: "Deze mail bevat geen wachtwoord. De resetlink is tijdelijk geldig.",
          }),
        });
      }
      return json(200, { ok: true, message: "Als dit e-mailadres bekend is, sturen we een resetlink." });
    }

    if (action === "reset-password") {
      const tokenHash = hashToken(clean(payload.token, 500));
      const password = String(payload.password || "");
      const account = data.accounts.find(
        (item) =>
          item.resetTokenHash === tokenHash &&
          item.resetExpiresAt &&
          new Date(item.resetExpiresAt).getTime() > Date.now() &&
          !item.resetUsedAt,
      );
      if (!account) {
        return json(400, { ok: false, message: "Deze resetlink is verlopen of al gebruikt." });
      }
      if (password.length < 8) {
        return json(400, { ok: false, message: "Gebruik een wachtwoord van minimaal 8 tekens." });
      }
      account.passwordHash = hashPassword(password).hash;
      account.resetUsedAt = new Date().toISOString();
      account.resetTokenHash = "";
      account.resetExpiresAt = "";
      account.status = "Actief";
      data.accountSessions = data.accountSessions.filter((session) => session.accountId !== account.id);
      await writeData(store, data);
      return json(200, { ok: true, message: "Je wachtwoord is aangepast. Je kunt nu inloggen." });
    }

    if (action === "delete-request") {
      const account = requireAccount(data, event);
      await sendAccountMail({
        to: process.env.ADMIN_EMAIL || account.email,
        subject: `Account verwijderen aangevraagd door ${account.name}`,
        text:
          `Er is een verzoek om een klantaccount te verwijderen.\n\nNaam: ${account.name}\nE-mail: ${account.email}\nDatum: ${new Date().toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam" })}`,
      });
      return json(200, { ok: true, message: "Je verzoek is doorgestuurd. We nemen contact met je op." });
    }

    return json(400, { ok: false, message: "Onbekende accountactie." });
  } catch (error) {
    return json(error.statusCode || 500, {
      ok: false,
      message: error.message || "Accountactie is mislukt.",
    });
  }
};
