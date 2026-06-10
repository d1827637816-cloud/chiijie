/**
 * LUXE.M Checkout Logic - WITH REAL PAYMENT INTEGRATION
 * Handles multi-step form, validation, cart, vouchers, and Midtrans payment.
 */

// --- Load cart from localStorage ---
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let discount = 0;
let currentStep = 1;
let shippingCosts = {};
let currentShippingCost = 0;

const API_BASE = window.location.origin;
const ORDER_HISTORY_KEY = 'orderHistory';

// --- Initialize ---
document.addEventListener('DOMContentLoaded', async () => {
    if (cart.length === 0) {
        const warning = document.createElement('div');
        warning.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:white;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:1rem;z-index:9999;font-family: Outfit, sans-serif;';
        warning.innerHTML = `<i class="fa-solid fa-cart-shopping" style="font-size:3rem;color:#ccc;"></i><h2>Keranjang Anda kosong</h2><a href="index.html" style="padding:1rem 2rem;background:#000;color:white;text-decoration:none;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Mulai Belanja</a>`;
        document.body.appendChild(warning);
        return;
    }

    // Load provinces
    await loadProvinces();
    
    renderSummary();
    bindEvents();
});

// --- Load provinces from API ---
async function loadProvinces() {
    try {
        const response = await fetch(`${API_BASE}/api/provinces`);
        const provinces = await response.json();
        
        const provinceSelect = document.getElementById('province');
        provinces.forEach(prov => {
            const option = document.createElement('option');
            option.value = prov;
            option.textContent = prov;
            provinceSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading provinces:', error);
        showToast('Gagal memuat data provinsi', 'error');
    }
}

// --- Load cities for selected province ---
async function loadCities(province) {
    if (!province) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/cities/${encodeURIComponent(province)}`);
        const cities = await response.json();
        
        const cityInput = document.getElementById('city');
        cityInput.innerHTML = '';
        
        // Add datalist for autocomplete
        let datalist = document.getElementById('city-list');
        if (datalist) datalist.remove();
        
        datalist = document.createElement('datalist');
        datalist.id = 'city-list';
        cities.forEach(city => {
            const option = document.createElement('option');
            option.value = city;
            datalist.appendChild(option);
        });
        document.body.appendChild(datalist);
        
        cityInput.setAttribute('list', 'city-list');
    } catch (error) {
        console.error('Error loading cities:', error);
        showToast('Gagal memuat data kota', 'error');
    }
}

// --- Load shipping costs for province/city ---
async function loadShippingCosts(province, city) {
    if (!province || !city) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/shipping-costs?province=${encodeURIComponent(province)}&city=${encodeURIComponent(city)}`);
        const costs = await response.json();
        
        if (costs.length > 0) {
            shippingCosts = costs[0];
            renderShippingOptions();
            updateTotals();
        } else {
            showToast('Jenis pengiriman tidak tersedia untuk area ini', 'error');
        }
    } catch (error) {
        console.error('Error loading shipping costs:', error);
        showToast('Gagal memuat biaya pengiriman', 'error');
    }
}

// --- Render shipping options based on costs ---
function renderShippingOptions() {
    const container = document.getElementById('shipping-options');
    if (!container || !shippingCosts.regular_cost) return;
    
    container.innerHTML = `
        <label class="shipping-option">
            <input type="radio" name="shipping" value="${shippingCosts.regular_cost}" data-type="reguler" checked>
            <div class="shipping-info">
                <strong>Reguler (3-5 hari)</strong>
                <span>Rp ${shippingCosts.regular_cost.toLocaleString('id-ID')}</span>
            </div>
        </label>
        <label class="shipping-option">
            <input type="radio" name="shipping" value="${shippingCosts.express_cost}" data-type="express">
            <div class="shipping-info">
                <strong>Express (1-2 hari)</strong>
                <span>Rp ${shippingCosts.express_cost.toLocaleString('id-ID')}</span>
            </div>
        </label>
        <label class="shipping-option">
            <input type="radio" name="shipping" value="${shippingCosts.overnight_cost}" data-type="overnight">
            <div class="shipping-info">
                <strong>Overnight (Besok Pagi)</strong>
                <span>Rp ${shippingCosts.overnight_cost.toLocaleString('id-ID')}</span>
            </div>
        </label>
    `;
    
    // Re-bind shipping change events
    document.querySelectorAll('input[name="shipping"]').forEach(radio => {
        radio.addEventListener('change', updateTotals);
    });
}

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

// --- Get shipping cost ---
function getShippingCost() {
    const selected = document.querySelector('input[name="shipping"]:checked');
    return selected ? parseInt(selected.value) : 0;
}

