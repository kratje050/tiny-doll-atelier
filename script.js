const formatMoney = TinyStore.formatMoney;

const state = {
  activeFilter: "alles",
  searchQuery: "",
  cart: JSON.parse(localStorage.getItem("poppenatelier-cart") || "{}"),
  products: TinyStore.getProducts().filter((product) => product.active),
  categories: TinyStore.getCategories(),
  checkoutVisible: false,
  giftWrap: false,
  giftMessage: "",
  selectedProductId: "",
};

const GIFT_WRAP_PRICE = 2.95;
const DEFAULT_WASH_CARE =
  "Was met de hand of op een fijnwasprogramma. Niet in de droger. Laat liggend drogen voor het mooiste resultaat.";
const PRODUCT_DETAILS = {
  "linnen-set": {
    size: "34 cm",
    contents: "Broekje en topje",
    material: "Katoen/mousseline",
    leadTime: "3 tot 7 werkdagen",
    stockStatus: "Op aanvraag beschikbaar",
    options: "Kleur en haarband in overleg",
  },
  "strik-haarband": {
    size: "32 tot 36 cm",
    contents: "Haarband met strik",
    material: "Linnenlook katoen",
    leadTime: "3 tot 7 werkdagen",
    stockStatus: "Op bestelling beschikbaar",
    options: "Strikmaat en kleur in overleg",
  },
  "linnen-top-broek": {
    size: "34 cm",
    contents: "Wijde broek, topje en haarband",
    material: "Katoen/mousseline",
    leadTime: "1 tot 3 werkdagen bij voorraad",
    stockStatus: "Beperkt op voorraad",
    options: "Bijpassende haarband mogelijk",
  },
  "romper-ruches": {
    size: "34 cm",
    contents: "Romper met ruches",
    material: "Zachte ribstof",
    leadTime: "3 tot 10 werkdagen",
    stockStatus: "Op aanvraag beschikbaar",
    options: "Kleur en afwerking in overleg",
  },
};

const grid = document.querySelector("[data-product-grid]");
const productTemplate = document.querySelector("#product-card-template");
const filterTabs = document.querySelector("[data-filter-tabs]");
const productSearch = document.querySelector("[data-product-search]");
const resultCount = document.querySelector("[data-result-count]");
const cartPanel = document.querySelector("[data-cart-panel]");
const cartItems = document.querySelector("[data-cart-items]");
const cartTotal = document.querySelector("[data-cart-total]");
const cartCount = document.querySelector("[data-cart-count]");
const checkoutForm = document.querySelector("[data-checkout-form]");
const checkoutToggle = document.querySelector("[data-show-checkout]");
const giftWrapInput = document.querySelector("[data-gift-wrap]");
const giftMessageInput = document.querySelector("[data-gift-message]");
const orderMessage = document.querySelector("[data-order-message]");
const giftCardOrderForm = document.querySelector("[data-gift-card-order-form]");
const giftCardMessage = document.querySelector("[data-gift-card-message]");
const productModal = document.querySelector("[data-product-modal]");
const modalAddButton = document.querySelector("[data-modal-add]");
const contactForm = document.querySelector("[data-contact-form]");
const returnForm = document.querySelector("[data-return-form]");

TinyStore.recordVisit();

function saveCart() {
  localStorage.setItem("poppenatelier-cart", JSON.stringify(state.cart));
}

function categoryName(categoryId) {
  return state.categories.find((category) => category.id === categoryId)?.name || categoryId;
}

function stockQuantity(product) {
  if (Number.isFinite(Number(product.stockQuantity))) {
    return Number(product.stockQuantity);
  }

  const stockMatch = String(product.stock || "").match(/\d+/);
  return stockMatch ? Number(stockMatch[0]) : 0;
}

function stockLabel(product) {
  const quantity = stockQuantity(product);
  const extra = product.stock && !String(product.stock).match(/^\d+\s+op voorraad$/i)
    ? ` - ${product.stock}`
    : "";
  return `Nog ${quantity} op voorraad${extra}`;
}

