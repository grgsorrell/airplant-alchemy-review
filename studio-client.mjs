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
const swipeView = $('#studio-swipe');
const deck = $('#studio-deck');
const swipeCard = $('#studio-swipe-card');
const swipePrevious = $('#studio-swipe-prev');
const swipeNext = $('#studio-swipe-next');
const narrowScreen = matchMedia('(max-width: 560px), (pointer: coarse) and (max-width: 950px) and (orientation: landscape)');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let filter = 'all', expanded = false, matchingCards = [], swipeIndex = 0;
let shopView = narrowScreen.matches ? 'swipe' : 'grid';
let gesture = null, suppressSwipeClick = false;
let deckFlight = null;
let viewportWidth = window.innerWidth;

function renderCollection() {
  cancelDeckFlight();
  const words = searchable(search.value).trim().split(/\s+/).filter(Boolean);
  matchingCards = cards.filter(card => {
    const product = products.get(card.dataset.product);
    if (!product) return false;
    const text = searchable([product.title, product.description, product.category, product.group, ...product.variants.map(variant => variant.title)].join(' '));
    return (filter === 'all' || (product.group || card.dataset.group) === filter) && words.every(word => text.includes(word));
  });
  const showAll = expanded || filter !== 'all' || words.length > 0;
  const visible = new Set(showAll ? matchingCards : matchingCards.slice(0, 8));
  cards.forEach(card => { card.hidden = !visible.has(card); });
  filters.forEach(button => { button.setAttribute('aria-pressed', String(button.dataset.filter === filter)); });
  grid.hidden = shopView !== 'grid';
  swipeView.hidden = shopView !== 'swipe';
  $('#studio-count').textContent = matchingCards.length ? shopView === 'swipe' ? `${matchingCards.length} selections to explore` : `Showing ${visible.size} of ${matchingCards.length} selections` : 'No selections found. Try another search or category.';
  more.hidden = shopView === 'swipe' || showAll || matchingCards.length <= 8;
  renderDeck();
}
function resetCollection() {
  expanded = false;
  swipeIndex = 0;
  resetGesture();
  renderCollection();
}
search.addEventListener('input', resetCollection);
filters.forEach(button => button.addEventListener('click', () => { filter = button.dataset.filter; resetCollection(); }));
more.addEventListener('click', () => {
  const nextCard = cards.find(card => card.hidden);
  expanded = true;
  renderCollection();
  if (nextCard && !nextCard.hidden) nextCard.focus();
});

function renderDeck() {
  swipeIndex = Math.max(0, Math.min(swipeIndex, matchingCards.length - 1));
  const product = products.get(matchingCards[swipeIndex]?.dataset.product);
  deck.hidden = !product;
  swipeCard.hidden = !product;
  swipePrevious.disabled = !product || swipeIndex === 0;
  swipeNext.disabled = !product || swipeIndex === matchingCards.length - 1;
  updateDeckBusy();
  const image = $('#studio-swipe-image');
  if (!product) {
    image.removeAttribute('src');
    $('#studio-swipe-position').textContent = 'No matching plants. Try another search or category.';
    return;
  }
  const photo = product.images?.[0];
  image.hidden = !photo;
  if (photo) { image.src = photo.url; image.alt = photo.alt || product.title; }
  else image.removeAttribute('src');
  const prices = product.variants.map(variant => variant.priceMinor).filter(price => Number.isSafeInteger(price));
  const price = prices.length ? `${new Set(prices).size > 1 ? 'From ' : ''}${money(Math.min(...prices))}` : 'Price pending';
  $('#studio-swipe-name').textContent = product.title;
  $('#studio-swipe-price').textContent = price;
  $('#studio-swipe-category').textContent = product.category || '';
  swipeCard.setAttribute('aria-label', `View ${product.title}, ${price}`);
  $('#studio-swipe-position').textContent = `${swipeIndex + 1} of ${matchingCards.length} · ${product.title}`;
}
function changeView(view) {
  if (!['grid', 'swipe'].includes(view)) return;
  const active = document.activeElement;
  shopView = view;
  resetGesture();
  renderCollection();
  // An automatic breakpoint change must not leave keyboard focus in a hidden view.
  if (view === 'swipe' && grid.contains(active)) deck.focus({ preventScroll: true });
  if (view === 'grid' && swipeView.contains(active)) (cards.find(card => !card.hidden) || search).focus({ preventScroll: true });
}
narrowScreen.addEventListener('change', () => changeView(narrowScreen.matches ? 'swipe' : 'grid'));