// --- Update totals ---
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

    currentShippingCost = shipping;
}

// --- BIND EVENTS ---
function bindEvents() {
    // Province change
    document.getElementById('province').addEventListener('change', (e) => {
        loadCities(e.target.value);
    });
    
    // City change
    document.getElementById('city').addEventListener('blur', (e) => {
        if (e.target.value) {
            loadShippingCosts(document.getElementById('province').value, e.target.value);
        }
    });

    // Update shipping cost when option changes
    document.querySelectorAll('input[name="shipping"]').forEach(radio => {
        radio.addEventListener('change', updateTotals);
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
    if (step > currentStep && !validateStep(currentStep)) return;

    document.getElementById(`step-indicator-${currentStep}`).classList.remove('active');
    document.getElementById(`step-indicator-${currentStep}`).classList.add('done');
    document.getElementById(`step-indicator-${step}`).classList.remove('done');
    document.getElementById(`step-indicator-${step}`).classList.add('active');

    document.getElementById(`step-${currentStep}`).classList.remove('active-step');
    document.getElementById(`step-${step}`).classList.add('active-step');

    if (step === 3) renderReview();

    currentStep = step;
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

    const shippingOption = document.querySelector('input[name="shipping"]:checked');
    const shippingLabel = shippingOption ? shippingOption.closest('label')?.querySelector('strong')?.textContent || 'Pengiriman' : 'Pengiriman';

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
            <p>Midtrans Payment Gateway</p>
        </div>
    `;
}

// --- VOUCHERS ---
const VOUCHERS = {
    'LUXE10': { type: 'percent', value: 10, label: 'Diskon 10%' },
    'GRATIS': { type: 'fixed', value: 50000, label: 'Diskon Rp 50.000' },
    'NEWUSER': { type: 'percent', value: 15, label: 'Diskon 15%' },
};

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

// --- PLACE ORDER & INITIATE PAYMENT ---
async function placeOrder() {
    const btn = document.getElementById('place-order-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memproses...';

    try {
        const firstName = document.getElementById('first-name').value;
        const lastName = document.getElementById('last-name').value;
        const email = document.getElementById('email').value;
        const phone = document.getElementById('phone').value;
        const address = document.getElementById('address').value;
        const city = document.getElementById('city').value;
        const province = document.getElementById('province').value;
        const postal = document.getElementById('postal').value;
        const shippingMethod = document.querySelector('input[name="shipping"]:checked')?.dataset?.type || 'reguler';

        const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const shippingCost = getShippingCost();
        const total = subtotal + shippingCost - discount;

        // Step 1: Create order in database
        const orderResponse = await fetch(`${API_BASE}/api/orders/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                firstName,
                lastName,
                email,
                phone,
                address,
                city,
                province,
                postal,
                shippingMethod,
                cart,
                subtotal,
                shippingCost,
                discount
            })
        });

        const orderData = await orderResponse.json();
        if (!orderData.success) {
            throw new Error(orderData.error || 'Gagal membuat pesanan');
        }

        const orderId = orderData.orderId;

        // Step 2: Create payment token
        const paymentResponse = await fetch(`${API_BASE}/api/payment/create-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                orderId,
                amount: total,
                customerEmail: email,
                customerName: `${firstName} ${lastName}`,
                customerPhone: phone
            })
        });

        const paymentData = await paymentResponse.json();
        if (!paymentData.success) {
            throw new Error(paymentData.error || 'Gagal membuat token pembayaran');
        }

        // Step 3: Save order info to localStorage
        localStorage.removeItem('cart');
        localStorage.setItem('currentOrderId', orderId);
        localStorage.setItem('currentOrderTotal', total);

        // Step 4: Redirect to Midtrans payment
        if (window.snap) {
            window.snap.pay(paymentData.snapToken, {
                onSuccess: function(result) {
                    window.location.href = `payment-status.html?order_id=${orderId}&status=success`;
                },
                onPending: function(result) {
                    window.location.href = `payment-status.html?order_id=${orderId}&status=pending`;
                },
                onError: function(result) {
                    window.location.href = `payment-status.html?order_id=${orderId}&status=error`;
                },
                onClose: function() {
                    showToast('Pembayaran dibatalkan', 'error');
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fa-solid fa-lock"></i> Bayar Sekarang';
                }
            });
        } else {
            // Fallback: redirect to Midtrans
            window.location.href = paymentData.redirectUrl;
        }
    } catch (error) {
        console.error('Order error:', error);
        showToast(error.message || 'Gagal memproses pesanan', 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-lock"></i> Bayar Sekarang';
    }
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
