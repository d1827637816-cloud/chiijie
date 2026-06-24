function el(id) { return document.getElementById(id); }

// Support both legacy and new keys; save updates to the new key used by checkout fallback
const SAVE_ORDER_KEY = 'luxeOrderHistory';
const READ_ORDER_KEYS = [ 'luxeOrderHistory', 'orderHistory' ];

function loadRawHistories() {
    const combined = [];
    READ_ORDER_KEYS.forEach(key => {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) combined.push(...parsed);
        } catch (e) {
            console.warn('Failed to parse order history for', key, e.message);
        }
    });
    return combined;
}

function saveOrderHistory(history) {
    try {
        localStorage.setItem(SAVE_ORDER_KEY, JSON.stringify(history));
    } catch (e) {
        console.warn('Failed saving order history', e.message);
    }
}

function findOrder(id) {
    const all = loadOrderHistory();
    return all.find(order => order.id === id);
}

function updateStatusIfNeeded(order) {
    if (!order || order.statusIndex >= order.statusTimeline.length - 1) return order;
    const lastUpdate = new Date(order.lastUpdated).getTime();
    const now = Date.now();
    if (now - lastUpdate < 20000) return order;
    order.statusIndex += 1;
    const nextStage = order.statusTimeline[order.statusIndex];
    order.history.push({ status: nextStage.status, location: nextStage.location, time: new Date().toISOString() });
    order.lastUpdated = new Date().toISOString();
    const history = loadOrderHistory().map(o => o.id === order.id ? order : o);
    saveOrderHistory(history);
    return order;
}

function renderStatus(order) {
    const steps = order.statusTimeline.map((stage, index) => {
        const active = index <= order.statusIndex;
        return `<li style="margin-bottom:1rem; list-style:none; padding:1rem; border:1px solid ${active ? '#000' : '#ddd'}; border-radius:0.9rem; background:${active ? '#f4f4f4' : '#fff'};">
            <strong>${stage.status}</strong>
            <p style="margin:0.5rem 0 0;color:#666;font-size:0.95rem;">${stage.location}</p>
            <p style="margin:0.5rem 0 0;color:#333;font-size:0.9rem;">${index <= order.statusIndex ? new Date(order.history[index].time).toLocaleString('id-ID') : '-'}</p>
        </li>`;
    }).join('');

    const historyItems = order.history.map(entry => `
        <li style="margin-bottom:0.75rem;"><strong>${entry.status}</strong> — ${entry.location} <br><small style="color:#666;">${new Date(entry.time).toLocaleString('id-ID')}</small></li>
    `).join('');

    el('status-result').innerHTML = `
        <div style="background:white; border:1px solid #e8e8e8; border-radius:1rem; padding:2rem; box-shadow:0 12px 30px rgba(0,0,0,0.05);">
            <h2 style="margin-top:0;">Status Pesanan: ${order.id}</h2>
            <p style="color:#555; margin:0.5rem 0 1.5rem;">${order.customer.firstName} ${order.customer.lastName} — Total Rp ${order.total.toLocaleString('id-ID')}</p>
            <div style="display:flex; gap:1rem; flex-wrap:wrap; margin-bottom:1.5rem;">
                <span style="background:#f4f4f4; padding:0.8rem 1rem; border-radius:0.8rem;">Pembayaran: ${order.paymentMethod}</span>
                <span style="background:#f4f4f4; padding:0.8rem 1rem; border-radius:0.8rem;">Pengiriman: ${order.shippingMethod}</span>
                <span style="background:#f4f4f4; padding:0.8rem 1rem; border-radius:0.8rem;">Diperbarui: ${new Date(order.lastUpdated).toLocaleString('id-ID')}</span>
            </div>
            <h3 style="margin-bottom:0.8rem;">Timeline Pengiriman</h3>
            <ul style="padding-left:0; margin:0;">${steps}</ul>
            <h3 style="margin:2rem 0 0.8rem;">Riwayat Aktivitas</h3>
            <ul style="padding-left:1.2rem; margin:0; color:#444;">${historyItems}</ul>
        </div>
    `;
}