function getProductDetails(product) {
  return {
    size: product.size || PRODUCT_DETAILS[product.id]?.size || product.badge || "34 cm",
    contents: product.contents || PRODUCT_DETAILS[product.id]?.contents || "Handgemaakt kledingstuk",
    material: product.material || PRODUCT_DETAILS[product.id]?.material || "Katoen/mousseline",
    leadTime: product.leadTime || PRODUCT_DETAILS[product.id]?.leadTime || "3 tot 7 werkdagen",
    stockStatus: product.stockStatus || PRODUCT_DETAILS[product.id]?.stockStatus || stockLabel(product),
    washCare: product.washCare || PRODUCT_DETAILS[product.id]?.washCare || DEFAULT_WASH_CARE,
    options: product.options || PRODUCT_DETAILS[product.id]?.options || "Maatwerk in overleg mogelijk",
  };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) =>
    ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character],
  );
}

function renderFilters() {
  const filters = [{ id: "alles", name: "Alles" }, ...state.categories];
  filterTabs.innerHTML = filters
    .map(
      (filter) =>
        `<button class="${filter.id === state.activeFilter ? "is-active" : ""}" type="button" data-filter="${filter.id}">${filter.name}</button>`,
    )
    .join("");
}

function visibleProducts() {
  const query = state.searchQuery.trim().toLowerCase();
  const filteredProducts =
    state.activeFilter === "alles"
      ? state.products
      : state.products.filter((product) => product.categoryId === state.activeFilter);

  if (!query) {
    return filteredProducts;
  }

  return filteredProducts.filter((product) => {
    const searchableText = [
      product.name,
      categoryName(product.categoryId),
      product.description,
      product.badge,
      product.stock,
      stockLabel(product),
      getProductDetails(product).size,
      getProductDetails(product).contents,
      getProductDetails(product).material,
      getProductDetails(product).leadTime,
      formatMoney(product.price),
    ]
      .join(" ")
      .toLowerCase();

    return searchableText.includes(query);
  });
}

function renderProducts() {
  grid.innerHTML = "";
  const products = visibleProducts();

  resultCount.textContent = `${products.length} ${products.length === 1 ? "product" : "producten"} gevonden`;

  if (!products.length) {
    grid.innerHTML = '<p class="empty-results">Geen producten gevonden. Probeer een andere zoekterm of filter.</p>';
    return;
  }

  products.forEach((product) => {
    const card = productTemplate.content.firstElementChild.cloneNode(true);
    const details = getProductDetails(product);
    const image = card.querySelector("img");
    image.src = product.image;
    image.alt = product.name;
    card.querySelector(".product-badge").textContent = product.badge;
    card.querySelector(".product-category").textContent = categoryName(product.categoryId);
    card.querySelector("h3").textContent = product.name;
    card.querySelector(".product-description").textContent = product.description;
    card.querySelector(".product-size").textContent = details.size;
    card.querySelector(".product-contents").textContent = details.contents;
    card.querySelector(".product-material").textContent = details.material;
    card.querySelector(".product-leadtime").textContent = details.leadTime;
    card.querySelector(".product-price").textContent = formatMoney(product.price);
    card.querySelector(".product-stock").textContent = details.stockStatus;
    card.querySelector(".view-button").addEventListener("click", () => openProductModal(product.id));
    card.querySelector(".add-button").addEventListener("click", () => addToCart(product.id));
    grid.append(card);
  });
}

