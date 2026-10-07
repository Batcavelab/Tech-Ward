// Tech-Ward: browser cart (no server needed, so the site runs on Netlify),
// WhatsApp order message, product search and mobile menu.
(function () {
  const KEY = "tw-cart";

  // ---- cart storage: {"<product id>": quantity} -------------------------
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function save(cart) {
    try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch (e) { /* private mode */ }
    updateCount(cart);
  }
  function count(cart) {
    return Object.values(cart).reduce((a, b) => a + b, 0);
  }
  function updateCount(cart) {
    const n = count(cart);
    document.querySelectorAll("[data-cart-count]").forEach((el) => {
      el.textContent = n;
      el.hidden = n === 0;
    });
  }
  function add(id, qty) {
    const cart = load();
    cart[id] = Math.min(99, (cart[id] || 0) + qty);
    save(cart);
  }

  // ---- toast -------------------------------------------------------------
  const toast = document.getElementById("toast");
  let toastTimer;
  function showToast(text) {
    if (!toast) return;
    toast.querySelector("[data-toast-text]").textContent = text;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 3500);
  }

  // ---- add-to-cart buttons -----------------------------------------------
  const addedText = toast ? toast.dataset.added : "";
  document.querySelectorAll("[data-add]").forEach((button) => {
    button.addEventListener("click", () => {
      let qty = 1;
      if (button.dataset.qtyFrom) {
        const input = document.querySelector(button.dataset.qtyFrom);
        qty = Math.max(1, Math.min(99, parseInt(input && input.value, 10) || 1));
      }
      add(button.dataset.add, qty);
      showToast(`${addedText} · ${button.dataset.name}`);
    });
  });

  // ---- cart page ---------------------------------------------------------
  const page = document.querySelector("[data-cart-page]");
  const dataEl = document.getElementById("cart-data");
  if (page && dataEl) {
    const data = JSON.parse(dataEl.textContent);
    const T = data.t;

    const formatMad = (value) => {
      if (value === null) return T.on_quote;
      if (value === 0) return T.free;
      return `${Math.round(value).toLocaleString("fr-FR").replace(/\s/g, " ")} ${T.currency}`;
    };
    const items = {};
    document.querySelectorAll("template[data-cart-item]").forEach((tpl) => {
      items[tpl.dataset.cartItem] = {
        tpl,
        name: tpl.dataset.name,
        price: tpl.dataset.price === "" ? null : Number(tpl.dataset.price),
      };
    });

    const linesEl = page.querySelector("[data-cart-lines]");
    function lines() {
      const cart = load();
      return Object.keys(cart)
        .filter((id) => items[id])
        .map((id) => {
          const item = items[id];
          const qty = cart[id];
          return { id, qty, item, total: item.price === null ? null : item.price * qty };
        });
    }

    function render() {
      const list = lines();
      page.querySelector("[data-cart-empty]").hidden = list.length > 0;
      page.querySelector("[data-cart-full]").hidden = list.length === 0;
      linesEl.innerHTML = "";
      list.forEach((line) => {
        const row = line.item.tpl.content.firstElementChild.cloneNode(true);
        row.querySelector("[data-qty]").textContent = line.qty;
        row.querySelector("[data-line-total]").textContent = formatMad(line.total);
        row.querySelectorAll("[data-step]").forEach((b) => b.addEventListener("click", () => {
          const cart = load();
          cart[line.id] = Math.min(99, cart[line.id] + Number(b.dataset.step));
          if (cart[line.id] <= 0) delete cart[line.id];
          save(cart);
          render();
        }));
        row.querySelector("[data-remove]").addEventListener("click", () => {
          const cart = load();
          delete cart[line.id];
          save(cart);
          render();
        });
        linesEl.appendChild(row);
      });
      const total = list.reduce((sum, l) => sum + (l.total || 0), 0);
      page.querySelector("[data-cart-total]").textContent = formatMad(total);
      page.querySelector("[data-quote-note]").hidden = !list.some((l) => l.total === null);
    }

    page.querySelector("[data-checkout]").addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.target;
      const f = Object.fromEntries(new FormData(form));
      const list = lines();
      if (!list.length) return;
      const total = list.reduce((sum, l) => sum + (l.total || 0), 0);
      const now = new Date();
      const ref = `TW-${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
      const out = [T.wa_hello, ""];
      list.forEach((l) => out.push(`• ${l.qty} × ${l.item.name} : ${formatMad(l.total)}`));
      out.push("");
      let totalLine = `${T.wa_total} : ${formatMad(total)}`;
      if (list.some((l) => l.total === null)) totalLine += ` (${T.wa_quote_note})`;
      out.push(totalLine, "");
      out.push(`${T.wa_name} : ${f.name.trim()}`);
      out.push(`${T.wa_city} : ${f.city.trim()}`);
      if (f.phone.trim()) out.push(`${T.wa_phone} : ${f.phone.trim()}`);
      if (f.notes.trim()) out.push(`${T.wa_notes} : ${f.notes.trim()}`);
      out.push(`${T.wa_ref} : ${ref}`);
      const url = `https://wa.me/${data.whatsapp}?text=${encodeURIComponent(out.join("\n"))}`;
      save({});
      render();
      window.location.href = url;
    });

    render();
  }

  // ---- product search (shop page, ?q=...) ---------------------------------
  const grid = document.querySelector("[data-searchable]");
  const query = new URLSearchParams(window.location.search).get("q");
  if (grid && query) {
    const q = query.trim().toLowerCase();
    let shown = 0;
    grid.querySelectorAll("[data-search]").forEach((card) => {
      const match = card.dataset.search.toLowerCase().includes(q);
      card.hidden = !match;
      shown += match;
    });
    const title = document.querySelector("[data-results-title]");
    if (title) title.textContent = `${title.dataset.resultsTitle} « ${query.trim()} »`;
    const none = document.querySelector("[data-no-results]");
    if (none) none.hidden = shown > 0;
    document.querySelectorAll(".search input[name=q]").forEach((i) => { i.value = query; });
  }

  // ---- mobile menu ---------------------------------------------------------
  const toggle = document.querySelector(".menu-toggle");
  const nav = document.getElementById("main-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
  }

  // ---- camera placement pictures: open full size (home page) -------------
  const zoomLinks = document.querySelectorAll("[data-zoom]");
  if (zoomLinks.length && window.HTMLDialogElement) {
    const grid = document.querySelector(".placement-grid");
    const box = document.createElement("dialog");
    box.className = "lightbox";
    box.innerHTML = '<div class="lightbox-inner"><button type="button" class="lightbox-close">&times;</button>' +
      '<img alt=""><p><strong></strong><span></span></p></div>';
    const closeBtn = box.querySelector(".lightbox-close");
    closeBtn.setAttribute("aria-label", (grid && grid.dataset.closeLabel) || "Fermer");
    document.body.appendChild(box);
    const img = box.querySelector("img");
    zoomLinks.forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const fig = link.closest("figure");
        img.src = link.href;
        img.alt = link.querySelector("img").alt;
        box.querySelector("strong").textContent = fig.querySelector("h4").textContent;
        box.querySelector("span").textContent = fig.querySelector("figcaption p").textContent;
        box.showModal();
      });
    });
    closeBtn.addEventListener("click", () => box.close());
    // Tap outside the picture closes it.
    box.addEventListener("click", (e) => { if (e.target !== img) box.close(); });
  }

  updateCount(load());
})();
