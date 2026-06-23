const state = {
  account: null,
  orders: [],
  giftCards: [],
  paymentSettings: {},
  resetTokenChecked: false,
  resetTokenValid: false,
};

const messageBox = document.querySelector("[data-account-message]");
const authForms = document.querySelector("[data-auth-forms]");
const loginForm = document.querySelector("[data-login-form]");
const registerForm = document.querySelector("[data-register-form]");
const dashboard = document.querySelector("[data-account-dashboard]");
const forgotPanel = document.querySelector("[data-forgot-panel]");
const resetPanel = document.querySelector("[data-reset-panel]");
const resetInvalidPanel = document.querySelector("[data-reset-invalid-panel]");
const logoutButton = document.querySelector("[data-logout]");
const accountOnlyViews = ["overview", "orders", "details", "order"];

function money(value) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(Number(value || 0));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
  );
}

function showMessage(text, isError = false) {
  messageBox.textContent = text;
  messageBox.hidden = !text;
  messageBox.classList.toggle("is-error", isError);
}

async function accountRequest(action, payload = null, method = "POST") {
  const response = await fetch(`/.netlify/functions/account?action=${encodeURIComponent(action)}`, {
    method,
    credentials: "same-origin",
    headers: payload ? { "Content-Type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const data = await response.json().catch(() => ({ message: "Accountactie is mislukt." }));
  if (!response.ok || !data.ok) {
    throw new Error(data.message || "Accountactie is mislukt.");
  }
  return data;
}

function setData(data) {
  state.account = data.account || null;
  state.orders = data.orders || [];
  state.giftCards = data.giftCards || [];
  state.paymentSettings = data.paymentSettings || {};
}

function currentView() {
  const path = window.location.pathname;
  if (path.startsWith("/account/order/")) return "order";
  if (path.startsWith("/account/orders")) return "orders";
  if (path.startsWith("/account/details")) return "details";
  if (path.startsWith("/forgot-password")) return "forgot";
  if (path.startsWith("/reset-password-expired")) return "expired";
  if (path.startsWith("/reset-password")) return "reset";
  if (path.startsWith("/register")) return "register";
  if (path.startsWith("/login")) return "login";
  return "overview";
}

function currentResetToken() {
  return new URLSearchParams(window.location.search).get("token") || "";
}

function authMode() {
  const view = currentView();
  if (view === "login") return "login";
  if (view === "forgot") return "forgot";
  if (view === "reset") return "reset";
  if (view === "expired") return "expired";
  return "register";
}

function orderStatusText(order) {
  if (order.status === "Nieuw") return "Aanvraag ontvangen";
  return order.status || "Aanvraag ontvangen";
}

function paymentText(order) {
  return order.paymentStatus || "Wacht op bevestiging";
}

function renderShell() {
  const view = currentView();
  const mode = authMode();
  const authView = !state.account && ["login", "register"].includes(view);
  const forgotView = view === "forgot";
  const resetView = view === "reset";
  const expiredView = view === "expired";
  const accountView = Boolean(state.account);

  authForms.hidden = !authView;
  loginForm.hidden = mode !== "login" || Boolean(state.account);
  registerForm.hidden = mode !== "register" || Boolean(state.account);
  forgotPanel.hidden = !forgotView || Boolean(state.account);
  resetPanel.hidden = !resetView || Boolean(state.account) || !state.resetTokenValid;
  resetInvalidPanel.hidden =
    (!resetView && !expiredView) || Boolean(state.account) || (resetView && state.resetTokenValid) || (resetView && !state.resetTokenChecked);
  dashboard.hidden = !accountView;
  logoutButton.hidden = !state.account;

  const pageTitle = document.querySelector("[data-page-title]");
  const pageIntro = document.querySelector("[data-page-intro]");
  if (state.account) {
    pageTitle.textContent = `Welkom, ${state.account.name}`;
    pageIntro.textContent = "Bekijk je aanvragen, betaalstatus en verzending.";
  } else if (mode === "login") {
    pageTitle.textContent = "Inloggen";
    pageIntro.textContent = "Bekijk je aanvragen, betaalstatus en track & trace.";
  } else if (mode === "forgot") {
    pageTitle.textContent = "Wachtwoord resetten";
    pageIntro.textContent = "Vraag een tijdelijke resetlink aan voor je account.";
  } else if (mode === "reset") {
    pageTitle.textContent = "Nieuw wachtwoord kiezen";
    pageIntro.textContent = state.resetTokenValid
      ? "Stel hieronder veilig een nieuw wachtwoord in."
      : "We controleren eerst of deze resetlink nog geldig is.";
  } else if (mode === "expired") {
    pageTitle.textContent = "Resetlink verlopen";
    pageIntro.textContent = "Vraag een nieuwe tijdelijke resetlink aan.";
  } else {
    pageTitle.textContent = "Account aanmaken";
    pageIntro.textContent = "Maak een account aan om je aanvragen, bestellingen en cadeaubonnen later makkelijk terug te vinden.";
  }
  document.body.classList.remove("account-loading");

  if (state.account) {
    renderDashboard();
  }
}

function goToAuth(path) {
  showMessage("");
  state.resetTokenChecked = false;
  state.resetTokenValid = false;
  history.pushState(null, "", path);
  renderRoute();
}

async function validateResetRoute() {
  if (currentView() !== "reset") {
    state.resetTokenChecked = false;
    state.resetTokenValid = false;
    return;
  }
  const token = currentResetToken();
  state.resetTokenValid = false;
  state.resetTokenChecked = true;
  if (!token) {
    history.replaceState(null, "", "/forgot-password");
    showMessage("Vraag een nieuwe resetlink aan om je wachtwoord te wijzigen.", true);
    return;
  }
  try {
    await accountRequest("validate-reset", { token });
    state.resetTokenValid = true;
    showMessage("");
  } catch {
    state.resetTokenValid = false;
    history.replaceState(null, "", "/reset-password-expired");
    showMessage("Deze resetlink is ongeldig of verlopen. Vraag een nieuwe resetlink aan.", true);
  }
}

async function renderRoute() {
  const view = currentView();
  if (!state.account && accountOnlyViews.includes(view)) {
    history.replaceState(null, "", "/login");
    showMessage("");
  }
  if (state.account && ["login", "register", "forgot", "reset", "expired"].includes(currentView())) {
    history.replaceState(null, "", "/account");
  }
  if (!state.account && currentView() === "reset") {
    await validateResetRoute();
  }
  renderShell();
}

function showAccountView(name) {
  ["overview", "orders", "order-detail", "details"].forEach((view) => {
    const element = document.querySelector(`[data-${view}-view]`);
    if (element) element.hidden = view !== name;
  });
  document.querySelectorAll(".account-sidebar a").forEach((link) => {
    link.classList.toggle("is-active", link.getAttribute("href") === window.location.pathname);
  });
}

function renderDashboard() {
  const openOrders = state.orders.filter((order) => !["Verzonden", "Afgerond", "Geannuleerd"].includes(order.status));
  document.querySelector("[data-open-orders]").textContent = openOrders.length;
  document.querySelector("[data-payment-orders]").textContent = state.orders.filter((order) =>
    ["Betaalinstructie verstuurd", "Wacht op betaling"].includes(paymentText(order)),
  ).length;
  document.querySelector("[data-production-orders]").textContent = state.orders.filter((order) => order.status === "In productie").length;
  document.querySelector("[data-gift-card-count]").textContent = state.giftCards.length;
  document.querySelector("[data-welcome-title]").textContent = `Welkom, ${state.account.name}`;

  renderOrders();
  renderDetails();

  const latest = state.orders[0];
  document.querySelector("[data-latest-order]").innerHTML = latest
    ? `${renderOrderCard(latest)}${renderGiftCards()}`
    : `<p class="muted">Je hebt nog geen aanvragen geplaatst. Bekijk de collectie en voeg je favoriete setje toe aan je aanvraag.</p><a class="primary-action" href="/#collectie">Bekijk collectie</a>${renderGiftCards()}`;

  const view = currentView();
  if (view === "orders") {
    showAccountView("orders");
  } else if (view === "details") {
    showAccountView("details");
  } else if (view === "order") {
    renderOrderDetail(decodeURIComponent(window.location.pathname.split("/").pop() || ""));
    showAccountView("order-detail");
  } else {
    showAccountView("overview");
  }
}

function renderOrderCard(order) {
  return `
    <article class="account-order-card">
      <div>
        <strong>${escapeHtml(order.id)}</strong>
        <span class="muted">${new Date(order.createdAt).toLocaleDateString("nl-NL")} - ${money(order.total)}</span>
        <div class="status-badges">
          <span>${escapeHtml(orderStatusText(order))}</span>
          <span>${escapeHtml(paymentText(order))}</span>
          ${order.trackTrace ? `<span>Track & trace beschikbaar</span>` : ""}
        </div>
      </div>
      <a class="secondary-action" href="/account/order/${encodeURIComponent(order.id)}">Bekijk</a>
    </article>
  `;
}

function renderOrders() {
  document.querySelector("[data-account-orders]").innerHTML = state.orders.length
    ? state.orders.map(renderOrderCard).join("")
    : '<p class="muted">Je hebt nog geen aanvragen geplaatst. Bekijk de collectie en voeg je favoriete setje toe aan je aanvraag.</p><a class="primary-action" href="/#collectie">Bekijk collectie</a>';
}

function renderGiftCards() {
  if (!state.giftCards.length) {
    return "";
  }
  return `
    <div class="account-detail-card" id="cadeaubonnen">
      <h3>Cadeaubonnen</h3>
      <div class="detail-list">
        ${state.giftCards
          .map(
            (giftCard) => `
              <div>
                <dt>${escapeHtml(giftCard.code)}</dt>
                <dd>${money(giftCard.balance)} saldo - ${escapeHtml(giftCard.paymentStatus || "Actief")}</dd>
              </div>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderOrderDetail(orderId) {
  const order = state.orders.find((item) => item.id === orderId);
  const holder = state.paymentSettings.holder || "R Stavasius";
  const iban = state.paymentSettings.iban || "NL25 RABO 0316 0597 49";
  const detail = document.querySelector("[data-account-order-detail]");
  if (!order) {
    detail.innerHTML = '<h2>Bestelling niet gevonden</h2><p class="muted">Deze bestelling hoort niet bij je account.</p>';
    return;
  }

  const paymentInstruction = order.paymentInstructionsSentAt
    ? `
      <div class="payment-box">
        <h3>Betaalinstructie</h3>
        <p>Je kunt het totaalbedrag overmaken naar:</p>
        <dl class="detail-list">
          <div><dt>Rekeninghouder</dt><dd>${escapeHtml(holder)}</dd></div>
          <div><dt>IBAN</dt><dd>${escapeHtml(iban)}</dd></div>
          <div><dt>Omschrijving</dt><dd>${escapeHtml(order.id)}</dd></div>
        </dl>
        <p>Let op: vermeld altijd het ordernummer als omschrijving, zodat we je betaling goed kunnen koppelen aan je aanvraag.</p>
      </div>
    `
    : '<p class="muted">Betaalinformatie volgt per e-mail na persoonlijke bevestiging.</p>';

  const statusMessage =
    paymentText(order) === "Wacht op betaling"
      ? "Je betaling is nog niet ontvangen. Gebruik het ordernummer als omschrijving bij je betaling."
      : paymentText(order) === "Betaald"
        ? "Je betaling is ontvangen. We gaan met je bestelling aan de slag."
        : order.status === "Verzonden"
          ? "Je bestelling is verzonden. Hieronder vind je de track & trace code."
          : "We houden je aanvraag persoonlijk bij en werken de status bij zodra er nieuws is.";

  detail.innerHTML = `
    <a href="/account/orders" class="secondary-action">Terug naar bestellingen</a>
    <h2>${escapeHtml(order.id)}</h2>
    <p class="muted">${new Date(order.createdAt).toLocaleString("nl-NL")}</p>
    <div class="status-badges">
      <span>${escapeHtml(orderStatusText(order))}</span>
      <span>${escapeHtml(paymentText(order))}</span>
    </div>
    <p>${escapeHtml(statusMessage)}</p>
    <div class="account-lines">
      ${order.items
        .map(
          (item) => `
            <div class="account-line">
              ${item.image ? `<img src="${escapeHtml(item.image)}" alt="">` : "<span></span>"}
              <div><strong>${escapeHtml(item.name)}</strong><span class="muted">${item.quantity} x ${money(item.price)}</span></div>
              <strong>${money(item.price * item.quantity)}</strong>
            </div>
          `,
        )
        .join("")}
    </div>
    <dl class="detail-list account-detail-card">
      <div><dt>Totaalbedrag</dt><dd>${money(order.total)}</dd></div>
      <div><dt>Verzendkosten</dt><dd>${order.freeShipping ? "Gratis via kortingscode" : "Wordt afgestemd"}</dd></div>
      <div><dt>Cadeaubon</dt><dd>${order.giftCardCode ? `${escapeHtml(order.giftCardCode)} (-${money(order.giftCardAmount)})` : "-"}</dd></div>
      <div><dt>Track & trace</dt><dd>${order.trackTrace || "-"}</dd></div>
      <div><dt>Verwachte levertijd</dt><dd>Wordt persoonlijk afgestemd na bevestiging.</dd></div>
      <div><dt>Opmerking</dt><dd>${escapeHtml(order.notes || "-")}</dd></div>
    </dl>
    ${paymentInstruction}
    <a class="primary-action" href="/#contact">Contact over deze bestelling</a>
  `;
}

function renderDetails() {
  const form = document.querySelector("[data-details-form]");
  if (!state.account || !form) return;
  ["name", "email", "phone", "address", "postalCode", "city", "country"].forEach((key) => {
    if (form.elements[key]) form.elements[key].value = state.account[key] || "";
  });
}

async function loadAccount() {
  try {
    const data = await accountRequest("me", null, "GET");
    setData(data);
  } catch {
    state.account = null;
  }
  await renderRoute();
}

document.querySelector("[data-login-form]").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const data = await accountRequest("login", Object.fromEntries(new FormData(event.currentTarget)));
    setData(data);
    showMessage("Je bent ingelogd.");
    history.replaceState(null, "", "/account");
    renderRoute();
  } catch (error) {
    showMessage(error.message, true);
  }
});

document.querySelector("[data-register-form]").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const data = await accountRequest("register", Object.fromEntries(new FormData(event.currentTarget)));
    setData(data);
    showMessage("Je account is aangemaakt. Je kunt nu je aanvragen en bestellingen bekijken.");
    history.replaceState(null, "", "/account");
    renderRoute();
  } catch (error) {
    showMessage(error.message, true);
  }
});

