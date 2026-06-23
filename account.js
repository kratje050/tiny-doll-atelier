const state = {
  account: null,
  orders: [],
  giftCards: [],
  paymentSettings: {},
  resetTokenChecked: false,
  resetTokenValid: false,
};

const routeRoot = document.querySelector("[data-route-root]");
const messageBox = document.querySelector("[data-account-message]");
const logoutButton = document.querySelector("[data-logout]");
const accountOnlyViews = ["overview", "orders", "details", "giftcards", "contact", "order"];
const authViews = ["login", "register", "forgot", "reset", "expired"];

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
  if (path.startsWith("/account/giftcards")) return "giftcards";
  if (path.startsWith("/account/contact")) return "contact";
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

function safeReturnTo() {
  const returnTo = new URLSearchParams(window.location.search).get("returnTo") || "";
  if (!returnTo.startsWith("/") || returnTo.startsWith("//") || returnTo.startsWith("/admin")) {
    return "";
  }
  return returnTo;
}

function setTitle(view) {
  const pageTitle = document.querySelector("[data-page-title]");
  const pageIntro = document.querySelector("[data-page-intro]");
  const titles = {
    login: ["Inloggen", "Log in om je aanvragen en betaalstatus terug te vinden."],
    register: ["Account aanmaken", "Maak een account aan om je aanvragen later makkelijk terug te vinden."],
    forgot: ["Wachtwoord resetten", "Vul je e-mailadres in. Als het bekend is, sturen we een tijdelijke resetlink."],
    reset: ["Nieuw wachtwoord kiezen", "Stel veilig een nieuw wachtwoord in."],
    expired: ["Resetlink verlopen", "Vraag een nieuwe tijdelijke resetlink aan."],
    account: ["Mijn account", "Bekijk je aanvragen, betaalstatus en verzending."],
  };
  const [title, intro] = titles[view] || titles.account;
  pageTitle.textContent = title;
  pageIntro.textContent = intro;
  document.title = `${title} - Tiny Doll Atelier`;
}

function authCard(content) {
  return `<section class="auth-page"><div class="account-panel auth-card">${content}</div></section>`;
}

function loginTemplate() {
  return authCard(`
    <form data-login-form>
      <h2>Inloggen</h2>
      <p class="muted">Log in om je aanvragen, bestellingen en cadeaubonnen terug te vinden.</p>
      <label>E-mail <input name="email" type="email" autocomplete="email" required /></label>
      <label>Wachtwoord <input name="password" type="password" autocomplete="current-password" required /></label>
      <button class="primary-action" type="submit">Inloggen</button>
      <p class="auth-switch">Nog geen account? <button type="button" data-auth-link="/register">Maak hier een account aan</button></p>
      <p class="auth-switch"><button type="button" data-auth-link="/forgot-password">Wachtwoord vergeten?</button></p>
    </form>
  `);
}

function registerTemplate() {
  return authCard(`
    <form data-register-form>
      <h2>Account aanmaken</h2>
      <p class="muted">Maak een account aan om je aanvragen, bestellingen en cadeaubonnen later makkelijk terug te vinden.</p>
      <label>Naam <input name="name" autocomplete="name" required /></label>
      <label>E-mail <input name="email" type="email" autocomplete="email" required /></label>
      <label>Wachtwoord <input name="password" type="password" autocomplete="new-password" minlength="8" required /></label>
      <p class="muted">Gebruik hetzelfde e-mailadres als je eerdere aanvragen. Dan worden die automatisch aan je account gekoppeld.</p>
      <button class="primary-action" type="submit">Account aanmaken</button>
      <p class="auth-switch">Heb je al een account? <button type="button" data-auth-link="/login">Log dan hier in</button></p>
    </form>
  `);
}

function forgotTemplate() {
  return authCard(`
    <form data-forgot-form>
      <h2>Wachtwoord resetten</h2>
      <p class="muted">Vul je e-mailadres in. Als het bekend is, sturen we een tijdelijke resetlink.</p>
      <label>E-mail <input name="email" type="email" autocomplete="email" required /></label>
      <button class="primary-action" type="submit">Resetlink aanvragen</button>
      <p class="auth-switch"><button type="button" data-auth-link="/login">Terug naar inloggen</button></p>
    </form>
  `);
}