// --- Order List Renderer (for status page) ---
function normalizeOrder(raw) {
    // If already normalized, return
    if (!raw) return null;
    const id = raw.orderId || raw.id || raw.order_id || raw.order || ('LXM-' + (raw.createdAt || raw.created) || Date.now());
    const total = raw.total || raw.amount || raw.grandTotal || raw.orderTotal || 0;
    const firstName = raw.firstName || (raw.customer && raw.customer.firstName) || (raw.customerName ? raw.customerName.split(' ')[0] : '') || '';
    const lastName = raw.lastName || (raw.customer && raw.customer.lastName) || (raw.customerName ? raw.customerName.split(' ').slice(1).join(' ') : '') || '';
    const paymentMethod = raw.paymentMethod || raw.method || (raw.payment && raw.payment.method) || 'Unknown';
    const shippingMethod = raw.shippingMethod || raw.shipping_method || (raw.shipping && raw.shipping.method) || 'Reguler';
    const createdAt = raw.createdAt || raw.created || raw.date || new Date().toISOString();
    // status timeline & history
    let history = raw.history || [];
    if (!Array.isArray(history) || history.length === 0) {
        history = [{ status: raw.status || 'Menunggu Pembayaran', location: 'Dashboard Pelanggan', time: createdAt }];
    }
    const statusIndex = typeof raw.statusIndex === 'number' ? raw.statusIndex : (history.length - 1 >= 0 ? Math.min(history.length -1, 0) : 0);
    const statusTimeline = raw.statusTimeline || history.map(h => ({ status: h.status, location: h.location || 'Lokasi' }));

    return {
        id: id,
        total: total,
        customer: { firstName, lastName, email: raw.email || (raw.customer && raw.customer.email) || '' },
        paymentMethod,
        shippingMethod,
        createdAt,
        lastUpdated: raw.lastUpdated || createdAt,
        history: history.map(h => ({ status: h.status, location: h.location || 'Dashboard Pelanggan', time: h.time || h.timestamp || createdAt })),
        statusIndex: statusIndex,
        statusTimeline: statusTimeline
    };
}

function loadOrderHistory() {
    return loadRawHistories().map(normalizeOrder).filter(Boolean);
}

function renderOrderList() {
    const listEl = el('orders-list');
    if (!listEl) return;
    const orders = loadOrderHistory();
    if (!orders || orders.length === 0) {
        listEl.innerHTML = '<div style="padding:1.25rem;border:1px dashed #ddd;border-radius:0.6rem;color:#666;">Belum ada pesanan yang tersimpan di perangkat ini.</div>';
        return;
    }

    const html = orders.slice().reverse().map(o => {
        return `<div style="background:white;border:1px solid #eee;padding:1rem;border-radius:0.6rem;display:flex;justify-content:space-between;align-items:center;gap:1rem;">
            <div>
                <div style="font-weight:700">${o.id}</div>
                <div style="font-size:0.9rem;color:#666">${o.customer.firstName} ${o.customer.lastName} • Rp ${Number(o.total || 0).toLocaleString('id-ID')}</div>
                <div style="font-size:0.85rem;color:#888;margin-top:6px">${new Date(o.createdAt).toLocaleString('id-ID')}</div>
            </div>
            <div style="display:flex;gap:0.5rem;align-items:center">
                <button class="btn" style="padding:0.6rem 0.9rem;" data-id="${o.id}" onclick="document.getElementById('status-order-id').value='${o.id}';document.getElementById('status-check').click();">Lihat</button>
                <button class="btn" style="padding:0.6rem 0.9rem;background:#f4f4f4;color:#333;border:1px solid #ddd;" onclick="navigator.clipboard && navigator.clipboard.writeText('${o.id}').then(()=>alert('ID disalin'))">Salin ID</button>
            </div>
        </div>`;
    }).join('');

    listEl.innerHTML = html;
}

function showNotFound(id) {
    el('status-result').innerHTML = `
        <div style="background:white; border:1px solid #e8e8e8; border-radius:1rem; padding:2rem; box-shadow:0 12px 30px rgba(0,0,0,0.05); text-align:center; color:#666;">
            <h2>ID Pesanan tidak ditemukan</h2>
            <p>Maaf, pesanan dengan ID <strong>${id}</strong> tidak ada pada riwayat ini.</p>
            <p>Periksa kembali ID pesanan atau buka <a href="history.html">Riwayat Pembelian</a> untuk melihat pesanan yang tersimpan.</p>
        </div>
    `;
}

function checkOrderStatus(id) {
    if (!id) return;
    let order = findOrder(id);
    if (!order) {
        showNotFound(id);
        return;
    }
    order = updateStatusIfNeeded(order);
    renderStatus(order);
}

function getQueryParam(name) {
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
}

function initStatusPage() {
    const orderIdInput = el('status-order-id');
    const orderId = getQueryParam('id');
    if (orderId) {
        orderIdInput.value = orderId;
        checkOrderStatus(orderId);
    }

    el('status-check').addEventListener('click', function() {
        const id = orderIdInput.value.trim();
        if (!id) return;
        checkOrderStatus(id);
    });
}

document.addEventListener('DOMContentLoaded', initStatusPage);
