/**
 * LUXE.M Admin Page
 * Menyediakan daftar produk lokal, pencarian, dan penambahan produk baru.
 */

var ADMIN_STORAGE_KEY = 'adminProducts';
var ORDER_HISTORY_KEY = 'orderHistory';

var DEFAULT_ADMIN_IMG = 'data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" width="520" height="680"><rect width="520" height="680" fill="%23f0f0f0"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial,sans-serif" font-size="32" fill="%23999">No%20Image</text></svg>';

var ADMIN_PASSWORD = 'admin1234';
var ADMIN_AUTH_KEY = 'adminAuthenticated';
var DEFAULT_ORDER_HISTORY = [
    {
        id: 'LXM-00000001',
        customer: {
            firstName: 'Dewi',
            lastName: 'Santoso',
            email: 'dewi@example.com',
            phone: '081234567890',
            address: 'Jl. Melati No. 12',
            city: 'Jakarta',
            province: 'DKI Jakarta',
            postal: '12345'
        },
        shippingMethod: 'Reguler',
        paymentMethod: 'Kartu Kredit',
        subtotal: 1498000,
        shippingCost: 30000,
        discount: 0,
        total: 1528000,
        statusIndex: 1,
        lastUpdated: '2026-06-09T08:00:00Z',
        items: [
            { productId: 'p1', name: 'Premium White Linen Shirt', brand: 'MANGO MAN', price: 699000, quantity: 1 },
            { productId: 'p2', name: 'Essential Black Bomber Jacket', brand: 'H&M', price: 799000, quantity: 1 }
        ],
        history: [
            { step: 1, status: 'Pesanan diterima', location: 'Gudang LUXE.M', time: '2026-06-09T08:00:00Z' },
            { step: 2, status: 'Diproses', location: 'Pusat Pemenuhan', time: '2026-06-09T08:05:00Z' }
        ],
        statusTimeline: [
            { step: 1, status: 'Pesanan diterima', location: 'Gudang LUXE.M' },
            { step: 2, status: 'Diproses', location: 'Pusat Pemenuhan' },
            { step: 3, status: 'Dikirim', location: 'Kurir LUXE.M' },
            { step: 4, status: 'Sampai Tujuan', location: 'Alamat Pembeli' }
        ]
    }
];

var DEFAULT_ADMIN_PRODUCTS = {
    pria: [
        { id: 'p1', name: 'Premium White Linen Shirt',         brand: 'MANGO MAN',           price: 699000,  img: 'men_shirt_product_1780400575906.png',    cat: 'apparel' },
        { id: 'p2', name: 'Essential Black Bomber Jacket',         brand: 'H&M',           price: 799000,  img: 'hero_banner_men_fashion_1780400311037.png',    cat: 'apparel' },
        { id: 'p3', name: 'Tailored Navy Chino Pants',         brand: 'UNIQLO',           price: 549000,  img: 'hero_banner_men_fashion_1780400311037.png',    cat: 'apparel' },
        { id: 'p4', name: 'Soft Cotton Polo Shirt',         brand: 'ZARA MAN',           price: 399000,  img: 'men_shirt_product_1780400575906.png',    cat: 'apparel' },
        { id: 'p5', name: 'Vintage Indigo Denim Overshirt',         brand: 'LEVI’S',           price: 999000,  img: 'hero_banner_men_fashion_1780400311037.png',    cat: 'apparel' },
        { id: 'p6', name: 'Stretch Performance Jogger Pants',         brand: 'NIKE',           price: 649000,  img: 'men_sneakers_product_1780400547442.png',    cat: 'apparel' },
        { id: 'p7', name: 'Structured Grey Wool Blazer',         brand: 'ZARA MAN',           price: 1200000,  img: 'hero_banner_men_fashion_1780400311037.png',    cat: 'apparel' },
        { id: 'p8', name: 'Relaxed Fit Denim Shirt',         brand: 'LEVI’S',           price: 850000,  img: 'men_shirt_product_1780400575906.png',    cat: 'apparel' },
        { id: 'p9', name: 'Classic White Oxford Shirt',         brand: 'BROOKS BROTHERS',           price: 760000,  img: 'hero_banner_men_fashion_1780400311037.png',    cat: 'apparel' }
    ],
    wanita: [
        { id: 'w1', name: 'Floral Midi Dress',         brand: 'ZARA',           price: 899000,  img: 'hero_banner_men_fashion_1780400311037.png',    cat: 'apparel' },
        { id: 'w2', name: 'Silk Wrap Blouse',         brand: 'MANGO',           price: 650000,  img: 'hero_banner_men_fashion_1780400311037.png',    cat: 'apparel' },
        { id: 'w3', name: 'Satin Slip Dress',         brand: 'H&M',           price: 750000,  img: 'hero_banner_men_fashion_1780400311037.png',    cat: 'apparel' }
    ],
    anak: [
        { id: 'a1', name: 'Kaos Bergambar Fun',         brand: 'GAP KIDS',           price: 299000,  img: 'hero_banner_men_fashion_1780400311037.png',    cat: 'apparel' },
        { id: 'a2', name: 'Set Piyama Warna Ceria',         brand: 'CARTER’S',           price: 350000,  img: 'hero_banner_men_fashion_1780400311037.png',    cat: 'apparel' }
    ],
    luxury: [
        { id: 'l1', name: 'Cashmere Rollneck Sweater',         brand: 'BURBERRY',           price: 12500000,  img: 'men_watch_product_1780400562688.png',    cat: 'apparel' },
        { id: 'l2', name: 'Tailored Wool Overcoat',         brand: 'TOM FORD',           price: 21500000,  img: 'men_watch_product_1780400562688.png',    cat: 'apparel' },
        { id: 'l3', name: 'Silk Weave Formal Shirt',         brand: 'ERMENEGILDO ZEGNA',           price: 8500000,  img: 'men_watch_product_1780400562688.png',    cat: 'apparel' }
    ]
};

