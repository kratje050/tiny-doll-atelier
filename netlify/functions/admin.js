const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const COOKIE_NAME = "tiny_doll_admin_session";
const SESSION_MAX_AGE = 60 * 60 * 8;

function getSecret() {
  return process.env.ADMIN_SESSION_SECRET || "";
}

function isConfigured() {
  return Boolean(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD && process.env.ADMIN_SESSION_SECRET);
}

function normalizeEmail(value = "") {
  return String(value).trim().toLowerCase();
}

function safeEquals(left = "", right = "") {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function sign(value) {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("hex");
}

function createSessionCookie() {
  const value = String(Date.now());
  return `${value}.${sign(value)}`;
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
  const cookies = parseCookies(event.headers.cookie || event.headers.Cookie || "");
  const session = cookies[COOKIE_NAME];
  if (!session || !isConfigured()) {
    return false;
  }

  const [timestamp, signature] = session.split(".");
  if (!timestamp || !signature || !safeEquals(sign(timestamp), signature)) {
    return false;
  }

  const createdAt = Number(timestamp);
  return Number.isFinite(createdAt) && Date.now() - createdAt < SESSION_MAX_AGE * 1000;
}

function redirect(location, cookies = []) {
  return {
    statusCode: 303,
    headers: {
      Location: location,
      "Set-Cookie": cookies,
    },
    body: "",
  };
}

function htmlResponse(body, statusCode = 200, headers = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Frame-Options": "DENY",
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "same-origin",
      ...headers,
    },
    body,
  };
}

function loginPage(error = "") {
  const configWarning = isConfigured()
    ? ""
    : '<p class="login-error">De beheerlogin is nog niet volledig ingesteld in Netlify.</p>';
  return `<!doctype html>
<html lang="nl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex,nofollow" />
    <title>Beheer login - Tiny Doll Atelier</title>
    <link rel="stylesheet" href="/admin.css" />
  </head>
  <body class="admin-locked">
    <section class="login-screen" aria-labelledby="login-title">
      <form class="login-card" method="post" action="/admin">
        <span class="login-mark">T</span>
        <p class="eyebrow">Beveiligd beheer</p>
        <h1 id="login-title">Tiny Doll Atelier</h1>
        <p>Log in om producten, bestellingen, klanten en cadeaubonnen te beheren.</p>
        <label>
          E-mail
          <input name="email" type="email" autocomplete="username" required autofocus />
        </label>
        <label>
          Wachtwoord
          <input name="password" type="password" autocomplete="current-password" required />
        </label>
        ${configWarning}
        ${error ? `<p class="login-error">${error}</p>` : '<p class="login-error"></p>'}
        <button class="primary-button" type="submit">Inloggen</button>
      </form>
    </section>
  </body>
</html>`;
}

function readAdminHtml() {
  const candidates = [
    path.join(process.cwd(), "admin.html"),
    path.join(__dirname, "..", "..", "admin.html"),
    path.join(__dirname, "admin.html"),
  ];
  const adminPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!adminPath) {
    return loginPage("Beheerpagina kon niet worden geladen.");
  }

  return fs.readFileSync(adminPath, "utf8");
}

exports.handler = async (event) => {
  if (event.path.endsWith("/logout")) {
    return redirect("/admin", [
      `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
    ]);
  }

  if (event.httpMethod === "POST") {
    const params = new URLSearchParams(event.body || "");
    const email = normalizeEmail(params.get("email"));
    const password = params.get("password") || "";
    const emailMatches = safeEquals(email, normalizeEmail(process.env.ADMIN_EMAIL));
    const passwordMatches = safeEquals(password, process.env.ADMIN_PASSWORD);

    if (isConfigured() && emailMatches && passwordMatches) {
      const session = createSessionCookie();
      return redirect("/admin", [
        `${COOKIE_NAME}=${encodeURIComponent(
          session,
        )}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE}`,
      ]);
    }

    return htmlResponse(loginPage("E-mail of wachtwoord klopt niet."), 401);
  }

  if (!hasValidSession(event)) {
    return htmlResponse(loginPage());
  }

  return htmlResponse(readAdminHtml());
};