function resetTemplate() {
  return authCard(`
    <form data-reset-form>
      <h2>Nieuw wachtwoord kiezen</h2>
      <p class="muted">Kies een nieuw wachtwoord voor je Tiny Doll Atelier account.</p>
      <label>Nieuw wachtwoord <input name="password" type="password" autocomplete="new-password" minlength="8" required /></label>
      <label>Herhaal nieuw wachtwoord <input name="passwordConfirm" type="password" autocomplete="new-password" minlength="8" required /></label>
      <button class="primary-action" type="submit">Wachtwoord opslaan</button>
    </form>
  `);
}

function expiredTemplate() {
  return authCard(`
    <h2>Resetlink verlopen</h2>
    <p class="muted">Deze resetlink is ongeldig of verlopen. Vraag een nieuwe resetlink aan.</p>
    <button class="primary-action" type="button" data-auth-link="/forgot-password">Nieuwe resetlink aanvragen</button>
  `);
}

function dashboardTemplate() {
  return `
    <section class="account-dashboard" data-account-dashboard>
      <div class="account-cards">
        <article>
          <span>Openstaande aanvragen</span>
          <strong data-open-orders>0</strong>
        </article>
        <article>
          <span>Wacht op betaling</span>
          <strong data-payment-orders>0</strong>
        </article>
        <article>
          <span>In productie</span>
          <strong data-production-orders>0</strong>
        </article>
        <article>
          <span>Cadeaubonnen</span>
          <strong data-gift-card-count>0</strong>
        </article>
      </div>

      <div class="account-layout">
        <aside class="account-sidebar">
          <a href="/account">Overzicht</a>
          <a href="/account/orders">Mijn bestellingen</a>
          <a href="/account/details">Mijn gegevens</a>
          <a href="/account/giftcards">Mijn cadeaubonnen</a>
          <a href="/account/contact">Contact</a>
        </aside>

        <div class="account-content">
          <section class="account-panel" data-overview-view>
            <h2 data-welcome-title>Welkom</h2>
            <p class="muted">Hier zie je je aanvragen, betaalstatus en verzending.</p>
            <div data-latest-order></div>
          </section>

          <section class="account-panel" data-orders-view hidden>
            <h2>Mijn bestellingen</h2>
            <div class="order-list" data-account-orders></div>
          </section>

          <section class="account-panel" data-order-detail-view hidden>
            <div data-account-order-detail></div>
          </section>

          <section class="account-panel" data-details-view hidden>
            <form data-details-form>
              <h2>Mijn gegevens</h2>
              <div class="account-form-grid">
                <label>Naam <input name="name" autocomplete="name" required /></label>
                <label>E-mail <input name="email" type="email" disabled /></label>
                <label>Telefoon <input name="phone" autocomplete="tel" /></label>
                <label>Adres <input name="address" autocomplete="street-address" /></label>
                <label>Postcode <input name="postalCode" autocomplete="postal-code" /></label>
                <label>Plaats <input name="city" autocomplete="address-level2" /></label>
                <label>Land <input name="country" autocomplete="country-name" /></label>
                <label class="account-form-wide">Aflevernotitie <textarea name="deliveryNote" rows="3" placeholder="Bijv. neerzetten bij de voordeur of graag na 18:00 bezorgen"></textarea></label>
              </div>
              <button class="primary-action" type="submit">Gegevens opslaan</button>
            </form>
            <form class="password-form" data-password-form>
              <h3>Wachtwoord wijzigen</h3>
              <label>Huidig wachtwoord <input name="currentPassword" type="password" autocomplete="current-password" required /></label>
              <label>Nieuw wachtwoord <input name="newPassword" type="password" autocomplete="new-password" minlength="8" required /></label>
              <button class="secondary-action" type="submit">Wachtwoord wijzigen</button>
            </form>
            <button class="link-button" type="button" data-delete-request>Account verwijderen aanvragen</button>
            <p class="muted">Je gegevens zijn alleen zichtbaar voor jou en Tiny Doll Atelier. Bestellingen worden gekoppeld op je e-mailadres.</p>
          </section>

          <section class="account-panel" data-giftcards-view hidden>
            <h2>Mijn cadeaubonnen</h2>
            <div data-account-giftcards></div>
          </section>

          <section class="account-panel" data-contact-view hidden>
            <h2>Contact</h2>
            <p class="muted">Heb je een vraag over een aanvraag, betaling, cadeaubon of verzending? Neem gerust contact op.</p>
            <a class="primary-action" href="/#contact">Contactformulier openen</a>
            <a class="secondary-action" href="/account/orders">Vraag over bestelling bekijken</a>
          </section>
        </div>
      </div>
    </section>
  `;
}