var adminProducts = loadAdminProducts();

function el(id) { return document.getElementById(id); }

function loadAdminProducts() {
    var raw = localStorage.getItem(ADMIN_STORAGE_KEY);
    if (!raw) return normalizeAdminProducts(JSON.parse(JSON.stringify(DEFAULT_ADMIN_PRODUCTS)));
    try {
        return normalizeAdminProducts(JSON.parse(raw));
    } catch (e) {
        return normalizeAdminProducts(JSON.parse(JSON.stringify(DEFAULT_ADMIN_PRODUCTS)));
    }
}

function saveAdminProducts() {
    localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(adminProducts));
}

function normalizeAdminProducts(products) {
    Object.keys(products).forEach(function(cat) {
        products[cat].forEach(function(product) {
            if (!product.img) {
                product.img = DEFAULT_ADMIN_IMG;
            }
        });
    });
    return products;
}

function getFlattenedProducts() {
    var items = [];
    Object.keys(adminProducts).forEach(function(cat) {
        adminProducts[cat].forEach(function(product) {
            items.push(Object.assign({ category: cat }, product));
        });
    });
    return items;
}

function loadOrderHistory() {
    var raw = localStorage.getItem(ORDER_HISTORY_KEY);
    if (!raw) {
        return JSON.parse(JSON.stringify(DEFAULT_ORDER_HISTORY));
    }
    try {
        return JSON.parse(raw);
    } catch (e) {
        return JSON.parse(JSON.stringify(DEFAULT_ORDER_HISTORY));
    }
}

function saveOrderHistory(history) {
    localStorage.setItem(ORDER_HISTORY_KEY, JSON.stringify(history));
}

function getUniqueCustomers(orders) {
    var customers = [];
    orders.forEach(function(order) {
        var existing = customers.find(function(item) {
            return item.email === order.customer.email;
        });
        if (!existing) {
            customers.push({
                name: order.customer.firstName + ' ' + order.customer.lastName,
                email: order.customer.email,
                phone: order.customer.phone,
                city: order.customer.city,
                orders: 1
            });
        } else {
            existing.orders += 1;
        }
    });
    return customers;
}

function getTotalRevenue(orders) {
    return orders.reduce(function(sum, order) {
        return sum + (order.total || 0);
    }, 0);
}

function getCompletedOrders(orders) {
    return orders.filter(function(order) {
        return order.statusIndex >= order.statusTimeline.length - 1;
    }).length;
}

function getOrderStatus(order) {
    return order.statusTimeline[order.statusIndex] ? order.statusTimeline[order.statusIndex].status : 'Selesai';
}

function getStatusClass(order) {
    var status = getOrderStatus(order).toLowerCase();
    if (status.indexOf('diproses') !== -1) return 'status-pill--processing';
    if (status.indexOf('dikirim') !== -1 || status.indexOf('selesai') !== -1) return 'status-pill--completed';
    return 'status-pill--pending';
}

