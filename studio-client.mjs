import { readReviewCart, addReviewLine, quoteReviewCart } from './review-client.mjs';

// This concept shares only the browser review bag. It never submits an order.
const catalog = JSON.parse(document.getElementById('review-catalog').textContent);
const products = new Map(catalog.products.map(product => [product.id, product]));
const storageKey = `commerce.review-bag.v1:${catalog.basePath}:airplant`;
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const money = amount => amount === null ? 'Price pending' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount / 100);
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const searchable = value => String(value ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase();
const grid = $('#studio-grid');
const cards = [...grid.querySelectorAll('[data-product]')];
const search = $('#studio-search');
const more = $('#studio-more');
const filters = $$('[data-filter]');
let filter = 'all', expanded = false;

function renderCollection() {
  const words = searchable(search.value).trim().split(/\s+/).filter(Boolean);
  const matching = cards.filter(card => {
    const product = products.get(card.dataset.product);
    if (!product) return false;
    const text = searchable([product.title, product.description, product.category, product.group, ...product.variants.map(variant => variant.title)].join(' '));
    return (filter === 'all' || (product.group || card.dataset.group) === filter) && words.every(word => text.includes(word));
  });
  const showAll = expanded || filter !== 'all' || words.length > 0;
  const visible = new Set(showAll ? matching : matching.slice(0, 8));
  cards.forEach(card => { card.hidden = !visible.has(card); });
  filters.forEach(button => { button.setAttribute('aria-pressed', String(button.dataset.filter === filter)); });
  $('#studio-count').textContent = matching.length ? `Showing ${visible.size} of ${matching.length} selections` : 'No selections found. Try another search or category.';
  more.hidden = showAll || matching.length <= 8;
}
search.addEventListener('input', () => { expanded = false; renderCollection(); });
filters.forEach(button => button.addEventListener('click', () => { filter = button.dataset.filter; expanded = false; renderCollection(); }));
more.addEventListener('click', () => {
  const nextCard = cards.find(card => card.hidden);
  expanded = true;
  renderCollection();
  if (nextCard && !nextCard.hidden) nextCard.focus();
});

const productDialog = $('#studio-product');
const bagDialog = $('#studio-bag');
const productTitle = $('#studio-detail-title');
const bagTitle = bagDialog.querySelector('h2');
const productStatus = $('#studio-detail-status');
const bagStatus = $('#studio-bag-status');
const option = $('#studio-option');
const quantity = $('#studio-quantity');
const productForm = $('#studio-product-form');
const bagItems = $('#studio-bag-items');
let selectedProduct = null, productOpener = null, bagOpener = null;
productTitle.tabIndex = -1;
bagTitle.tabIndex = -1;
productDialog.setAttribute('aria-labelledby', productTitle.id);
if (!bagTitle.id) bagTitle.id = 'studio-bag-title';
bagDialog.setAttribute('aria-labelledby', bagTitle.id);

function closeMenu() {
  document.body.removeAttribute('data-menu-open');
  $('#studio-menu-toggle')?.setAttribute('aria-expanded', 'false');
}
function restoreFocus(element) {
  const visible = target => target?.isConnected && !target.closest('[hidden], [inert]') && target.getClientRects().length > 0;
  const target = visible(element) ? element : $('#studio-menu-toggle');
  if (visible(target)) target.focus({ preventScroll: true });
}
productDialog.addEventListener('close', () => { if (!bagDialog.open) restoreFocus(productOpener); });
bagDialog.addEventListener('close', () => { if (!productDialog.open) restoreFocus(bagOpener); });
$$('[data-close-dialog]').forEach(button => button.addEventListener('click', () => button.closest('dialog')?.close()));

function selectPhoto(index) {
  const image = selectedProduct?.images?.[index];
  const main = $('#studio-detail-image');
  main.hidden = !image;
  if (image) { main.src = image.url; main.alt = image.alt || selectedProduct.title; }
  else { main.removeAttribute('src'); main.alt = 'Product photograph pending'; }
  [...$('#studio-thumbnails').querySelectorAll('button')].forEach((button, i) => { button.setAttribute('aria-pressed', String(i === index)); });
}
function updatePrice() {
  const variant = selectedProduct?.variants.find(variant => variant.id === option.value);
  $('#studio-price').textContent = variant ? money(variant.priceMinor) : 'Price pending';
  productForm.querySelector('[type="submit"]').disabled = !variant;
}
function openProduct(id, opener) {
  const product = products.get(id);
  if (!product) return;
  closeMenu();
  productOpener = opener || document.activeElement;
  if (bagDialog.open) { productOpener = bagOpener; bagDialog.close(); }
  selectedProduct = product;
  productTitle.textContent = product.title;
  $('#studio-detail-category').textContent = product.category || '';
  $('#studio-detail-description').textContent = product.description || '';
  productStatus.textContent = '';
  quantity.value = '1';
  const label = $('#studio-option-label');
  label.hidden = product.variants.length === 1 && product.variants[0].title.trim().toLowerCase() === 'standard';
  option.setAttribute('aria-label', product.optionLabel || 'Product option');
  option.replaceChildren(...product.variants.map(variant => {
    const entry = document.createElement('option');
    entry.value = variant.id;
    entry.textContent = `${variant.title} · ${money(variant.priceMinor)}`;
    return entry;
  }));
  const priced = product.variants.filter(variant => Number.isSafeInteger(variant.priceMinor));
  const cheapest = priced.reduce((best, variant) => !best || variant.priceMinor < best.priceMinor ? variant : best, null) || product.variants[0];
  option.value = cheapest?.id || '';
  updatePrice();
  const thumbnails = $('#studio-thumbnails');
  thumbnails.replaceChildren(...(product.images || []).map((image, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'studio-thumb';
    button.setAttribute('aria-label', `View photo ${index + 1} of ${product.images.length} for ${product.title}`);
    const thumbnail = document.createElement('img');
    thumbnail.src = image.url;
    thumbnail.alt = '';
    thumbnail.loading = 'lazy';
    thumbnail.decoding = 'async';
    button.append(thumbnail);
    button.addEventListener('click', () => selectPhoto(index));
    return button;
  }));
  thumbnails.hidden = (product.images?.length || 0) < 2;
  selectPhoto(0);
  if (!productDialog.open) productDialog.showModal();
  productTitle.focus({ preventScroll: true });
}
cards.forEach(card => card.addEventListener('click', () => openProduct(card.dataset.product, card)));
$$('[data-open-product]').forEach(button => button.addEventListener('click', () => openProduct(button.dataset.openProduct, button)));
option.addEventListener('change', () => { updatePrice(); productStatus.textContent = ''; });

function latestBag() {
  try { return readReviewCart(localStorage.getItem(storageKey), catalog); }
  catch { return []; }
}
function updateCount(lines = latestBag()) {
  $$('[data-cart-count]').forEach(element => { element.textContent = `Bag (${lines.reduce((sum, line) => sum + line.quantity, 0)})`; });
}
function saveBag(lines) {
  try { localStorage.setItem(storageKey, JSON.stringify(lines.map(({ productId, variantId, quantity }) => ({ productId, variantId, quantity })))); }
  catch { throw Error('Your browser could not save the review bag. Allow site storage to try it.'); }
  updateCount(lines);
}
productForm.addEventListener('submit', event => {
  event.preventDefault();
  if (!selectedProduct || !productForm.reportValidity()) return;
  try {
    const variant = selectedProduct.variants.find(variant => variant.id === option.value);
    const amount = Number(quantity.value);
    saveBag(addReviewLine(latestBag(), { productId: selectedProduct.id, variantId: variant?.id, quantity: amount }, catalog));
    productStatus.textContent = `Added ${amount} × ${selectedProduct.title}${variant.title === 'Standard' ? '' : ' — ' + variant.title} to your review bag.`;
  } catch (error) { productStatus.textContent = error.message; }
});

function renderBag() {
  const lines = latestBag();
  const quote = quoteReviewCart(lines, catalog);
  updateCount(lines);
  bagStatus.textContent = '';
  $('#studio-bag-subtotal').textContent = money(quote.subtotalMinor);
  if (!lines.length) { bagItems.innerHTML = '<p class="studio-bag-empty">Your review bag is empty. Explore the collection to add a plant.</p>'; return; }
  bagItems.innerHTML = quote.lines.map(line => {
    const photo = products.get(line.productId)?.images?.[0];
    return `<article class="studio-bag-row">${photo ? `<img class="studio-bag-image" src="${escape(photo.url)}" alt="${escape(photo.alt || line.title)}" loading="lazy">` : ''}<div class="studio-bag-copy"><h3>${escape(line.title)}</h3><p>${escape(line.variantTitle)} · ${money(line.unitPriceMinor)} each</p></div><label class="studio-bag-quantity">Quantity<input type="number" min="1" max="20" required value="${line.quantity}" aria-label="Quantity for ${escape(line.title)}, ${escape(line.variantTitle)}" data-bag-quantity data-product-id="${escape(line.productId)}" data-variant-id="${escape(line.variantId)}"></label><strong>${money(line.lineTotalMinor)}</strong><button type="button" class="studio-bag-remove" aria-label="Remove ${escape(line.title)}, ${escape(line.variantTitle)}" data-bag-remove data-product-id="${escape(line.productId)}" data-variant-id="${escape(line.variantId)}">Remove</button></article>`;
  }).join('');
}
function focusBagControl(selector, productId, variantId) {
  const control = [...bagItems.querySelectorAll(selector)].find(control => control.dataset.productId === productId && control.dataset.variantId === variantId);
  (control || bagTitle).focus({ preventScroll: true });
}
bagItems.addEventListener('change', event => {
  const input = event.target.closest('[data-bag-quantity]');
  if (!input || !input.reportValidity()) return;
  const { productId, variantId } = input.dataset;
  try {
    const current = latestBag();
    const index = current.findIndex(line => line.productId === productId && line.variantId === variantId);
    if (index < 0) throw Error('Your bag changed in another page. Review it again.');
    const next = addReviewLine(current.filter((_, i) => i !== index), { productId, variantId, quantity: Number(input.value) }, catalog);
    next.splice(index, 0, next.pop());
    saveBag(next);
    const quote = quoteReviewCart(next, catalog);
    $('#studio-bag-subtotal').textContent = money(quote.subtotalMinor);
    input.closest('.studio-bag-row').querySelector('strong').textContent = money(quote.lines[index].lineTotalMinor);
    // Preserve the pending click/focus target when this change was triggered by blur.
    bagStatus.textContent = 'Quantity updated.';
  } catch (error) {
    const current = latestBag().find(line => line.productId === productId && line.variantId === variantId);
    if (current) input.value = String(current.quantity);
    bagStatus.textContent = error.message;
  }
});
bagItems.addEventListener('click', event => {
  const button = event.target.closest('[data-bag-remove]');
  if (!button) return;
  const { productId, variantId } = button.dataset;
  const index = [...bagItems.querySelectorAll('[data-bag-remove]')].indexOf(button);
  try {
    saveBag(latestBag().filter(line => line.productId !== productId || line.variantId !== variantId));
    renderBag();
    const remaining = [...bagItems.querySelectorAll('[data-bag-remove]')];
    (remaining[Math.min(index, remaining.length - 1)] || bagTitle).focus({ preventScroll: true });
    bagStatus.textContent = `Removed ${products.get(productId)?.title || 'selection'} from your review bag.`;
  } catch (error) { bagStatus.textContent = error.message; }
});
$$('[data-open-cart]').forEach(button => button.addEventListener('click', () => {
  closeMenu();
  bagOpener = productDialog.open ? productOpener : button;
  if (productDialog.open) productDialog.close();
  renderBag();
  if (!bagDialog.open) bagDialog.showModal();
  bagTitle.focus({ preventScroll: true });
}));
function refreshBag() {
  if (!bagDialog.open) { updateCount(); return; }
  const active = document.activeElement;
  const selector = active?.hasAttribute('data-bag-quantity') ? '[data-bag-quantity]' : active?.hasAttribute('data-bag-remove') ? '[data-bag-remove]' : null;
  renderBag();
  if (selector) focusBagControl(selector, active.dataset.productId, active.dataset.variantId);
}
window.addEventListener('storage', event => { if (event.key === storageKey || event.key === null) refreshBag(); });
window.addEventListener('pageshow', event => { if (event.persisted) refreshBag(); });

const menuButton = $('#studio-menu-toggle');
const nav = $('#studio-nav');
menuButton?.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  document.body.toggleAttribute('data-menu-open', open);
  menuButton.setAttribute('aria-expanded', String(open));
});
nav?.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
document.addEventListener('click', event => { if (menuButton && !menuButton.contains(event.target) && !nav?.contains(event.target)) closeMenu(); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuButton?.getAttribute('aria-expanded') === 'true') { closeMenu(); menuButton.focus(); }
});

renderCollection();
updateCount();
