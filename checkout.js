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
let midtransClientKey = '';
let snapScriptUrl = '';
let snapLoaded = false;

const API_BASE = (() => {
    const origin = window.location.origin || '';
    if (origin.includes('github.io') || origin.includes('page')) {
        console.warn('Detected GitHub Pages origin, using local API backend.');
        return 'http://localhost:3000';
    }
    if (origin && origin !== 'null') {
        return origin;
    }
    return 'http://localhost:3000';
})();
const ORDER_HISTORY_KEY = 'orderHistory';

const SHIPPING_FALLBACK = [
    { province: 'DKI Jakarta', city: 'Jakarta Pusat', regular_cost: 15000, express_cost: 25000, overnight_cost: 40000 },
    { province: 'DKI Jakarta', city: 'Jakarta Utara', regular_cost: 15000, express_cost: 25000, overnight_cost: 40000 },
    { province: 'DKI Jakarta', city: 'Jakarta Timur', regular_cost: 15000, express_cost: 25000, overnight_cost: 40000 },
    { province: 'DKI Jakarta', city: 'Jakarta Barat', regular_cost: 15000, express_cost: 25000, overnight_cost: 40000 },
    { province: 'DKI Jakarta', city: 'Jakarta Selatan', regular_cost: 15000, express_cost: 25000, overnight_cost: 40000 },
    { province: 'Jawa Barat', city: 'Bandung', regular_cost: 20000, express_cost: 30000, overnight_cost: 45000 },
    { province: 'Jawa Barat', city: 'Bekasi', regular_cost: 18000, express_cost: 28000, overnight_cost: 42000 },
    { province: 'Jawa Barat', city: 'Bogor', regular_cost: 18000, express_cost: 28000, overnight_cost: 42000 },
    { province: 'Jawa Barat', city: 'Depok', regular_cost: 18000, express_cost: 28000, overnight_cost: 42000 },
    { province: 'Jawa Barat', city: 'Tangerang', regular_cost: 18000, express_cost: 28000, overnight_cost: 42000 },
    { province: 'Jawa Tengah', city: 'Semarang', regular_cost: 25000, express_cost: 35000, overnight_cost: 50000 },
    { province: 'Jawa Tengah', city: 'Yogyakarta', regular_cost: 28000, express_cost: 38000, overnight_cost: 53000 }
];

function getFallbackProvinces() {
    return Array.from(new Set(SHIPPING_FALLBACK.map(item => item.province))).sort();
}

function getFallbackCities(province) {
    return SHIPPING_FALLBACK.filter(item => item.province.toLowerCase() === province.toLowerCase()).map(item => item.city).sort();
}

function getFallbackShippingCosts(province, city) {
    const provinceLower = province.toLowerCase();
    const cityLower = city.toLowerCase();
    return SHIPPING_FALLBACK.filter(item => {
        return item.province.toLowerCase() === provinceLower && item.city.toLowerCase() === cityLower;
    });
}

function getCityListValues() {
    const datalist = document.getElementById('city-list');
    return datalist ? Array.from(datalist.options).map(opt => opt.value.toLowerCase()) : [];
}

function isValidCity(city) {
    if (!city) return false;
    return getCityListValues().includes(city.trim().toLowerCase());
}

// --- Initialize ---
document.addEventListener('DOMContentLoaded', async () => {
    if (cart.length === 0) {
        const warning = document.createElement('div');
        warning.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:white;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:1rem;z-index:9999;font-family: Outfit, sans-serif;';
        warning.innerHTML = `<i class="fa-solid fa-cart-shopping" style="font-size:3rem;color:#ccc;"></i><h2>Keranjang Anda kosong</h2><a href="index.html" style="padding:1rem 2rem;background:#000;color:white;text-decoration:none;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Mulai Belanja</a>`;
        document.body.appendChild(warning);
        return;
    }

    // Load provinces and payment configuration
    await loadProvinces();
    await loadPaymentConfig();
    await loadSnapLibrary();
    updatePaymentDetail();
    
    renderSummary();
    bindEvents();
});