function getLastOrderDate(order) {
    return new Date(order.lastUpdated).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function renderCustomerTable() {
    var query = el('admin-customer-search').value.trim().toLowerCase();
    var orders = loadOrderHistory();
    var customers = getUniqueCustomers(orders);
    var rows = '';

    customers.forEach(function(customer) {
        var matches = query === '' || customer.name.toLowerCase().includes(query) || customer.email.toLowerCase().includes(query) || customer.city.toLowerCase().includes(query);
        if (!matches) return;

        rows += '<tr>'
            + '<td>' + customer.name + '</td>'
            + '<td>' + customer.email + '</td>'
            + '<td>' + customer.phone + '</td>'
            + '<td>' + customer.city + '</td>'
            + '<td>' + customer.orders + '</td>'
            + '</tr>';
    });

    if (rows === '') {
        rows = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:#888;">Tidak ada data pembeli yang cocok.</td></tr>';
    }
    el('admin-customer-table').innerHTML = rows;
}

function renderHistoryTable() {
    var orders = loadOrderHistory();
    var rows = '';

    if (orders.length === 0) {
        el('admin-history-table').innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:#888;">Belum ada riwayat pembelian.</td></tr>';
        return;
    }

    orders.slice().sort(function(a, b) {
        return new Date(b.lastUpdated) - new Date(a.lastUpdated);
    }).forEach(function(order) {
        rows += '<tr>'
            + '<td>' + order.id + '</td>'
            + '<td>' + order.customer.firstName + ' ' + order.customer.lastName + '</td>'
            + '<td>' + getLastOrderDate(order) + '</td>'
            + '<td>Rp ' + (order.total || 0).toLocaleString('id-ID') + '</td>'
            + '<td>' + getOrderStatus(order) + '</td>'
            + '</tr>';
    });

    el('admin-history-table').innerHTML = rows;
}

function showAdminView() {
    el('admin-login-modal').classList.remove('active');
    el('admin-dashboard').hidden = false;
    renderAdminStats();
    renderAdminOrderTable();
    renderAdminTable();
    renderCustomerTable();
    renderHistoryTable();
}

function lockAdminView() {
    localStorage.removeItem(ADMIN_AUTH_KEY);
    el('admin-dashboard').hidden = true;
    el('admin-login-modal').classList.add('active');
}

function authenticateAdmin(password) {
    if (password === ADMIN_PASSWORD) {
        localStorage.setItem(ADMIN_AUTH_KEY, 'true');
        showAdminView();
        showToast('Login berhasil. Selamat datang, admin!', 'success');
        return true;
    }
    showToast('Password salah. Coba lagi.', 'error');
    return false;
}

function ensureAdminAccess() {
    if (localStorage.getItem(ADMIN_AUTH_KEY) === 'true') {
        showAdminView();
    } else {
        lockAdminView();
    }
}

function updateOrderProgress() {
    var orders = loadOrderHistory();
    var now = Date.now();
    var changed = false;

    orders.forEach(function(order) {
        if (order.statusIndex >= order.statusTimeline.length - 1) return;
        var lastUpdated = new Date(order.lastUpdated).getTime();
        if (now - lastUpdated >= 20000) {
            order.statusIndex += 1;
            var nextStage = order.statusTimeline[order.statusIndex];
            order.history.push({ status: nextStage.status, location: nextStage.location, time: new Date().toISOString() });
            order.lastUpdated = new Date().toISOString();
            changed = true;
        }
    });

    if (changed) saveOrderHistory(orders);
    return orders;
}

function renderAdminStats() {
    var products = getFlattenedProducts();
    var orders = loadOrderHistory();
    el('admin-total-products').textContent = products.length;
    el('admin-total-categories').textContent = Object.keys(adminProducts).length;
    el('admin-total-orders').textContent = orders.length;
    el('admin-total-customers').textContent = getUniqueCustomers(orders).length;
    el('admin-total-revenue').textContent = 'Rp ' + getTotalRevenue(orders).toLocaleString('id-ID');
    el('admin-completed-orders').textContent = getCompletedOrders(orders);
}

function renderAdminTable() {
    var query = el('admin-search').value.trim().toLowerCase();
    var category = el('admin-category-filter').value;
    var rows = '';

    getFlattenedProducts().forEach(function(product) {
        var matchesQuery = query === '' || product.name.toLowerCase().includes(query) || product.brand.toLowerCase().includes(query) || product.category.toLowerCase().includes(query);
        var matchesCategory = category === 'all' || product.category === category;

        if (!matchesQuery || !matchesCategory) return;

        var productImgSrc = product.img || DEFAULT_ADMIN_IMG;
        rows += '<tr>'
            + '<td>' + product.id + '</td>'
            + '<td><img src="' + productImgSrc + '" alt="' + product.name + '" onerror="this.onerror=null;this.src=\'' + DEFAULT_ADMIN_IMG + '\';"></td>'
            + '<td>' + product.name + '</td>'
            + '<td>' + product.brand + '</td>'
            + '<td>' + product.category + '</td>'
            + '<td>Rp ' + product.price.toLocaleString('id-ID') + '</td>'
            + '<td class="admin-action">'
            + '<button class="btn-delete" onclick="deleteAdminProduct(\'' + product.id + '\', \'' + product.category + '\')">Hapus</button>'
            + '</td>'
            + '</tr>';
    });

    if (rows === '') {
        rows = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:#888;">Tidak ada produk yang cocok dengan filter.</td></tr>';
    }

    el('admin-product-table').innerHTML = rows;
}

function deleteAdminProduct(id, category) {
    var ok = confirm('Konfirmasi: Hapus produk dengan ID ' + id + '?\nTindakan ini tidak dapat dibatalkan.');
    if (!ok) return;

    adminProducts[category] = adminProducts[category].filter(function(item) {
        return item.id !== id;
    });
    saveAdminProducts();
    renderAdminTable();
    renderAdminStats();
    showToast('Produk dengan ID ' + id + ' telah dihapus.', 'success');
}

function renderAdminOrderTable() {
    var query = el('admin-order-search').value.trim().toLowerCase();
    var orders = updateOrderProgress();
    var rows = '';

    if (orders.length === 0) {
        el('admin-order-table').innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:#888;">Belum ada pesanan.</td></tr>';
        return;
    }

    orders.forEach(function(order) {
        var customerName = (order.customer.firstName + ' ' + order.customer.lastName).toLowerCase();
        if (query && order.id.toLowerCase().indexOf(query) === -1 && customerName.indexOf(query) === -1) return;

        rows += '<tr>'
            + '<td>' + order.id + '</td>'
            + '<td>' + order.customer.firstName + ' ' + order.customer.lastName + '</td>'
            + '<td><span class="admin-status-pill ' + getStatusClass(order) + '">' + getOrderStatus(order) + '</span></td>'
            + '<td>' + order.items.length + '</td>'
            + '<td>Rp ' + order.total.toLocaleString('id-ID') + '</td>'
            + '<td>' + new Date(order.lastUpdated).toLocaleString('id-ID') + '</td>'
            + '<td><a href="status.html?id=' + order.id + '" class="btn" style="padding:0.5rem 1rem;font-size:0.85rem;">Lacak</a></td>'
            + '</tr>';
    });

    if (rows === '') {
        rows = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:#888;">Tidak ada pesanan yang cocok.</td></tr>';
    }

    el('admin-order-table').innerHTML = rows;
}

function bindAdminEvents() {
    el('admin-search').addEventListener('input', renderAdminTable);
    el('admin-category-filter').addEventListener('change', renderAdminTable);
    el('admin-reset').addEventListener('click', function() {
        el('admin-search').value = '';
        el('admin-category-filter').value = 'all';
        renderAdminTable();
    });
    el('admin-add-product').addEventListener('click', addAdminProduct);
    el('admin-order-search').addEventListener('input', renderAdminOrderTable);
    el('admin-refresh-orders').addEventListener('click', function() {
        renderAdminOrderTable();
        renderAdminStats();
        renderCustomerTable();
        renderHistoryTable();
        showToast('Status pesanan diperbarui.', 'success');
    });
    el('admin-customer-search').addEventListener('input', renderCustomerTable);
    el('admin-refresh-customers').addEventListener('click', function() {
        renderCustomerTable();
        renderAdminStats();
        showToast('Data pembeli diperbarui.', 'success');
    });
    el('admin-new-image').addEventListener('input', renderImagePreview);
    el('admin-new-image-file').addEventListener('change', renderImagePreview);
    el('admin-add-action').addEventListener('click', function() {
        document.querySelector('.admin-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
        showToast('Scroll ke form tambah produk.', 'success');
    });
    el('admin-refresh-all').addEventListener('click', function() {
        renderAdminStats();
        renderAdminTable();
        renderAdminOrderTable();
        renderCustomerTable();
        renderHistoryTable();
        showToast('Dashboard diperbarui.', 'success');
    });
    el('admin-export-data').addEventListener('click', exportAdminData);
    el('admin-logout').addEventListener('click', function() {
        lockAdminView();
        showToast('Anda telah logout.', 'success');
    });
    el('admin-login-form').addEventListener('submit', function(event) {
        event.preventDefault();
        authenticateAdmin(el('admin-pass').value.trim());
        el('admin-pass').value = '';
    });
}

function clearAdminForm() {
    el('admin-new-name').value = '';
    el('admin-new-brand').value = '';
    el('admin-new-price').value = '';
    el('admin-new-image').value = '';
    el('admin-new-image-file').value = '';
    el('admin-new-id').value = '';
    el('admin-new-category').value = 'pria';
    renderIagePreview();
}

function renderImagePreview() {
    var fileInput = el('admin-new-image-file');
    var preview = el('admin-image-preview');
    var imageUrl = el('admin-new-image').value.trim();

    if (fileInput.files && fileInput.files[0]) {
        var file = fileInput.files[0];
        var reader = new FileReader();
        reader.onload = function(event) {
            preview.src = event.target.result;
            preview.alt = 'Preview gambar produk dari file';
        };
        reader.readAsDataURL(file);
        return;
    }

    if (imageUrl) {
        preview.src = imageUrl;
        preview.alt = 'Preview gambar produk dari URL';
        return;
    }

    preview.src = DEFAULT_ADMIN_IMG;
    preview.alt = 'Preview gambar produk';
}

function getImageSource() {
    var fileInput = el('admin-new-image-file');
    var imageUrl = el('admin-new-image').value.trim();

    if (fileInput.files && fileInput.files[0]) {
        return el('admin-image-preview').src;
    }
    return imageUrl || DEFAULT_ADMIN_IMG;
}

function addAdminProduct() {
    var name = el('admin-new-name').value.trim();
    var brand = el('admin-new-brand').value.trim();
    var price = parseInt(el('admin-new-price').value, 10);
    var category = el('admin-new-category').value;
    var providedId = el('admin-new-id').value.trim();

    if (!name || !brand || !price || price <= 0) {
        showToast('Lengkapi nama, brand, dan harga produk.', 'error');
        return;
    }

    var id = providedId || category.charAt(0) + Date.now().toString().slice(-5);
    var exists = getFlattenedProducts().some(function(item) { return item.id === id; });
    if (exists) {
        showToast('ID produk sudah digunakan. Gunakan ID lain atau kosongkan field.', 'error');
        return;
    }

    var imageSrc = getImageSource() || DEFAULT_ADMIN_IMG;

    var nextProduct = {
        id: id,
        name: name,
        brand: brand,
        price: price,
        img: imageSrc,
        cat: 'apparel'
    };

    adminProducts[category].push(nextProduct);
    saveAdminProducts();
    renderAdminStats();
    renderAdminTable();
    clearAdminForm();
    showToast('Produk baru berhasil ditambahkan.', 'success');
}

function exportAdminData() {
    var orders = loadOrderHistory();
    var csvRows = ['Order ID,Nama,Email,Total,Status,Tanggal Terakhir'];
    orders.forEach(function(order) {
        csvRows.push('"' + order.id + '","' + order.customer.firstName + ' ' + order.customer.lastName + '","' + order.customer.email + '","Rp ' + (order.total || 0).toLocaleString('id-ID') + '","' + getOrderStatus(order) + '","' + new Date(order.lastUpdated).toLocaleString('id-ID') + '"');
    });
    var csvContent = csvRows.join('\n');
    var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'luxem-order-report.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Data pesanan berhasil diekspor.', 'success');
}

function showToast(message, type) {
    var existing = document.getElementById('admin-toast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.id = 'admin-toast';
    toast.textContent = message;
    toast.style.cssText = 'position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);background:' + (type === 'error' ? '#e74c3c' : '#222') + ';color:white;padding:1rem 1.8rem;border-radius:0.8rem;box-shadow:0 12px 28px rgba(0,0,0,0.15);font-family:Outfit,sans-serif;font-weight:700;z-index:9999;';
    document.body.appendChild(toast);
    setTimeout(function() { toast.style.opacity = '0'; setTimeout(function() { toast.remove(); }, 400); }, 3000);
}

window.deleteAdminProduct = deleteAdminProduct;

document.addEventListener('DOMContentLoaded', function() {
    ensureAdminAccess();
    bindAdminEvents();
});