document.querySelector("[data-forgot-form]").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const data = await accountRequest("forgot-password", Object.fromEntries(new FormData(event.currentTarget)));
    showMessage(data.message || "Controleer je e-mail.");
  } catch (error) {
    showMessage(error.message, true);
  }
});

document.querySelector("[data-reset-form]").addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(event.currentTarget));
  if (payload.password !== payload.passwordConfirm) {
    showMessage("De twee wachtwoorden zijn niet hetzelfde.", true);
    return;
  }
  payload.token = currentResetToken();
  delete payload.passwordConfirm;
  try {
    const data = await accountRequest("reset-password", payload);
    showMessage(data.message || "Je wachtwoord is aangepast.");
    history.replaceState(null, "", "/login");
    renderRoute();
  } catch (error) {
    showMessage(error.message, true);
  }
});

document.querySelector("[data-details-form]").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const data = await accountRequest("update", Object.fromEntries(new FormData(event.currentTarget)));
    setData(data);
    showMessage("Je gegevens zijn opgeslagen.");
    renderRoute();
  } catch (error) {
    showMessage(error.message, true);
  }
});

document.querySelector("[data-password-form]").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const data = await accountRequest("change-password", Object.fromEntries(new FormData(event.currentTarget)));
    event.currentTarget.reset();
    showMessage(data.message || "Wachtwoord gewijzigd.");
  } catch (error) {
    showMessage(error.message, true);
  }
});

document.querySelector("[data-delete-request]").addEventListener("click", async () => {
  if (!confirm("Wil je een verzoek sturen om je account te laten verwijderen?")) return;
  try {
    const data = await accountRequest("delete-request", {});
    showMessage(data.message || "Verzoek verzonden.");
  } catch (error) {
    showMessage(error.message, true);
  }
});

logoutButton.addEventListener("click", async () => {
  await accountRequest("logout", {});
  state.account = null;
  state.orders = [];
  state.giftCards = [];
  showMessage("Je bent uitgelogd.");
  history.replaceState(null, "", "/login");
  renderRoute();
});

document.addEventListener("click", (event) => {
  const link = event.target.closest("[data-auth-link]");
  if (!link) {
    return;
  }
  event.preventDefault();
  goToAuth(link.dataset.authLink);
});

window.addEventListener("popstate", () => {
  renderRoute();
});

loadAccount();
