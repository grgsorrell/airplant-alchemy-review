import { readReviewCart, quoteReviewCart } from './review-client.mjs';

// Public design review: this module has no payment transport or external requests.
const config = JSON.parse(document.getElementById('paypal-checkout-config').textContent);
if (config.staticPreview !== true || config.enabled !== false || config.mode !== 'sandbox') throw Error('A disabled checkout preview is required.');
const $ = id => document.getElementById(id);
const key = `commerce.review-bag.v1:${config.basePath}:airplant`;
const money = amount => amount === null ? 'Price pending' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount / 100);
function render() {
  try {
    const lines = readReviewCart(localStorage.getItem(key), config.catalog);
    const quote = quoteReviewCart(lines, config.catalog);
    const rows = quote.lines.map(line => {
      const row = document.createElement('article');
      const copy = document.createElement('div');
      const title = document.createElement('h3'); title.textContent = line.title;
      const detail = document.createElement('p'); detail.textContent = `${line.quantity} × ${line.variantTitle} · ${money(line.unitPriceMinor)} each`;
      const price = document.createElement('strong'); price.textContent = money(line.lineTotalMinor);
      copy.append(title, detail); row.append(copy, price); return row;
    });
    if (!rows.length) {
      const empty = document.createElement('p'); empty.textContent = 'Your bag is empty. Add a plant to preview checkout.'; rows.push(empty);
    }
    $('paypal-lines').replaceChildren(...rows);
    $('paypal-subtotal').textContent = money(quote.subtotalMinor);
    $('paypal-total').textContent = 'Pending tax';
    $('paypal-shipping').textContent = money(0);
    $('paypal-tax').textContent = 'Not calculated';
    $('paypal-status').textContent = 'Checkout preview only. No payment or order can be submitted here.';
    $('paypal-error').textContent = '';
  } catch {
    $('paypal-error').textContent = 'Your browser could not read the review bag. Allow site storage, then return to the collection.';
  }
  $('paypal-submit').disabled = true;
  $('paypal-summary').setAttribute('aria-busy', 'false');
}
window.addEventListener('storage', event => { if (event.key === key || event.key === null) render(); });
window.addEventListener('pageshow', event => { if (event.persisted) render(); });
render();