function openProductModal(productId) {
  const product = state.products.find((item) => item.id === productId);
  if (!product) {
    return;
  }

  const details = getProductDetails(product);
  state.selectedProductId = productId;
  productModal.querySelector("[data-modal-image]").src = product.image;
  productModal.querySelector("[data-modal-image]").alt = product.name;
  productModal.querySelector("[data-modal-category]").textContent = categoryName(product.categoryId);
  productModal.querySelector("[data-modal-title]").textContent = product.name;
  productModal.querySelector("[data-modal-price]").textContent = formatMoney(product.price);
  productModal.querySelector("[data-modal-description]").textContent = product.description;
  productModal.querySelector("[data-modal-details]").innerHTML = [
    ["Geschikte popmaat", details.size],
    ["Wat zit erbij", details.contents],
    ["Materiaal", details.material],
    ["Levertijd", details.leadTime],
    ["Voorraadstatus", details.stockStatus],
    ["Keuzeopties", details.options],
  ]
    .map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`)
    .join("");
  productModal.classList.add("is-open");
  productModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeProductModal() {
  productModal.classList.remove("is-open");
  productModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function addToCart(productId) {
  state.cart[productId] = (state.cart[productId] || 0) + 1;
  saveCart();
  renderCart();
  openCart();
}

function resetCheckoutExtras() {
  state.checkoutVisible = false;
  state.giftWrap = false;
  state.giftMessage = "";
  giftWrapInput.checked = false;
  giftMessageInput.value = "";
}

function resetCheckoutIfEmpty() {
  if (!Object.values(state.cart).some((quantity) => quantity > 0)) {
    resetCheckoutExtras();
  }
}

function setCartQuantity(productId, quantity) {
  if (quantity <= 0) {
    delete state.cart[productId];
  } else {
    state.cart[productId] = quantity;
  }

  resetCheckoutIfEmpty();
  saveCart();
  renderCart();
}

function removeFromCart(productId) {
  delete state.cart[productId];
  resetCheckoutIfEmpty();
  saveCart();
  renderCart();
}

function clearCart() {
  state.cart = {};
  resetCheckoutExtras();
  checkoutForm.reset();
  orderMessage.textContent = "";
  saveCart();
  renderCart();
}

function cartEntries() {
  return Object.entries(state.cart)
    .map(([id, quantity]) => ({
      product: state.products.find((item) => item.id === id),
      quantity,
    }))
    .filter((entry) => entry.product && entry.quantity > 0);
}

function renderCart() {
  const entries = cartEntries();
  cartItems.innerHTML = "";

  if (!entries.length) {
    cartItems.innerHTML = '<p class="cart-empty">Je winkelmand is nog leeg.</p>';
  }

  entries.forEach(({ product, quantity }) => {
    const line = document.createElement("article");
    const productName = escapeHtml(product.name);
    const productImage = escapeHtml(product.image);
    line.className = "cart-line";
    line.innerHTML = `
      <img src="${productImage}" alt="${productName}">
      <div>
        <strong>${productName}</strong>
        <span>${formatMoney(product.price)} per stuk</span>
      </div>
      <div class="quantity-controls" aria-label="Aantal voor ${productName}">
        <button type="button" data-cart-action="decrease" data-product-id="${product.id}" aria-label="Minder ${productName}">-</button>
        <span class="quantity">${quantity}x</span>
        <button type="button" data-cart-action="increase" data-product-id="${product.id}" aria-label="Meer ${productName}">+</button>
        <button class="remove-item" type="button" data-cart-action="remove" data-product-id="${product.id}">Verwijder</button>
      </div>
    `;
    cartItems.append(line);
  });

  if (state.giftWrap && entries.length) {
    const giftLine = document.createElement("article");
    giftLine.className = "cart-line gift-wrap-line";
    giftLine.innerHTML = `
      <div class="gift-icon" aria-hidden="true">G</div>
      <div>
        <strong>Cadeauverpakking</strong>
        <span>${formatMoney(GIFT_WRAP_PRICE)} inclusief persoonlijk kaartje</span>
      </div>
      <button class="remove-item single-remove" type="button" data-cart-action="remove-gift-wrap">Verwijder</button>
    `;
    cartItems.append(giftLine);
  }

  const subtotal = entries.reduce((sum, entry) => sum + entry.product.price * entry.quantity, 0);
  const giftWrapTotal = state.giftWrap && entries.length ? GIFT_WRAP_PRICE : 0;
  const total = subtotal + giftWrapTotal;
  const count = entries.reduce((sum, entry) => sum + entry.quantity, 0);
  cartTotal.textContent = formatMoney(total);
  cartCount.textContent = count;
  checkoutToggle.disabled = !count;
  checkoutToggle.hidden = state.checkoutVisible || !count;
  checkoutForm.hidden = !state.checkoutVisible || !count;
}

function showCheckout() {
  if (!cartEntries().length) {
    return;
  }

  state.checkoutVisible = true;
  renderCart();
  checkoutForm.querySelector("input")?.focus();
}

function openCart() {
  cartPanel.classList.add("is-open");
  cartPanel.setAttribute("aria-hidden", "false");
  document.body.classList.add("cart-open");
}

function closeCart() {
  cartPanel.classList.remove("is-open");
  cartPanel.setAttribute("aria-hidden", "true");
  document.body.classList.remove("cart-open");
}

function buildMailBody(order) {
  const lines = order.items.map(
    (item) => `- ${item.quantity}x ${item.name} (${formatMoney(item.price)} per stuk)`,
  );

  return [
    "Hallo,",
    "",
    "Ik wil graag deze poppenkleertjes bestellen:",
    ...lines,
    "",
    order.discountCode ? `Kortingscode: ${order.discountCode}` : "",
    order.giftCardCode ? `Cadeaubon: ${order.giftCardCode} (-${formatMoney(order.giftCardAmount)})` : "",
    `Totaal: ${formatMoney(order.total)}`,
    "",
    `Naam: ${order.customer.name}`,
    `E-mail: ${order.customer.email}`,
    `Telefoon: ${order.customer.phone || "-"}`,
    `Opmerking: ${order.notes || "-"}`,
    "",
    "Groetjes,",
  ]
    .filter(Boolean)
    .join("\n");
}

filterTabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");
  if (!button) {
    return;
  }

  state.activeFilter = button.dataset.filter;
  renderFilters();
  renderProducts();
});

productSearch.addEventListener("input", (event) => {
  state.searchQuery = event.target.value;
  renderProducts();
});

document.querySelectorAll("[data-open-cart]").forEach((button) => {
  button.addEventListener("click", openCart);
});

document.querySelectorAll("[data-close-cart]").forEach((button) => {
  button.addEventListener("click", closeCart);
});

document.querySelector("[data-clear-cart]").addEventListener("click", clearCart);
checkoutToggle.addEventListener("click", showCheckout);
giftWrapInput.addEventListener("change", (event) => {
  state.giftWrap = event.target.checked;
  renderCart();
});
giftMessageInput.addEventListener("input", (event) => {
  state.giftMessage = event.target.value;
});

cartItems.addEventListener("click", (event) => {
  const button = event.target.closest("[data-cart-action]");
  if (!button) {
    return;
  }

  const productId = button.dataset.productId;
  const currentQuantity = state.cart[productId] || 0;

  if (button.dataset.cartAction === "remove-gift-wrap") {
    state.giftWrap = false;
    giftWrapInput.checked = false;
    renderCart();
    return;
  }

  if (button.dataset.cartAction === "increase") {
    setCartQuantity(productId, currentQuantity + 1);
  }

  if (button.dataset.cartAction === "decrease") {
    setCartQuantity(productId, currentQuantity - 1);
  }

  if (button.dataset.cartAction === "remove") {
    removeFromCart(productId);
  }
});

document.querySelectorAll("[data-close-product]").forEach((button) => {
  button.addEventListener("click", closeProductModal);
});

modalAddButton.addEventListener("click", () => {
  if (state.selectedProductId) {
    addToCart(state.selectedProductId);
    closeProductModal();
  }
});

checkoutForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const entries = cartEntries();
  if (!entries.length) {
    orderMessage.textContent = "Je winkelmand is nog leeg.";
    return;
  }

  const formData = new FormData(checkoutForm);
  state.giftWrap = formData.get("giftWrap") === "on";
  state.giftMessage = formData.get("giftMessage").trim();
  const orderItems = entries.map(({ product, quantity }) => ({
    productId: product.id,
    name: product.name,
    price: product.price,
    quantity,
  }));

  if (state.giftWrap) {
    orderItems.push({
      productId: "cadeauverpakking",
      name: "Cadeauverpakking",
      price: GIFT_WRAP_PRICE,
      quantity: 1,
    });
  }

  const order = TinyStore.createOrder({
    customer: {
      name: formData.get("name").trim(),
      email: formData.get("email").trim(),
      phone: formData.get("phone").trim(),
    },
    discountCode: formData.get("discountCode").trim(),
    giftCardCode: formData.get("giftCardCode").trim(),
    notes: [formData.get("notes").trim(), state.giftWrap ? `Persoonlijk kaartje: ${state.giftMessage || "-"}` : ""]
      .filter(Boolean)
      .join("\n"),
    items: orderItems,
  });

  orderMessage.textContent = `Bestelling ${order.id} is opgeslagen in beheer.`;
  state.cart = {};
  state.checkoutVisible = false;
  state.giftWrap = false;
  state.giftMessage = "";
  checkoutForm.reset();
  saveCart();
  renderCart();

  const mail = `mailto:ddytuber@gmail.com?subject=${encodeURIComponent(
    `Bestelverzoek ${order.id}`,
  )}&body=${encodeURIComponent(buildMailBody(order))}`;
  window.location.href = mail;
});

giftCardOrderForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(giftCardOrderForm);
  const result = TinyStore.createGiftCardOrder({
    amount: Number(formData.get("amount")),
    recipient: formData.get("recipient").trim(),
    recipientEmail: formData.get("recipientEmail").trim(),
    message: formData.get("message").trim(),
    customer: {
      name: formData.get("name").trim(),
      email: formData.get("email").trim(),
      phone: "",
    },
  });
  const { order, giftCard } = result;
  const deliverTo = giftCard.email || order.customer.email;

  giftCardMessage.textContent = `Cadeauboncode ${giftCard.code} is aangemaakt en klaargezet voor e-mail.`;
  const body = [
    `Hallo ${giftCard.recipient || ""},`.trim(),
    "",
    "Je hebt een cadeaubon gekregen voor Tiny Doll Atelier.",
    "",
    `Waarde: ${formatMoney(giftCard.initialValue)}`,
    `Cadeauboncode: ${giftCard.code}`,
    `Geldig tot: ${giftCard.expiresAt}`,
    "",
    formData.get("message").trim() ? `Bericht: ${formData.get("message").trim()}` : "",
    "",
    "Je kunt deze code invullen bij het afrekenen in de webshop.",
    "",
    "Liefs, Tiny Doll Atelier",
  ]
    .filter(Boolean)
    .join("\n");
  window.location.href = `mailto:${encodeURIComponent(deliverTo)}?subject=${encodeURIComponent(
    `Jouw cadeaubon van Tiny Doll Atelier`,
  )}&body=${encodeURIComponent(body)}`;
  giftCardOrderForm.reset();
});

returnForm.addEventListener("submit", (event) => {
  event.preventDefault();
  returnForm.reset();
  document.querySelector("[data-return-message]").textContent =
    "Bedankt voor je bericht. We nemen zo snel mogelijk contact met je op over je retour of annulering.";
});

contactForm.addEventListener("submit", (event) => {
  event.preventDefault();
  contactForm.reset();
  document.querySelector("[data-contact-message]").textContent =
    "Bedankt voor je bericht. We reageren zo snel mogelijk.";
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeCart();
    closeProductModal();
  }
});

renderFilters();
renderProducts();
renderCart();
