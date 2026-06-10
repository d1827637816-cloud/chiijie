/**
 * LUXE.M Checkout Logic
 * Handles multi-step form, validation, cart, vouchers, and order placement.
 */

// --- Load cart from localStorage ---
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let discount = 0;
let currentStep = 1;
const ORDER_HISTORY_KEY = 'orderHistory';

function loadOrderHistory() {
    const raw = localStorage.getItem(ORDER_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
}

function saveOrderHistory(history) {
    localStorage.setItem(ORDER_HISTORY_KEY, JSON.stringify(history));
}

function addOrderToHistory(order) {
    const history = loadOrderHistory();
    history.unshift(order);
    saveOrderHistory(history);
}

function getStatusStages() {
    return [
        { status: 'Pesanan diterima', location: 'Gudang LUXE.M' },
        { status: 'Diproses', location: 'Pusat Pemenuhan' },
        { status: 'Dikemas', location: 'Area Pengemasan' },
        { status: 'Dikirim', location: 'Perjalanan menuju alamat' },
        { status: 'Tiba di tujuan', location: 'Lokasi tujuan' }
    ];
}

function formatDateTime(value) {
    const date = new Date(value);
    return date.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Valid promo codes
const VOUCHERS = {
    'LUXE10': { type: 'percent', value: 10, label: 'Diskon 10%' },
    'GRATIS': { type: 'fixed', value: 50000, label: 'Diskon Rp 50.000' },
    'NEWUSER': { type: 'percent', value: 15, label: 'Diskon 15%' },
};

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    if (cart.length === 0) {
        // Jika cart kosong, redirect ke halaman utama
        const warning = document.createElement('div');
        warning.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:white;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:1rem;z-index:9999;font-family: Outfit, sans-serif;';
        warning.innerHTML = `<i class="fa-solid fa-cart-shopping" style="font-size:3rem;color:#ccc;"></i><h2>Keranjang Anda kosong</h2><a href="index.html" style="padding:1rem 2rem;background:#000;color:white;text-decoration:none;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Mulai Belanja</a>`;
        document.body.appendChild(warning);
        return;
    }
    renderSummary();
    bindEvents();
});

// --- RENDER ORDER SUMMARY ---
function renderSummary() {
    const container = document.getElementById('summary-items');
    let subtotal = 0;
    let html = '';

    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        subtotal += itemTotal;
        html += `
        <div class="summary-item">
            <img src="${item.img}" alt="${item.name}">
            <div class="summary-item-info">
                <small>${item.brand}</small>
                <p>${item.name}</p>
                <span>Qty: ${item.quantity} × Rp ${item.price.toLocaleString('id-ID')}</span>
            </div>
        </div>`;
    });

    container.innerHTML = html;
    updateTotals(subtotal);
}

function getShippingCost() {
    const selected = document.querySelector('input[name="shipping"]:checked');
    return selected ? parseInt(selected.value) : 15000;
}

function updateTotals(subtotal) {
    if (subtotal === undefined) {
        subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    }
    const shipping = getShippingCost();
    const total = subtotal + shipping - discount;

    document.getElementById('summary-subtotal').textContent = `Rp ${subtotal.toLocaleString('id-ID')}`;
    document.getElementById('summary-shipping').textContent = `Rp ${shipping.toLocaleString('id-ID')}`;
    document.getElementById('summary-total').textContent = `Rp ${Math.max(0, total).toLocaleString('id-ID')}`;

    if (discount > 0) {
        document.getElementById('discount-line').style.display = 'flex';
        document.getElementById('summary-discount').textContent = `- Rp ${discount.toLocaleString('id-ID')}`;
    }
}

// --- BIND EVENTS ---
function bindEvents() {
    // Update shipping cost when option changes
    document.querySelectorAll('input[name="shipping"]').forEach(radio => {
        radio.addEventListener('change', updateTotals);
    });

    // Payment method detail toggle
    document.querySelectorAll('input[name="payment"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const detail = document.getElementById('bank-detail');
            const val = radio.value;
            if (val === 'bca' || val === 'mandiri') {
                detail.style.display = 'block';
                detail.querySelector('strong').textContent =
                    val === 'bca' ? '1234-5678-9012' : '9876-5432-1098';
                detail.querySelector('.bank-info:nth-child(2) strong').textContent = 'PT LUXE.M INDONESIA';
            } else {
                detail.style.display = 'none';
            }
        });
    });

    // Voucher
    document.getElementById('apply-voucher').addEventListener('click', applyVoucher);
    document.getElementById('voucher-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') applyVoucher();
    });

    // Place Order
    document.getElementById('place-order-btn').addEventListener('click', placeOrder);
}