// --- Load provinces from API ---
async function loadProvinces() {
    const provinceSelect = document.getElementById('province');
    provinceSelect.innerHTML = '<option value="">Pilih Provinsi</option>';

    try {
        const response = await fetch(`${API_BASE}/api/provinces`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const provinces = await response.json();
        if (!Array.isArray(provinces) || provinces.length === 0) {
            throw new Error('No provinces returned');
        }

        provinces.forEach(prov => {
            const option = document.createElement('option');
            option.value = prov;
            option.textContent = prov;
            provinceSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading provinces:', error);
        const provinces = getFallbackProvinces();
        provinces.forEach(prov => {
            const option = document.createElement('option');
            option.value = prov;
            option.textContent = prov;
            provinceSelect.appendChild(option);
        });
        showToast('Menggunakan daftar provinsi cadangan', 'warning');
    }
}

// --- Load cities for selected province ---
async function loadCities(province) {
    const cityInput = document.getElementById('city');
    cityInput.value = '';
    cityInput.placeholder = 'Pilih kota dari daftar';
    cityInput.removeAttribute('list');

    if (!province) {
        cityInput.placeholder = 'Pilih provinsi terlebih dahulu';
        cityInput.disabled = true;
        cityInput.removeAttribute('list');
        renderShippingOptions();
        return;
    }

    cityInput.disabled = false;
    cityInput.placeholder = 'Ketik atau pilih kota';

    try {
        const response = await fetch(`${API_BASE}/api/cities/${encodeURIComponent(province)}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const cities = await response.json();
        if (!Array.isArray(cities) || cities.length === 0) {
            throw new Error('No cities returned');
        }

        let datalist = document.getElementById('city-list');
        if (!datalist) {
            datalist = document.createElement('datalist');
            datalist.id = 'city-list';
            document.body.appendChild(datalist);
        }
        datalist.innerHTML = '';
        cities.forEach(city => {
            const option = document.createElement('option');
            option.value = city;
            datalist.appendChild(option);
        });
        cityInput.setAttribute('list', 'city-list');
        if (cities.length === 0) {
            showToast(`Belum ada data kota untuk provinsi ${province}`, 'error');
        }
    } catch (error) {
        console.error('Error loading cities:', error);
        const cities = getFallbackCities(province);
        let datalist = document.getElementById('city-list');
        if (!datalist) {
            datalist = document.createElement('datalist');
            datalist.id = 'city-list';
            document.body.appendChild(datalist);
        }
        datalist.innerHTML = '';
        cities.forEach(city => {
            const option = document.createElement('option');
            option.value = city;
            datalist.appendChild(option);
        });
        cityInput.setAttribute('list', 'city-list');
        if (cities.length === 0) {
            showToast(`Belum ada daftar kota untuk provinsi ${province}`, 'warning');
        } else {
            showToast('Menggunakan daftar kota cadangan', 'warning');
        }
    }
}

// --- Load shipping costs for province/city ---
async function loadShippingCosts(province, city) {
    shippingCosts = {};
    const trimmedCity = city ? city.trim() : '';
    if (!province || !trimmedCity) {
        renderShippingOptions();
        updateTotals();
        return;
    }

    if (!isValidCity(trimmedCity)) {
        renderShippingOptions();
        updateTotals();
        showToast('Pilih kota yang valid dari daftar kota', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/shipping-costs?province=${encodeURIComponent(province)}&city=${encodeURIComponent(city)}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const costs = await response.json();
        if (Array.isArray(costs) && costs.length > 0) {
            shippingCosts = costs[0];
            renderShippingOptions();
            updateTotals();
            return;
        }

        throw new Error('No shipping costs returned');
    } catch (error) {
        console.error('Error loading shipping costs:', error);
        const fallback = getFallbackShippingCosts(province, city);
        if (fallback.length > 0) {
            shippingCosts = fallback[0];
            renderShippingOptions();
            updateTotals();
            showToast('Menggunakan ongkos kirim cadangan', 'warning');
        } else {
            shippingCosts = {};
            renderShippingOptions();
            updateTotals();
            showToast('Ongkos kirim belum tersedia untuk kota/provinsi ini', 'error');
        }
    }
}

// --- Load Midtrans payment configuration ---
async function loadPaymentConfig() {
    try {
        const response = await fetch(`${API_BASE}/api/payment/config`);
        const config = await response.json();
        if (config && config.clientKey) {
            midtransClientKey = config.clientKey;
            snapScriptUrl = config.snapUrl || 'https://app.sandbox.midtrans.com/snap/snap.js';
        } else {
            midtransClientKey = '';
            snapScriptUrl = '';
        }
    } catch (error) {
        console.error('Error loading payment configuration:', error);
        midtransClientKey = '';
        snapScriptUrl = '';
        showToast('Gagal memuat konfigurasi pembayaran', 'error');
    }
}

async function loadSnapLibrary() {
    if (!midtransClientKey || snapLoaded || !snapScriptUrl) return;

    return new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-midtrans-snap]');
        if (existing) {
            snapLoaded = true;
            return resolve();
        }

        const script = document.createElement('script');
        script.src = snapScriptUrl;
        script.dataset.midtransSnap = 'true';
        script.dataset.clientKey = midtransClientKey;
        script.async = true;
        script.onload = () => {
            snapLoaded = true;
            resolve();
        };
        script.onerror = () => {
            console.warn('Library Midtrans gagal dimuat, akan menggunakan fallback pembayaran lokal.');
            resolve();
        };
        document.head.appendChild(script);
    });
}

function updatePaymentDetail() {
    const selected = document.querySelector('input[name="payment"]:checked');
    const paymentDetail = document.getElementById('payment-detail');
    if (!paymentDetail) return;

    const method = selected ? selected.value : 'bank_transfer_bca';
    const labels = {
        bank_transfer_bca: {
            title: 'Transfer Bank BCA',
            description: 'Gunakan virtual account BCA di halaman pembayaran. Transfer otomatis tercatat segera setelah sukses.'
        },
        bank_transfer_mandiri: {
            title: 'Transfer Bank Mandiri',
            description: 'Gunakan virtual account Mandiri. Ikuti instruksi pada halaman pembayaran untuk menyelesaikan transfer.'
        },
        gopay: {
            title: 'GoPay',
            description: 'Bayar dengan GoPay. Pastikan saldo tersedia di aplikasi GoPay Anda.'
        },
        ovo: {
            title: 'OVO',
            description: 'Bayar dengan OVO. Ikuti instruksi pada halaman pembayaran Midtrans untuk menyelesaikan transaksi.'
        },
        dana: {
            title: 'DANA',
            description: 'Bayar dengan DANA. Pastikan akun DANA sudah terhubung dan saldo cukup.'
        },
        qris: {
            title: 'QRIS',
            description: 'Bayar dengan QRIS. Scan QR code yang ditampilkan oleh Midtrans untuk menyelesaikan pembayaran.'
        }
    };

    const selectedLabel = labels[method] || labels.bank_transfer_bca;
    paymentDetail.innerHTML = `
        <p><strong>${selectedLabel.title}</strong></p>
        <p>${selectedLabel.description}</p>
        <p class="note">⚠️ Pastikan memilih metode pembayaran yang sesuai saat menyelesaikan pesanan.</p>
    `;
}

// --- Render shipping options based on costs ---
function renderShippingOptions() {
    const container = document.getElementById('shipping-options');
    if (!container) return;

    if (!shippingCosts || !shippingCosts.regular_cost) {
        container.innerHTML = `
        <div class="shipping-placeholder" style="padding:1.5rem; border:1px dashed #ccc; color:#555; text-align:center;">
            Pilih provinsi dan kota untuk melihat tarif ongkos kirim.
        </div>`;
        currentShippingCost = 0;
        return;
    }

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
        shippingCosts = {};
        renderShippingOptions();
        loadCities(e.target.value);
    });
    
    // City change
    const cityInput = document.getElementById('city');
    const loadCityShipping = (value) => {
        const trimmedCity = value.trim();
        if (!trimmedCity) {
            shippingCosts = {};
            renderShippingOptions();
            updateTotals();
            return;
        }

        if (isValidCity(trimmedCity)) {
            loadShippingCosts(document.getElementById('province').value, trimmedCity);
        }
    };

    cityInput.addEventListener('blur', (e) => loadCityShipping(e.target.value));
    cityInput.addEventListener('change', (e) => loadCityShipping(e.target.value));
    cityInput.addEventListener('input', (e) => loadCityShipping(e.target.value));

    // Update shipping cost when option changes
    document.querySelectorAll('input[name="shipping"]').forEach(radio => {
        radio.addEventListener('change', updateTotals);
    });

    // Payment method selection
    document.querySelectorAll('input[name="payment"]').forEach(radio => {
        radio.addEventListener('change', () => {
            updatePaymentDetail();
            renderSummary();
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
        if (!shippingCosts || !shippingCosts.regular_cost) {
            showToast('Pilih provinsi dan kota untuk memuat ongkir regional', 'error');
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
    const shippingCost = getShippingCost();

    const paymentOption = document.querySelector('input[name="payment"]:checked');
    const paymentMethodLabel = paymentOption ? paymentOption.closest('label')?.querySelector('span')?.textContent : 'Metode Pembayaran';

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
            <p>${shippingLabel} - Rp ${shippingCost.toLocaleString('id-ID')}</p>
        </div>
        <div class="review-section">
            <h4>Metode Pembayaran</h4>
            <p>${paymentMethodLabel}</p>
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
        const paymentMethod = document.querySelector('input[name="payment"]:checked')?.value || 'bank_transfer_bca';

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
                paymentMethod,
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
        if (!window.snap && !snapLoaded) {
            await loadSnapLibrary();
        }

        const paymentResponse = await fetch(`${API_BASE}/api/payment/create-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                orderId,
                amount: total,
                customerEmail: email,
                customerName: `${firstName} ${lastName}`,
                customerPhone: phone,
                paymentMethod
            })
        });

        const paymentData = await paymentResponse.json();
        if (!paymentData.success) {
            console.warn('Payment token creation failed:', paymentData.error);
            handleFallbackPayment(orderId, total, paymentMethod);
            return;
        }

        // Step 3: Save order info to localStorage
        localStorage.removeItem('cart');
        localStorage.setItem('currentOrderId', orderId);
        localStorage.setItem('currentOrderTotal', total);

        // Step 4: Redirect to Midtrans payment or fallback if unavailable
        if (window.snap && paymentData.snapToken) {
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
        } else if (paymentData.redirectUrl) {
            window.location.href = paymentData.redirectUrl;
        } else {
            handleFallbackPayment(orderId, total, paymentMethod);
        }
    } catch (error) {
        console.error('Order error:', error);
        showToast(error.message || 'Gagal memproses pesanan', 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-lock"></i> Bayar Sekarang';
    }
}

function handleFallbackPayment(orderId, total, paymentMethod) {
    localStorage.removeItem('cart');
    localStorage.setItem('currentOrderId', orderId);
    localStorage.setItem('currentOrderTotal', total);

    const paymentLabel = {
        bank_transfer_bca: 'Transfer Bank BCA',
        bank_transfer_mandiri: 'Transfer Bank Mandiri',
        gopay: 'GoPay',
        ovo: 'OVO',
        dana: 'DANA',
        qris: 'QRIS'
    }[paymentMethod] || 'Pembayaran Manual';

    showToast('Pembayaran diproses secara manual untuk ' + paymentLabel, 'success');
    const modal = document.getElementById('success-modal');
    const orderIdDisplay = document.getElementById('order-id-display');
    orderIdDisplay.textContent = `Order ID: ${orderId} • Total: Rp ${total.toLocaleString('id-ID')}`;
    modal.classList.add('active');
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
