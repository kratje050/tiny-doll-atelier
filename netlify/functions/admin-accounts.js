const crypto = require("node:crypto");
const tls = require("node:tls");

const STORE_NAME = "tiny-doll-atelier";
const DATA_KEY = "site-data";
const ADMIN_COOKIE_NAME = "tiny_doll_admin_session";
const ADMIN_SESSION_MAX_AGE = 60 * 60 * 2;
const RESET_MAX_AGE = 60 * 60;
const ACCOUNT_STATUSES = [
  "Actief",
  "Nog niet bevestigd",
  "Geblokkeerd",
  "Verwijderd",
  "Geanonimiseerd",
  "Wachtwoordreset aangevraagd",
  "Verdacht / controleren",
];

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

function safeEquals(left = "", right = "") {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
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

function signAdminSession(value) {
  return crypto.createHmac("sha256", process.env.ADMIN_SESSION_SECRET || "").update(value).digest("hex");
}

function hasValidAdminSession(event) {
  if (!process.env.ADMIN_SESSION_SECRET) {
    return false;
  }
  const cookies = parseCookies(event.headers.cookie || event.headers.Cookie || "");
  const session = cookies[ADMIN_COOKIE_NAME];
  if (!session) {
    return false;
  }
  const [timestamp, signature] = session.split(".");
  if (!timestamp || !signature || !safeEquals(signAdminSession(timestamp), signature)) {
    return false;
  }
  const createdAt = Number(timestamp);
  return Number.isFinite(createdAt) && Date.now() - createdAt < ADMIN_SESSION_MAX_AGE * 1000;
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function hashToken(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function hashPassword(password, salt = randomToken(18)) {
  const hash = crypto.scryptSync(password, salt, 64).toString("base64");
  return `scrypt:${salt}:${hash}`;
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
  const data = (await store.get(DATA_KEY, { type: "json" })) || {};
  data.accounts = Array.isArray(data.accounts) ? data.accounts : [];
  data.orders = Array.isArray(data.orders) ? data.orders : [];
  data.giftCards = Array.isArray(data.giftCards) ? data.giftCards : [];
  data.accountSessions = Array.isArray(data.accountSessions) ? data.accountSessions : [];
  return { store, data };
}

async function writeData(store, data) {
  await store.setJSON(DATA_KEY, { ...data, updatedAt: new Date().toISOString() });
}

function now() {
  return new Date().toISOString();
}

function addHistory(account, action, description, actor = "admin", extra = {}) {
  const history = Array.isArray(account.history) ? account.history : [];
  return {
    ...account,
    history: [
      {
        at: now(),
        actor,
        action,
        description: clean(description, 500),
        ...extra,
      },
      ...history,
    ].slice(0, 200),
  };
}

function ordersForAccount(data, account) {
  const email = String(account.email || "").toLowerCase();
  return data.orders.filter(
    (order) => order.accountId === account.id || String(order.customer?.email || "").toLowerCase() === email,
  );
}

function giftCardsForAccount(data, account) {
  const email = String(account.email || "").toLowerCase();
  return data.giftCards.filter((giftCard) => String(giftCard.email || "").toLowerCase() === email);
}

function accountMetrics(data, account) {
  const orders = ordersForAccount(data, account);
  const openPayment = orders.some((order) =>
    ["Betaalinstructie verstuurd", "Wacht op betaling"].includes(order.paymentStatus || ""),
  );
  const totalSpent = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const openAmount = orders
    .filter((order) => ["Betaalinstructie verstuurd", "Wacht op betaling"].includes(order.paymentStatus || ""))
    .reduce((sum, order) => sum + Number(order.total || 0), 0);
  const latestOrder = orders
    .slice()
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0];
  const cancelled = orders.filter((order) => order.status === "Geannuleerd").length;
  const giftCards = giftCardsForAccount(data, account);

  return {
    orderCount: orders.length,
    totalSpent: Number(totalSpent.toFixed(2)),
    averageOrder: orders.length ? Number((totalSpent / orders.length).toFixed(2)) : 0,
    openAmount: Number(openAmount.toFixed(2)),
    latestOrderAt: latestOrder?.createdAt || "",
    latestOrderId: latestOrder?.id || "",
    openPayment,
    giftCardCount: giftCards.length,
    openOrders: orders.filter((order) => !["Verzonden", "Afgerond", "Geannuleerd"].includes(order.status)).length,
    cancelledOrders: cancelled,
  };
}

function accountLabels(data, account) {
  const metrics = accountMetrics(data, account);
  const labels = new Set(Array.isArray(account.labels) ? account.labels : []);
  if (!metrics.orderCount) labels.add("Nieuwe klant");
  if (metrics.orderCount > 1) labels.add("Terugkerende klant");
  if (metrics.orderCount >= 5) labels.add("Vaste klant");
  if (metrics.openPayment) labels.add("Wacht op betaling");
  if ((account.status || "Actief") === "Geblokkeerd") labels.add("Geblokkeerd");
  if (metrics.giftCardCount) labels.add("Cadeaubon klant");
  return [...labels];
}

function safeAccount(data, account) {
  const metrics = accountMetrics(data, account);
  return {
    id: account.id,
    status: account.status || "Actief",
    statusReason: account.statusReason || "",
    name: account.name || "",
    firstName: account.firstName || "",
    lastName: account.lastName || "",
    email: account.email || "",
    phone: account.phone || "",
    birthday: account.birthday || "",
    preferredContact: account.preferredContact || "e-mail",
    address: account.address || "",
    street: account.street || "",
    houseNumber: account.houseNumber || "",
    addition: account.addition || "",
    postalCode: account.postalCode || "",
    city: account.city || "",
    country: account.country || "Nederland",
    deliveryInstructions: account.deliveryInstructions || "",
    shippingAddress: account.shippingAddress || "",
    extraAddress: account.extraAddress || "",
    deliveryNote: account.deliveryNote || "",
    giftPreferences: account.giftPreferences || "",
    labels: accountLabels(data, account),
    notes: Array.isArray(account.notes) ? account.notes : [],
    history: Array.isArray(account.history) ? account.history : [],
    createdAt: account.createdAt || "",
    lastLoginAt: account.lastLoginAt || "",
    lastResetSentAt: account.lastResetSentAt || "",
    resetActive: Boolean(account.resetTokenHash && account.resetExpiresAt && new Date(account.resetExpiresAt).getTime() > Date.now() && !account.resetUsedAt),
    failedLoginAttempts: Number(account.failedLoginAttempts || 0),
    metrics,
  };
}

function safeOrder(order) {
  return {
    id: order.id,
    createdAt: order.createdAt,
    total: Number(order.total || 0),
    status: order.status || "",
    paymentStatus: order.paymentStatus || "",
    trackTrace: order.trackTrace || "",
    productNames: Array.isArray(order.items) ? order.items.map((item) => item.name).filter(Boolean).join(", ") : "",
    accountId: order.accountId || "",
  };
}

function findAccount(data, id) {
  const account = data.accounts.find((item) => item.id === id);
  if (!account) {
    const error = new Error("Klantaccount niet gevonden.");
    error.statusCode = 404;
    throw error;
  }
  return account;
}

function duplicateGroups(data) {
  const groups = [];
  const byEmail = new Map();
  const byPhone = new Map();
  data.accounts.forEach((account) => {
    if (account.email) byEmail.set(account.email.toLowerCase(), [...(byEmail.get(account.email.toLowerCase()) || []), account.id]);
    if (account.phone) byPhone.set(account.phone, [...(byPhone.get(account.phone) || []), account.id]);
  });
  [...byEmail.entries(), ...byPhone.entries()].forEach(([key, ids]) => {
    if (ids.length > 1) groups.push({ key, ids });
  });
  return groups;
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
    if (expected.length && !expected.includes(result.code)) throw new Error("De mailprovider kon het bericht niet verzenden.");
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
  return `<!doctype html><html lang="nl"><body style="margin:0;background:#fbf6ef;color:#342216;font-family:Arial,sans-serif"><div style="padding:28px 14px"><div style="max-width:620px;margin:0 auto;background:#fffaf4;border:1px solid #dcc8b7;border-radius:10px;overflow:hidden"><div style="background:#6f4328;color:#fff;padding:22px 26px"><p style="margin:0 0 6px;font-size:13px;letter-spacing:.12em;text-transform:uppercase">Tiny Doll Atelier</p><h1 style="margin:0;font-size:28px;line-height:1.15">${escapeMailHtml(title)}</h1></div><div style="padding:26px;line-height:1.65;font-size:16px">${paragraphs}${button}<p>Liefs,<br>Tiny Doll Atelier</p></div><div style="border-top:1px solid #dcc8b7;padding:16px 26px;color:#806a59;font-size:13px">${escapeMailHtml(footer || "Je ontvangt deze mail van Tiny Doll Atelier.")}</div></div></div></body></html>`;
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

async function sendMail({ to, subject, text, html }) {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.EMAIL_FROM || user;
  const adminEmail = process.env.ADMIN_EMAIL || from;
  if (!user || !pass || !from) throw new Error("Gmail SMTP is nog niet compleet ingesteld.");

  const client = smtpClient({ host, port });
  try {
    const greeting = await client.wait();
    if (greeting.code !== 220) throw new Error("De mailprovider kon het bericht niet verzenden.");
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

async function createReset(store, data, account, invite = false) {
  const token = randomToken();
  account.resetTokenHash = hashToken(token);
  account.resetExpiresAt = new Date(Date.now() + RESET_MAX_AGE * 1000).toISOString();
  account.resetUsedAt = "";
  account.lastResetSentAt = now();
  account.status = invite ? "Nog niet bevestigd" : "Wachtwoordreset aangevraagd";
  const origin = process.env.URL || "https://tiny-doll-atelier.netlify.app";
  const resetLink = `${origin}/reset-password?token=${encodeURIComponent(token)}`;
  await sendMail({
    to: account.email,
    subject: invite ? "Je account bij Tiny Doll Atelier" : "Wachtwoord opnieuw instellen voor Tiny Doll Atelier",
    text: invite
      ? `Hallo ${account.name},\n\nEr is een account voor je aangemaakt bij Tiny Doll Atelier. Via onderstaande link kun je zelf veilig een wachtwoord instellen.\n\n${resetLink}\n\nDeze link is tijdelijk geldig.\n\nLiefs,\nTiny Doll Atelier`
      : `Hallo ${account.name},\n\nVia onderstaande link kun je je wachtwoord opnieuw instellen.\n\n${resetLink}\n\nDeze link is tijdelijk geldig en kan maar een keer gebruikt worden. Heb je dit niet aangevraagd? Dan hoef je niets te doen.\n\nLiefs,\nTiny Doll Atelier`,
    html: accountMailHtml({
      title: invite ? "Je account bij Tiny Doll Atelier" : "Wachtwoord opnieuw instellen",
      intro: invite
        ? `Hallo ${account.name},\n\nEr is een account voor je aangemaakt bij Tiny Doll Atelier. Via je account kun je je aanvragen, betaalstatus, cadeaubonnen en track & trace bekijken.\n\nKlik op de knop hieronder om je account veilig in te stellen.\n\nGebruik hetzelfde e-mailadres als bij je aanvragen, zodat we je bestellingen automatisch aan je account kunnen koppelen.`
        : `Hallo ${account.name},\n\nWe hebben een verzoek ontvangen om je wachtwoord opnieuw in te stellen.\n\nKlik op de knop hieronder om een nieuw wachtwoord te kiezen.\n\nDeze link is tijdelijk geldig. Heb je dit niet aangevraagd? Dan hoef je niets te doen.`,
      buttonText: invite ? "Account instellen" : "Wachtwoord opnieuw instellen",
      buttonUrl: resetLink,
      footer: "Deze mail bevat geen wachtwoord en geen beheerinformatie.",
    }),
  });
  data.accounts = data.accounts.map((item) =>
    item.id === account.id
      ? addHistory(account, invite ? "uitnodiging verstuurd" : "wachtwoordreset verstuurd", "Veilige resetlink per e-mail verstuurd.")
      : item,
  );
  await writeData(store, data);
}

function accountPayload(input, existing = {}) {
  const email = clean(input.email, 220).toLowerCase();
  return {
    ...existing,
    name: clean(input.name, 160) || existing.name || "",
    firstName: clean(input.firstName, 120),
    lastName: clean(input.lastName, 120),
    email,
    phone: clean(input.phone, 80),
    birthday: clean(input.birthday, 40),
    preferredContact: clean(input.preferredContact, 80) || "e-mail",
    address: clean(input.address, 220),
    street: clean(input.street, 140),
    houseNumber: clean(input.houseNumber, 40),
    addition: clean(input.addition, 40),
    postalCode: clean(input.postalCode, 40),
    city: clean(input.city, 120),
    country: clean(input.country, 120) || "Nederland",
    deliveryInstructions: clean(input.deliveryInstructions, 500),
    shippingAddress: clean(input.shippingAddress, 300),
    extraAddress: clean(input.extraAddress, 300),
    deliveryNote: clean(input.deliveryNote, 500),
    giftPreferences: clean(input.giftPreferences, 500),
    status: ACCOUNT_STATUSES.includes(input.status) ? input.status : existing.status || "Actief",
    statusReason: clean(input.statusReason, 400),
    labels: Array.isArray(input.labels)
      ? input.labels.map((label) => clean(label, 60)).filter(Boolean).slice(0, 20)
      : String(input.labels || "")
          .split(",")
          .map((label) => clean(label, 60))
          .filter(Boolean)
          .slice(0, 20),
  };
}

exports.handler = async (event) => {
  try {
    if (!hasValidAdminSession(event)) return json(401, { ok: false, message: "Log opnieuw in bij beheer." });
    const { store, data } = await readData();
    const params = event.rawQuery
      ? new URLSearchParams(event.rawQuery)
      : new URLSearchParams(event.queryStringParameters || {});
    const action = params.get("action") || "list";

    if (event.httpMethod === "GET") {
      if (action === "export") {
        const account = findAccount(data, params.get("id"));
        return json(200, {
          ok: true,
          export: {
            account: safeAccount(data, account),
            orders: ordersForAccount(data, account).map(safeOrder),
            giftCards: giftCardsForAccount(data, account),
          },
        });
      }
      if (action === "backup") {
        return json(200, {
          ok: true,
          accountBackup: {
            exportedAt: now(),
            accounts: data.accounts.map((account) => safeAccount(data, account)),
            accountCount: data.accounts.length,
            note: "Deze export bevat geen wachtwoorden, password hashes, reset tokens, sessietokens of server secrets.",
          },
        });
      }
      if (action === "detail") {
        const account = findAccount(data, params.get("id"));
        const orders = ordersForAccount(data, account);
        const email = String(account.email || "").toLowerCase();
        const linkedIds = new Set(orders.map((order) => order.id));
        const suggestions = data.orders
          .filter((order) => String(order.customer?.email || "").toLowerCase() === email && !linkedIds.has(order.id))
          .map(safeOrder);
        return json(200, {
          ok: true,
          account: safeAccount(data, account),
          orders: orders.map(safeOrder),
          giftCards: giftCardsForAccount(data, account),
          suggestions,
        });
      }
      return json(200, {
        ok: true,
        accounts: data.accounts.map((account) => safeAccount(data, account)),
        duplicates: duplicateGroups(data),
        statuses: ACCOUNT_STATUSES,
      });
    }

    if (event.httpMethod !== "POST") return json(405, { ok: false, message: "Deze actie is niet toegestaan." });
    const payload = JSON.parse(event.body || "{}");

    if (action === "create") {
      const account = accountPayload(payload, {
        id: `acc-${Date.now()}-${randomToken(5)}`,
        createdAt: now(),
        passwordHash: hashPassword(randomToken(18)),
        notes: [],
        history: [],
      });
      if (!account.name || !isEmail(account.email)) return json(400, { ok: false, message: "Naam en geldig e-mailadres zijn verplicht." });
      if (data.accounts.some((item) => item.email === account.email)) return json(409, { ok: false, message: "Dit e-mailadres bestaat al." });
      data.accounts.unshift(addHistory(account, "account aangemaakt", "Account handmatig aangemaakt door admin."));
      await writeData(store, data);
      if (payload.sendInvite) {
        const created = data.accounts.find((item) => item.id === account.id);
        await createReset(store, data, created, true);
      }
      return json(200, { ok: true, account: safeAccount(data, account) });
    }

    const account = findAccount(data, payload.id || params.get("id"));

    if (action === "update") {
      const next = accountPayload(payload, account);
      if (!isEmail(next.email)) return json(400, { ok: false, message: "Vul een geldig e-mailadres in." });
      if (data.accounts.some((item) => item.id !== account.id && item.email === next.email)) {
        return json(409, { ok: false, message: "Dit e-mailadres hoort al bij een ander account." });
      }
      let updated = next;
      if (account.email !== next.email) {
        updated = addHistory(updated, "e-mailadres aangepast", "E-mailadres gewijzigd.", "admin", {
          from: account.email,
          to: next.email,
        });
      }
      if (account.status !== next.status) {
        updated = addHistory(updated, "status gewijzigd", `${account.status || "Actief"} naar ${next.status}. Reden: ${next.statusReason || "-"}`);
      }
      if (["Geblokkeerd", "Verwijderd", "Geanonimiseerd", "Verdacht / controleren"].includes(next.status)) {
        data.accountSessions = (data.accountSessions || []).filter((session) => session.accountId !== account.id);
      }
      data.accounts = data.accounts.map((item) =>
        item.id === account.id ? addHistory(updated, "klantgegevens aangepast", "Klantgegevens opgeslagen door admin.") : item,
      );
      await writeData(store, data);
      return json(200, { ok: true });
    }

    if (action === "send-reset" || action === "send-invite") {
      await createReset(store, data, account, action === "send-invite");
      return json(200, { ok: true, message: "Mail is verzonden." });
    }

    if (action === "invalidate-reset") {
      data.accounts = data.accounts.map((item) =>
        item.id === account.id
          ? addHistory({ ...item, resetTokenHash: "", resetExpiresAt: "", resetUsedAt: now() }, "resetlink ingetrokken", "Resetlink ongeldig gemaakt.")
          : item,
      );
      await writeData(store, data);
      return json(200, { ok: true });
    }

    if (action === "add-note") {
      const note = {
        id: `note-${Date.now()}`,
        title: clean(payload.title, 120),
        text: clean(payload.text, 1500),
        label: clean(payload.label, 80) || "Belangrijk",
        createdAt: now(),
        createdBy: "admin",
      };
      data.accounts = data.accounts.map((item) =>
        item.id === account.id
          ? addHistory({ ...item, notes: [note, ...(item.notes || [])] }, "notitie toegevoegd", `${note.label}: ${note.title || note.text}`)
          : item,
      );
      await writeData(store, data);
      return json(200, { ok: true });
    }

    if (action === "link-order" || action === "unlink-order") {
      const orderId = clean(payload.orderId, 100);
      if (!data.orders.some((order) => order.id === orderId)) {
        return json(404, { ok: false, message: "Bestelling niet gevonden." });
      }
      data.orders = data.orders.map((order) =>
        order.id === orderId ? { ...order, accountId: action === "link-order" ? account.id : "" } : order,
      );
      data.accounts = data.accounts.map((item) =>
        item.id === account.id
          ? addHistory(item, action === "link-order" ? "bestelling gekoppeld" : "bestelling ontkoppeld", orderId)
          : item,
      );
      await writeData(store, data);
      return json(200, { ok: true });
    }

    if (action === "link-suggestions") {
      const email = String(account.email || "").toLowerCase();
      const orderIds = data.orders
        .filter((order) => String(order.customer?.email || "").toLowerCase() === email && order.accountId !== account.id)
        .map((order) => order.id);
      data.orders = data.orders.map((order) => (orderIds.includes(order.id) ? { ...order, accountId: account.id } : order));
      data.accounts = data.accounts.map((item) =>
        item.id === account.id
          ? addHistory(item, "bestellingen gekoppeld", `${orderIds.length} bestelling(en) automatisch gekoppeld op e-mailadres.`)
          : item,
      );
      await writeData(store, data);
      return json(200, { ok: true, linked: orderIds.length });
    }

    if (action === "anonymize") {
      const anonymousEmail = `anoniem-${account.id}@example.invalid`;
      data.accountSessions = (data.accountSessions || []).filter((session) => session.accountId !== account.id);
      data.accounts = data.accounts.map((item) =>
        item.id === account.id
          ? addHistory(
              {
                ...item,
                name: "Geanonimiseerde klant",
                firstName: "",
                lastName: "",
                email: anonymousEmail,
                phone: "",
                address: "",
                street: "",
                houseNumber: "",
                addition: "",
                postalCode: "",
                city: "",
                deliveryInstructions: "",
                shippingAddress: "",
                extraAddress: "",
                deliveryNote: "",
                giftPreferences: "",
                status: "Geanonimiseerd",
              },
              "account geanonimiseerd",
              "Persoonsgegevens vervangen door veilige placeholders.",
            )
          : item,
      );
      await writeData(store, data);
      return json(200, { ok: true });
    }

    if (action === "send-mail") {
      const subject = clean(payload.subject, 180);
      const text = clean(payload.text, 4000);
      if (!subject || !text) return json(400, { ok: false, message: "Onderwerp en bericht zijn verplicht." });
      await sendMail({ to: account.email, subject, text });
      data.accounts = data.accounts.map((item) =>
        item.id === account.id ? addHistory(item, "klantmail verstuurd", subject) : item,
      );
      await writeData(store, data);
      return json(200, { ok: true });
    }

    return json(400, { ok: false, message: "Onbekende accountactie." });
  } catch (error) {
    return json(error.statusCode || 500, { ok: false, message: error.message || "Klantaccountactie is mislukt." });
  }
};