function orderStatusText(order) {
  if (order.status === "Nieuw") return "Aanvraag ontvangen";
  return order.status || "Aanvraag ontvangen";
}

function paymentText(order) {
  return order.paymentStatus || "Wacht op bevestiging";
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
  let view = currentView();
  if (!state.account && accountOnlyViews.includes(view)) {
    history.replaceState(null, "", "/login");
    view = "login";
    showMessage("");
  }
  if (state.account && authViews.includes(view)) {
    const returnTo = safeReturnTo();
    if (returnTo) {
      window.location.assign(returnTo);
      return;
    }
    history.replaceState(null, "", "/account");
    view = "overview";
    showMessage("");
  }
  if (!state.account && view === "reset") {
    await validateResetRoute();
    view = currentView();
  }
  renderShell(view);
}

function renderShell(view) {
  logoutButton.hidden = !state.account;
  document.body.classList.remove("account-loading");

  if (state.account) {
    setTitle("account");
    routeRoot.innerHTML = dashboardTemplate();
    renderDashboard();
    return;
  }

  const templateByView = {
    login: loginTemplate,
    register: registerTemplate,
    forgot: forgotTemplate,
    reset: () => (state.resetTokenValid ? resetTemplate() : ""),
    expired: expiredTemplate,
  };
  const safeView = templateByView[view] ? view : "login";
  setTitle(safeView);
  routeRoot.innerHTML = templateByView[safeView]();
}

function goToAuth(path) {
  showMessage("");
  state.resetTokenChecked = false;
  state.resetTokenValid = false;
  history.pushState(null, "", path);
  renderRoute();
}

