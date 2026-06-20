const formatMoney = TinyStore.formatMoney;

const state = {
  activeFilter: "alles",
  searchQuery: "",
  cart: JSON.parse(localStorage.getItem("poppenatelier-cart") || "{}"),
  products: TinyStore.getProducts().filter((product) => product.active),
  categories: TinyStore.getCategories(),
  checkoutVisible: false,
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
const orderMessage = document.querySelector("[data-order-message]");
const giftCardOrderForm = document.querySelector("[data-gift-card-order-form]");
const giftCardMessage = document.querySelector("[data-gift-card-message]");

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
    const image = card.querySelector("img");
    image.src = product.image;
    image.alt = product.name;
    card.querySelector(".product-badge").textContent = product.badge;
    card.querySelector(".product-category").textContent = categoryName(product.categoryId);
    card.querySelector("h3").textContent = product.name;
    card.querySelector(".product-description").textContent = product.description;
    card.querySelector(".product-price").textContent = formatMoney(product.price);
    card.querySelector(".product-stock").textContent = stockLabel(product);
    card.querySelector(".add-button").addEventListener("click", () => addToCart(product.id));
    grid.append(card);
  });
}

function addToCart(productId) {
  state.cart[productId] = (state.cart[productId] || 0) + 1;
  saveCart();
  renderCart();
  openCart();
}

function setCartQuantity(productId, quantity) {
  if (quantity <= 0) {
    delete state.cart[productId];
  } else {
    state.cart[productId] = quantity;
  }

  saveCart();
  renderCart();
}

function removeFromCart(productId) {
  delete state.cart[productId];
  saveCart();
  renderCart();
}

function clearCart() {
  state.cart = {};
  state.checkoutVisible = false;
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

  const total = entries.reduce((sum, entry) => sum + entry.product.price * entry.quantity, 0);
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

cartItems.addEventListener("click", (event) => {
  const button = event.target.closest("[data-cart-action]");
  if (!button) {
    return;
  }

  const productId = button.dataset.productId;
  const currentQuantity = state.cart[productId] || 0;

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

checkoutForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const entries = cartEntries();
  if (!entries.length) {
    orderMessage.textContent = "Je winkelmand is nog leeg.";
    return;
  }

  const formData = new FormData(checkoutForm);
  const order = TinyStore.createOrder({
    customer: {
      name: formData.get("name").trim(),
      email: formData.get("email").trim(),
      phone: formData.get("phone").trim(),
    },
    discountCode: formData.get("discountCode").trim(),
    giftCardCode: formData.get("giftCardCode").trim(),
    notes: formData.get("notes").trim(),
    items: entries.map(({ product, quantity }) => ({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity,
    })),
  });

  orderMessage.textContent = `Bestelling ${order.id} is opgeslagen in beheer.`;
  state.cart = {};
  state.checkoutVisible = false;
  saveCart();
  renderCart();

  const mail = `mailto:bestellen@voorbeeld.nl?subject=${encodeURIComponent(
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

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeCart();
  }
});

renderFilters();
renderProducts();
renderCart();