function updateDeckBusy() {
  deck.setAttribute('aria-busy', String(Boolean(deckFlight)));
  swipeCard.setAttribute('aria-disabled', String(Boolean(deckFlight)));
  swipePrevious.setAttribute('aria-disabled', String(Boolean(deckFlight) || swipePrevious.disabled));
  swipeNext.setAttribute('aria-disabled', String(Boolean(deckFlight) || swipeNext.disabled));
}
function cancelDeckFlight() {
  const previous = deckFlight;
  if (!previous) return;
  deckFlight = null;
  previous.animations.forEach(animation => animation.cancel());
  previous.clone.remove();
  swipeCard.style.transition = previous.transition;
  updateDeckBusy();
}
function outgoingCard() {
  const clone = swipeCard.cloneNode(true);
  for (const [id, className] of [['studio-swipe-category', 'swipe-card-category'], ['studio-swipe-name', 'swipe-card-name'], ['studio-swipe-price', 'swipe-card-price']]) clone.querySelector('#' + id)?.classList.add(className);
  for (const element of [clone, ...clone.querySelectorAll('*')]) {
    for (const attribute of ['id', 'aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-activedescendant']) element.removeAttribute(attribute);
    if (element.hasAttribute('tabindex')) element.tabIndex = -1;
  }
  clone.classList.remove('is-dragging');
  clone.classList.add('studio-swipe-outgoing');
  clone.setAttribute('aria-hidden', 'true');
  clone.setAttribute('inert', '');
  clone.tabIndex = -1;
  clone.disabled = true;
  clone.style.width = `${swipeCard.offsetWidth}px`;
  clone.style.height = `${swipeCard.offsetHeight}px`;
  clone.style.transition = 'none';
  return clone;
}
function moveDeck(step) {
  if (deckFlight || shopView !== 'swipe') return;
  const active = document.activeElement;
  const next = Math.max(0, Math.min(matchingCards.length - 1, swipeIndex + step));
  if (!matchingCards.length || next === swipeIndex) { resetGesture(); return; }
  if (gesture) suppressSwipeClick = true;
  if (!reducedMotion.matches && typeof swipeCard.animate === 'function') {
    const rect = swipeCard.getBoundingClientRect();
    const start = getComputedStyle(swipeCard).transform;
    const clone = outgoingCard();
    const flight = { clone, animations: [], transition: swipeCard.style.transition };
    deckFlight = flight;
    // Cancel the drag's CSS snapback: the real next card stays still below the departing copy.
    swipeCard.style.transition = 'none';
    resetGesture();
    clone.style.transform = start === 'none' ? 'translateX(0px) rotate(0deg)' : start;
    deck.append(clone);
    swipeIndex = next;
    renderDeck();
    const direction = step > 0 ? -1 : 1;
    // Include card height so its rotated top corner also clears the viewport boundary.
    const distance = window.innerWidth + rect.width + rect.height * .3;
    try {
      flight.animations.push(clone.animate([
        { transform: clone.style.transform },
        { transform: `translateX(${direction * distance}px) rotate(${direction * 16}deg)` },
      ], { duration: 320, easing: 'cubic-bezier(.32,.05,.65,.35)', fill: 'forwards' }));
      flight.animations.push(swipeCard.animate([{ transform: 'scale(.97)' }, { transform: 'scale(1)' }], { duration: 320, easing: 'cubic-bezier(.2,.7,.2,1)' }));
      const finish = () => { if (deckFlight === flight) cancelDeckFlight(); };
      Promise.all(flight.animations.map(animation => animation.finished)).then(finish, finish);
    } catch {
      // Also observe any animation already started before an unsupported operation failed.
      flight.animations.forEach(animation => animation.finished.catch(() => {}));
      cancelDeckFlight();
    }
  } else {
    resetGesture();
    swipeIndex = next;
    renderDeck();
  }
  if (active === swipePrevious && swipePrevious.disabled || active === swipeNext && swipeNext.disabled) deck.focus({ preventScroll: true });
}
swipePrevious.addEventListener('click', () => moveDeck(-1));
swipeNext.addEventListener('click', () => moveDeck(1));
deck.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  event.preventDefault();
  moveDeck(event.key === 'ArrowLeft' ? -1 : 1);
});

