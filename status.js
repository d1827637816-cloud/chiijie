function el(id) { return document.getElementById(id); }
const ORDER_HISTORY_KEY = 'orderHistory';

function loadOrderHistory() {
    const raw = localStorage.getItem(ORDER_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
}

function saveOrderHistory(history) {
    localStorage.setItem(ORDER_HISTORY_KEY, JSON.stringify(history));
}

function findOrder(id) {
    return loadOrderHistory().find(order => order.id === id);
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