// --- STEP NAVIGATION ---
function goToStep(step) {
    // Validate current step before proceeding
    if (step > currentStep && !validateStep(currentStep)) return;

    // Update indicators
    document.getElementById(`step-indicator-${currentStep}`).classList.remove('active');
    document.getElementById(`step-indicator-${currentStep}`).classList.add('done');
    document.getElementById(`step-indicator-${step}`).classList.remove('done');
    document.getElementById(`step-indicator-${step}`).classList.add('active');

    // Hide old, show new
    document.getElementById(`step-${currentStep}`).classList.remove('active-step');
    document.getElementById(`step-${step}`).classList.add('active-step');

    // If going to step 3, render review
    if (step === 3) renderReview();

    currentStep = step;

    // Scroll to top of form
    document.querySelector('.checkout-left').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// --- FORM VALIDATION ---
function validateStep(step) {
    if (step === 1) {
        const fields = ['first-name', 'last-name', 'email', 'phone', 'address', 'city', 'province', 'postal'];
        for (const id of fields) {
            const el = document.getElementById(id);
            if (!el.value.trim()) {
                el.focus();
                el.style.borderColor = '#e74c3c';
                setTimeout(() => (el.style.borderColor = ''), 2000);
                showToast('Mohon lengkapi semua informasi pengiriman', 'error');
                return false;
            }
        }
        const emailVal = document.getElementById('email').value;
        if (!emailVal.includes('@') || !emailVal.includes('.')) {
            document.getElementById('email').style.borderColor = '#e74c3c';
            showToast('Format email tidak valid', 'error');
            return false;
        }
    }
    return true;
}

// --- RENDER REVIEW (Step 3) ---
function renderReview() {
    const firstName = document.getElementById('first-name').value;
    const lastName = document.getElementById('last-name').value;
    const address = document.getElementById('address').value;
    const city = document.getElementById('city').value;
    const province = document.getElementById('province').value;
    const postal = document.getElementById('postal').value;
    const phone = document.getElementById('phone').value;
    const email = document.getElementById('email').value;

    const shippingLabel = document.querySelector('input[name="shipping"]:checked').closest('label').querySelector('strong').textContent;
    const paymentLabel = document.querySelector('input[name="payment"]:checked').closest('label').querySelector('span').textContent;

    document.getElementById('order-review').innerHTML = `
        <div class="review-section">
            <h4>Dikirim Ke</h4>
            <p><strong>${firstName} ${lastName}</strong><br>
            ${address}, ${city}, ${province} ${postal}<br>
            📞 ${phone}<br>
            ✉️ ${email}</p>
        </div>
        <div class="review-section">
            <h4>Layanan Pengiriman</h4>
            <p>${shippingLabel}</p>
        </div>
        <div class="review-section">
            <h4>Metode Pembayaran</h4>
            <p>${paymentLabel}</p>
        </div>
    `;
}

// --- VOUCHER ---
function applyVoucher() {
    const code = document.getElementById('voucher-input').value.trim().toUpperCase();
    const msg = document.getElementById('voucher-msg');
    const promo = VOUCHERS[code];

    if (!promo) {
        msg.textContent = '❌ Kode promo tidak valid.';
        msg.style.color = '#e74c3c';
        discount = 0;
        updateTotals();
        return;
    }

    const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
    if (promo.type === 'percent') {
        discount = Math.round(subtotal * promo.value / 100);
    } else {
        discount = promo.value;
    }

    msg.textContent = `✅ ${promo.label} berhasil diterapkan!`;
    msg.style.color = '#27ae60';
    updateTotals();
    showToast(`Promo "${code}" berhasil digunakan!`, 'success');
}

// --- PLACE ORDER ---
function placeOrder() {
    const btn = document.getElementById('place-order-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memproses...';

    // Simulate processing delay
    setTimeout(() => {
        // Generate order ID
        const orderId = 'LXM-' + Date.now().toString().slice(-8).toUpperCase();
        const shippingCost = getShippingCost();
        const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const total = subtotal + shippingCost - discount;

        const order = {
            id: orderId,
            createdAt: new Date().toISOString(),
            customer: {
                firstName: document.getElementById('first-name').value,
                lastName: document.getElementById('last-name').value,
                email: document.getElementById('email').value,
                phone: document.getElementById('phone').value,
                address: document.getElementById('address').value,
                city: document.getElementById('city').value,
                province: document.getElementById('province').value,
                postal: document.getElementById('postal').value
            },
            shippingMethod: document.querySelector('input[name="shipping"]:checked').closest('label').querySelector('strong').textContent,
            paymentMethod: document.querySelector('input[name="payment"]:checked').closest('label').querySelector('span').textContent,
            items: cart.map(item => ({ id: item.id, name: item.name, brand: item.brand, price: item.price, quantity: item.quantity })),
            subtotal: subtotal,
            shippingCost: shippingCost,
            discount: discount,
            total: total,
            statusIndex: 0,
            statusTimeline: getStatusStages(),
            history: [{
                status: 'Pesanan diterima',
                location: 'Gudang LUXE.M',
                time: new Date().toISOString()
            }],
            lastUpdated: new Date().toISOString()
        };

        addOrderToHistory(order);
        localStorage.removeItem('cart');
        localStorage.setItem('latestOrderId', orderId);

        document.getElementById('order-id-display').textContent = `No. Pesanan: ${orderId}`;
        const trackLink = document.getElementById('track-order-link');
        if (trackLink) {
            trackLink.href = `status.html?id=${orderId}`;
        }
        document.getElementById('success-modal').classList.add('active');

        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-lock"></i> Bayar Sekarang';
    }, 1800);
}

// --- TOAST NOTIFICATION ---
function showToast(message, type = 'info') {
    const existing = document.getElementById('toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'toast';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 2rem;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === 'error' ? '#e74c3c' : '#27ae60'};
        color: white;
        padding: 1rem 2rem;
        font-family: Outfit, sans-serif;
        font-weight: 600;
        font-size: 0.9rem;
        z-index: 9999;
        border-radius: 2px;
        animation: slideUp 0.4s ease;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Expose for HTML onclick
window.goToStep = goToStep;