function resetGesture(blockClick = false) {
  const previous = gesture;
  gesture = null;
  if (blockClick) suppressSwipeClick = true;
  swipeCard.classList.remove('is-dragging');
  swipeCard.style.removeProperty('transform');
  if (previous && swipeCard.hasPointerCapture(previous.id)) swipeCard.releasePointerCapture(previous.id);
}
// Pointer capture keeps a horizontal drag coherent; touch-action leaves native vertical scroll and pinch zoom available.
swipeCard.addEventListener('pointerdown', event => {
  if (shopView !== 'swipe' || !matchingCards.length || !event.isPrimary || event.button !== 0) return;
  if (deckFlight) { suppressSwipeClick = true; return; }
  suppressSwipeClick = false;
  const now = performance.now();
  gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, width: swipeCard.getBoundingClientRect().width, axis: null, startedAt: now, lastX: event.clientX, lastMovedAt: now };
  swipeCard.setPointerCapture(event.pointerId);
});
document.addEventListener('pointerdown', event => {
  if (gesture && event.pointerId !== gesture.id) resetGesture(true);
}, { capture: true });
swipeCard.addEventListener('pointermove', event => {
  if (!gesture || event.pointerId !== gesture.id) return;
  const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
  if (Math.abs(event.clientX - gesture.lastX) >= 1) gesture.lastMovedAt = performance.now();
  gesture.lastX = event.clientX;
  if (!gesture.axis) {
    if (Math.abs(dy) >= 12 && Math.abs(dy) > Math.abs(dx) * 1.35) { resetGesture(true); return; }
    // Let an initially diagonal thumb movement resolve before giving it to scrolling.
    if (Math.abs(dx) < 6 || Math.abs(dx) <= Math.abs(dy) * 1.1) return;
    gesture.axis = 'horizontal';
    swipeCard.classList.add('is-dragging');
  }
  if (event.cancelable) event.preventDefault();
  const atEdge = dx > 0 && swipeIndex === 0 || dx < 0 && swipeIndex === matchingCards.length - 1;
  const offset = Math.max(-gesture.width * .85, Math.min(gesture.width * .85, dx)) * (atEdge ? .25 : 1);
  const rotation = Math.max(-10, Math.min(10, offset / Math.max(1, gesture.width) * 10));
  if (!reducedMotion.matches) swipeCard.style.transform = `translateX(${offset}px) rotate(${rotation}deg)`;
});
swipeCard.addEventListener('pointerup', event => {
  if (!gesture || event.pointerId !== gesture.id) return;
  const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
  const now = performance.now(), elapsed = Math.max(1, now - gesture.startedAt);
  if (Math.abs(event.clientX - gesture.lastX) >= 1) gesture.lastMovedAt = now;
  const threshold = Math.max(28, Math.min(40, gesture.width * .1));
  const horizontal = Math.abs(dx) > Math.abs(dy) * 1.1;
  // A small flick needs speed and a fresh movement; a held short drag should snap back.
  const flick = Math.abs(dx) >= 24 && elapsed <= 240 && Math.abs(dx) / elapsed >= .25 && now - gesture.lastMovedAt <= 80;
  const completed = horizontal && (Math.abs(dx) >= threshold || flick);
  const moved = gesture.axis === 'horizontal' || Math.max(Math.abs(dx), Math.abs(dy)) >= 10;
  if (moved) suppressSwipeClick = true;
  if (completed) moveDeck(dx < 0 ? 1 : -1);
  else resetGesture(moved);
});
swipeCard.addEventListener('pointercancel', event => { if (gesture?.id === event.pointerId) resetGesture(true); });
swipeCard.addEventListener('lostpointercapture', event => { if (gesture?.id === event.pointerId) resetGesture(true); });
swipeCard.addEventListener('dragstart', event => event.preventDefault());
swipeCard.addEventListener('click', event => {
  if (deckFlight) { event.preventDefault(); return; }
  if (suppressSwipeClick && event.detail !== 0) { suppressSwipeClick = false; event.preventDefault(); return; }
  suppressSwipeClick = false;
  const id = matchingCards[swipeIndex]?.dataset.product;
  if (id) openProduct(id, swipeCard);
});
function cancelDeckActivity() { cancelDeckFlight(); resetGesture(true); }
window.addEventListener('blur', cancelDeckActivity);
window.addEventListener('pagehide', cancelDeckActivity);
window.addEventListener('resize', () => {
  if (window.innerWidth === viewportWidth) return;
  viewportWidth = window.innerWidth;
  cancelDeckActivity();
});
reducedMotion.addEventListener('change', cancelDeckActivity);
document.addEventListener('visibilitychange', () => { if (document.hidden) cancelDeckActivity(); });

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
  const candidates = [element, shopView === 'swipe' ? swipeCard : cards.find(card => !card.hidden), search, $('#studio-menu-toggle')];
  const target = candidates.find(visible);
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
  productDialog.scrollTop = 0;
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
  bagDialog.scrollTop = 0;
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