function showAccountView(name) {
  ["overview", "orders", "order-detail", "details", "giftcards", "contact"].forEach((view) => {
    const element = document.querySelector(`[data-${view}-view]`);
    if (element) element.hidden = view !== name;
  });
  document.querySelectorAll(".account-sidebar a").forEach((link) => {
    const href = link.getAttribute("href");
    const isOrders = name === "order-detail" && href === "/account/orders";
    link.classList.toggle("is-active", href === window.location.pathname || isOrders);
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
  renderGiftCardsView();

  const recentOrders = state.orders.slice(0, 2);
  const openPayment = state.orders.find((order) => ["Betaalinstructie verstuurd", "Wacht op betaling"].includes(paymentText(order)));
  const latestTrack = state.orders.find((order) => order.trackTrace);
  document.querySelector("[data-latest-order]").innerHTML = recentOrders.length
    ? `
      <div class="overview-stack">
        ${openPayment ? `<div class="payment-box"><strong>Openstaande betaling</strong><p>Voor ${escapeHtml(openPayment.id)} wacht de betaling nog op afronding.</p></div>` : ""}
        ${latestTrack ? `<div class="payment-box"><strong>Track & trace</strong><p>${escapeHtml(latestTrack.id)}: ${escapeHtml(latestTrack.trackTrace)}</p></div>` : ""}
        ${recentOrders.map(renderOrderCard).join("")}
        <div class="overview-actions">
          <a class="primary-action" href="/account/orders">Bekijk alle bestellingen</a>
          <a class="secondary-action" href="/#collectie">Bekijk collectie</a>
        </div>
      </div>
    `
    : `<p class="muted">Je hebt nog geen aanvragen geplaatst. Bekijk de collectie en voeg je favoriete setje toe aan je aanvraag.</p><a class="primary-action" href="/#collectie">Bekijk collectie</a>`;

  const view = currentView();
  if (view === "orders") {
    showAccountView("orders");
  } else if (view === "details") {
    showAccountView("details");
  } else if (view === "giftcards") {
    showAccountView("giftcards");
  } else if (view === "contact") {
    showAccountView("contact");
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

function renderGiftCardsView() {
  const target = document.querySelector("[data-account-giftcards]");
  if (!target) return;
  target.innerHTML = state.giftCards.length
    ? `
      <div class="order-list">
        ${state.giftCards
          .map(
            (giftCard) => `
              <article class="account-order-card">
                <div>
                  <strong>${giftCard.paymentStatus === "Cadeaubon verstuurd" ? escapeHtml(giftCard.code) : "Cadeaubonaanvraag"}</strong>
                  <span class="muted">Ontvanger: ${escapeHtml(giftCard.recipient || "-")}</span>
                  <div class="status-badges">
                    <span>${escapeHtml(giftCard.paymentStatus || "Aangevraagd")}</span>
                    <span>${money(giftCard.balance || giftCard.initialValue || 0)}</span>
                  </div>
                </div>
              </article>
            `,
          )
          .join("")}
      </div>
    `
    : '<p class="muted">Je hebt nog geen cadeaubonnen aangevraagd.</p><a class="primary-action" href="/#cadeaubon">Cadeaubon aanvragen</a>';
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
              ${item.image ? `<img src="${escapeHtml(item.image)}" alt="">` : '<span class="account-line-placeholder">T</span>'}
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
  ["name", "email", "phone", "address", "postalCode", "city", "country", "deliveryNote"].forEach((key) => {
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

document.addEventListener("submit", async (event) => {
  const form = event.target;
  if (form.matches("[data-login-form]")) {
    event.preventDefault();
    try {
      const data = await accountRequest("login", Object.fromEntries(new FormData(form)));
      setData(data);
      const returnTo = safeReturnTo();
      if (returnTo) {
        window.location.assign(returnTo);
        return;
      }
      showMessage("Je bent ingelogd.");
      history.replaceState(null, "", "/account");
      renderRoute();
    } catch (error) {
      showMessage(error.message, true);
    }
  }

  if (form.matches("[data-register-form]")) {
    event.preventDefault();
    try {
      const data = await accountRequest("register", Object.fromEntries(new FormData(form)));
      setData(data);
      showMessage("Je account is aangemaakt. Je kunt nu je aanvragen en bestellingen bekijken.");
      history.replaceState(null, "", "/account");
      renderRoute();
    } catch (error) {
      showMessage(error.message, true);
    }
  }

  if (form.matches("[data-forgot-form]")) {
    event.preventDefault();
    try {
      const data = await accountRequest("forgot-password", Object.fromEntries(new FormData(form)));
      showMessage(data.message || "Controleer je e-mail.");
    } catch (error) {
      showMessage(error.message, true);
    }
  }

  if (form.matches("[data-reset-form]")) {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form));
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
  }

  if (form.matches("[data-details-form]")) {
    event.preventDefault();
    try {
      const data = await accountRequest("update", Object.fromEntries(new FormData(form)));
      setData(data);
      showMessage("Je gegevens zijn opgeslagen.");
      renderRoute();
    } catch (error) {
      showMessage(error.message, true);
    }
  }

  if (form.matches("[data-password-form]")) {
    event.preventDefault();
    try {
      const data = await accountRequest("change-password", Object.fromEntries(new FormData(form)));
      form.reset();
      showMessage(data.message || "Wachtwoord gewijzigd.");
    } catch (error) {
      showMessage(error.message, true);
    }
  }
});

document.addEventListener("click", async (event) => {
  const authLink = event.target.closest("[data-auth-link]");
  if (authLink) {
    event.preventDefault();
    goToAuth(authLink.dataset.authLink);
    return;
  }

  const deleteRequest = event.target.closest("[data-delete-request]");
  if (deleteRequest) {
    if (!confirm("Wil je een verzoek sturen om je account te laten verwijderen?")) return;
    try {
      const data = await accountRequest("delete-request", {});
      showMessage(data.message || "Verzoek verzonden.");
    } catch (error) {
      showMessage(error.message, true);
    }
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

window.addEventListener("popstate", () => {
  renderRoute();
});

loadAccount();
