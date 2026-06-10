const ORDER_HISTORY_KEY = 'orderHistory';

function loadOrderHistory() {
    const raw = localStorage.getItem(ORDER_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
}

function formatCurrency(value) {
    return new Intl.NumberFormat('id-ID').format(value);
}

function renderOrderItem(order) {
    const date = new Date(order.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    const statusStage = order.statusTimeline[order.statusIndex] || order.statusTimeline[order.statusTimeline.length - 1];

    return `
        <article style="background:white; border:1px solid #e8e8e8; border-radius:1rem; padding:1.6rem; margin-bottom:1.5rem; box-shadow:0 10px 25px rgba(0,0,0,0.04);">
            <div style="display:flex; gap:1rem; flex-wrap:wrap; justify-content:space-between; align-items:center;">
                <div>
                    <h2 style="margin:0 0 0.5rem; font-size:1.25rem;">ID Pesanan: ${order.id}</h2>
                    <p style="margin:0; color:#666;">${date} · ${order.customer.firstName} ${order.customer.lastName}</p>
                </div>
                <span style="background:#f4f4f4; color:#000; padding:0.75rem 1rem; border-radius:1rem; font-weight:600;">${statusStage.status}</span>
            </div>
            <div style="display:grid; grid-template-columns:1fr auto; gap:1rem; margin-top:1rem;">
                <p style="margin:0; color:#444;">Total: Rp ${formatCurrency(order.total)} · ${order.shippingMethod}</p>
                <a href="status.html?id=${order.id}" style="display:inline-flex; align-items:center; gap:0.5rem; background:#000; color:#fff; border-radius:1rem; padding:0.85rem 1.2rem; text-decoration:none;">Lacak Pesanan <i class="fa-solid fa-arrow-right"></i></a>
            </div>
        </article>
    `;
}

function renderHistory() {
    const container = document.getElementById('history-list');
    const history = loadOrderHistory();
    if (!container) return;
    if (!history.length) {
        container.innerHTML = `
            <div style="background:white; border:1px solid #e8e8e8; border-radius:1rem; padding:2rem; text-align:center; color:#666; box-shadow:0 12px 30px rgba(0,0,0,0.05);">
                <h2>Tidak ada riwayat pembelian</h2>
                <p>Belum ada pesanan yang disimpan. Lakukan pembelian terlebih dahulu untuk melihat riwayat pesanan Anda.</p>
                <a href="index.html" style="display:inline-block; margin-top:1rem; background:#000; color:#fff; padding:0.9rem 1.4rem; border-radius:1rem; text-decoration:none;">Kembali ke Toko</a>
            </div>
        `;
        return;
    }
    container.innerHTML = history.map(renderOrderItem).join('');
}

document.addEventListener('DOMContentLoaded', renderHistory);
