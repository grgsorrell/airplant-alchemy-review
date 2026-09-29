// Static review only: no network calls, payment handling, or order records.
const cleanLine = line => ({ productId: line.productId, variantId: line.variantId, quantity: line.quantity });
const validQuantity = quantity => Number.isInteger(quantity) && quantity >= 1 && quantity <= 20;
const optionFor = (catalog, line) => catalog.products.find(product => product.id === line.productId)?.variants.find(variant => variant.id === line.variantId);

export function readReviewCart(serialized, catalog) {
  let value;
  try { value = JSON.parse(serialized || 'null'); } catch {}
  const lines = [];
  if (!Array.isArray(value)) return lines;
  for (const line of value.slice(0, 50)) {
    if (!line || !validQuantity(line.quantity) || !optionFor(catalog, line)) continue;
    const existing = lines.find(item => item.productId === line.productId && item.variantId === line.variantId);
    const available = Math.min(20 - (existing?.quantity || 0), 50 - lines.reduce((total, item) => total + item.quantity, 0));
    const quantity = Math.min(available, line.quantity);
    if (quantity < 1) continue;
    if (existing) existing.quantity += quantity;
    else lines.push({ ...cleanLine(line), quantity });
  }
  return lines;
}

export function addReviewLine(lines, line, catalog) {
  if (!line || !validQuantity(line.quantity) || !optionFor(catalog, line)) throw Error('Choose a valid product option and a quantity from 1 to 20.');
  const next = lines.map(cleanLine);
  const existing = next.find(item => item.productId === line.productId && item.variantId === line.variantId);
  if ((existing?.quantity || 0) + line.quantity > 20) throw Error('The review bag allows up to 20 of each option.');
  if (next.reduce((total, item) => total + item.quantity, 0) + line.quantity > 50) throw Error('The review bag allows up to 50 items.');
  if (existing) existing.quantity += line.quantity;
  else next.push(cleanLine(line));
  return next;
}

export function quoteReviewCart(lines, catalog) {
  const quoted = lines.map(line => {
    const product = catalog.products.find(item => item.id === line.productId);
    const variant = product?.variants.find(item => item.id === line.variantId);
    if (!variant || !validQuantity(line.quantity)) throw Error('This saved product option is no longer in the review collection.');
    return { ...cleanLine(line), title: product.title, variantTitle: variant.title, unitPriceMinor: variant.priceMinor, lineTotalMinor: variant.priceMinor === null ? null : variant.priceMinor * line.quantity };
  });
  return { lines: quoted, subtotalMinor: quoted.some(line => line.lineTotalMinor === null) ? null : quoted.reduce((sum, line) => sum + line.lineTotalMinor, 0) };
}

function startReview() {
  const configElement = document.getElementById('review-catalog');
  if (!configElement) throw Error('Review catalog is missing.');
  const catalog = JSON.parse(configElement.textContent);
  if (catalog.mode !== 'review' || catalog.storefrontId !== 'airplant' || !Array.isArray(catalog.products)) throw Error('A static Air Plant review catalog is required.');
  const base = catalog.basePath;
  const storePath = `${base}/s/airplant/`;
  const key = `commerce.review-bag.v1:${base}:airplant`;
  const $ = selector => document.querySelector(selector);
  const money = amount => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount / 100);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const latest = () => {
    try { return readReviewCart(localStorage.getItem(key), catalog); }
    catch { return []; }
  };
  let lines = latest();
  function updateCount() {
    document.querySelectorAll('[data-cart-count]').forEach(link => { link.textContent = `Bag (${lines.reduce((total, line) => total + line.quantity, 0)})`; });
  }
  function save(next) {
    try { localStorage.setItem(key, JSON.stringify(next.map(cleanLine))); }
    catch { throw Error('Your browser could not save the review bag. Allow site storage to try it.'); }
    lines = next;
    updateCount();
  }
  window.Commerce = { add(line) { save(addReviewLine(latest(), line, catalog)); } };
  if (document.body.classList.contains('airplant-shell')) {
    const link = document.createElement('a');
    link.href = `${storePath}cart/`;
    link.dataset.cartCount = '';
    $('.top-nav')?.append(link);
    const note = document.createElement('div');
    note.className = 'forest-demo';
    note.textContent = 'Brian’s review · no orders or payment';
    document.body.append(note);
  }
  function renderCart() {
    lines = latest();
    updateCount();
    const container = $('#cart-content');
    if (!container) return;
    const errorElement = $('#cart-error');
    errorElement.textContent = '';
    if (!lines.length) { container.textContent = 'Your review bag is empty.'; return; }
    const quote = quoteReviewCart(lines, catalog);
    container.innerHTML = quote.lines.map(line => `<article class="cart-row"><div><h2><a href="${storePath}products/${encodeURIComponent(line.productId)}/?variant=${encodeURIComponent(line.variantId)}">${esc(line.title)}</a></h2><p>${esc(line.variantTitle)} · ${line.unitPriceMinor === null ? 'Price pending' : money(line.unitPriceMinor) + ' each (preview)'}</p></div><label>Quantity<input type="number" min="1" max="20" value="${line.quantity}" data-product="${esc(line.productId)}" data-variant="${esc(line.variantId)}"></label><strong>${line.lineTotalMinor === null ? 'Price pending' : money(line.lineTotalMinor)}</strong><button class="remove" data-remove="${esc(line.productId)}" data-variant="${esc(line.variantId)}">Remove</button></article>`).join('') + `<p class="total">Preview subtotal <span>${quote.subtotalMinor === null ? 'Price pending' : money(quote.subtotalMinor)}</span></p><p class="fine">Prices and availability need Brian’s confirmation. This bag stays in your browser; it is not an order.</p>`;
    container.querySelectorAll('[data-product]').forEach(input => input.addEventListener('change', () => {
      if (!input.reportValidity()) return;
      try {
        const current = latest();
        if (!current.some(line => line.productId === input.dataset.product && line.variantId === input.dataset.variant)) throw Error('Your bag changed in another page. Review it again.');
        const rest = current.filter(line => line.productId !== input.dataset.product || line.variantId !== input.dataset.variant);
        save(addReviewLine(rest, { productId: input.dataset.product, variantId: input.dataset.variant, quantity: Number(input.value) }, catalog));
        renderCart();
      } catch (error) { renderCart(); errorElement.textContent = error.message; }
    }));
    container.querySelectorAll('[data-remove]').forEach(button => button.addEventListener('click', () => {
      try { save(latest().filter(line => line.productId !== button.dataset.remove || line.variantId !== button.dataset.variant)); renderCart(); }
      catch (error) { errorElement.textContent = error.message; }
    }));
  }
  window.addEventListener('storage', event => { if (event.key === key || event.key === null) renderCart(); });
  window.addEventListener('pageshow', event => { if (event.persisted) renderCart(); });
  renderCart();
}

if (typeof document !== 'undefined') startReview();
