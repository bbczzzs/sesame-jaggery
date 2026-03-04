// ============================================
// SUPABASE CONFIGURATION
// ============================================

const SUPABASE_URL = 'https://bzxsitulvkhnjilbgehz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_FOYTerCWuiEza68qVziDOA_QJjR5yUm';

// EmailJS Configuration (for order emails)
const EMAILJS_PUBLIC_KEY = 'YOUR_EMAILJS_PUBLIC_KEY';
const EMAILJS_SERVICE_ID = 'YOUR_EMAILJS_SERVICE_ID';
const EMAILJS_ORDER_TEMPLATE_ID = 'YOUR_EMAILJS_ORDER_TEMPLATE';
const EMAILJS_SHIPPING_TEMPLATE_ID = 'YOUR_EMAILJS_SHIPPING_TEMPLATE';

// Initialize Supabase Client — use "sb" to avoid conflict with window.supabase CDN
var sb = null;

(function initSupabase() {
    try {
        var lib = window.supabase;
        if (lib && lib.createClient) {
            sb = lib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('✅ Supabase initialized');
        } else {
            // Retry after CDN finishes loading
            var retries = 0;
            var timer = setInterval(function () {
                retries++;
                lib = window.supabase;
                if (lib && lib.createClient) {
                    sb = lib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                    console.log('✅ Supabase initialized (retry ' + retries + ')');
                    clearInterval(timer);
                } else if (retries > 30) {
                    console.warn('⚠️ Supabase JS failed to load after 3s');
                    clearInterval(timer);
                }
            }, 100);
        }
    } catch (e) {
        console.error('Supabase init error:', e);
    }
})();

// Alias for backward compat — pages reference "supabase" 
// We define it as a getter so it always returns the current sb client
Object.defineProperty(window, 'supabaseClient', { get: function () { return sb; } });

// ============================================
// AUTH HELPER FUNCTIONS
// ============================================

async function getUser() {
    if (!sb) return null;
    try {
        // First check session (local, fast)
        const { data: { session } } = await sb.auth.getSession();
        if (!session) return null;
        // Then get full user
        const { data: { user } } = await sb.auth.getUser();
        return user;
    } catch (e) {
        console.warn('getUser error:', e);
        return null;
    }
}

async function getUserProfile() {
    const user = await getUser();
    if (!user) return null;

    try {
        const { data, error } = await sb
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error) {
            console.error('Error fetching profile:', error);
            return null;
        }
        return { ...user, ...data };
    } catch (e) {
        return null;
    }
}

async function isAdmin() {
    const profile = await getUserProfile();
    return profile && profile.role === 'admin';
}

// ============================================
// ORDER HELPER FUNCTIONS
// ============================================

async function createOrder(orderData) {
    const user = await getUser();
    if (!user) throw new Error('User not logged in');

    const orderId = 'SJ' + Date.now().toString().slice(-8);

    const { data: order, error: orderError } = await sb
        .from('orders')
        .insert({
            order_id: orderId,
            user_id: user.id,
            customer_name: orderData.name,
            customer_phone: orderData.phone,
            customer_email: user.email,
            delivery_address: orderData.address,
            special_notes: orderData.notes,
            items: orderData.items,
            subtotal: orderData.subtotal,
            discount: orderData.discount || 0,
            delivery_charge: orderData.delivery,
            total: orderData.total,
            promo_code: orderData.promoCode || null,
            payment_method: 'cod',
            status: 'pending',
        })
        .select()
        .single();

    if (orderError) throw orderError;

    // Send order confirmation email
    try {
        await sendOrderEmail(order);
    } catch (emailErr) {
        console.warn('Email sending failed:', emailErr);
    }

    return order;
}

async function getUserOrders() {
    const user = await getUser();
    if (!user) return [];

    const { data, error } = await sb
        .from('orders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching orders:', error);
        return [];
    }
    return data || [];
}

async function getOrderById(orderId) {
    const { data, error } = await sb
        .from('orders')
        .select('*')
        .eq('order_id', orderId)
        .single();

    if (error) return null;
    return data;
}

// Admin functions
async function getAllOrders(statusFilter) {
    if (!sb) return [];
    var query = sb
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

    if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;
    if (error) {
        console.error('Error fetching orders:', error);
        return [];
    }
    return data || [];
}

async function updateOrderStatus(orderId, newStatus) {
    const { data, error } = await sb
        .from('orders')
        .update({
            status: newStatus,
            updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
        .select()
        .single();

    if (error) throw error;

    // Send status update email
    if (['confirmed', 'shipped', 'delivered'].includes(newStatus)) {
        try {
            await sendStatusUpdateEmail(data, newStatus);
        } catch (emailErr) {
            console.warn('Status email failed:', emailErr);
        }
    }

    return data;
}

async function getAllUsers() {
    if (!sb) return [];
    const { data, error } = await sb
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching users:', error);
        return [];
    }
    return data || [];
}

async function getDashboardStats() {
    if (!sb) return null;

    const { data: orders } = await sb
        .from('orders')
        .select('total, status, created_at');

    const { data: users } = await sb
        .from('profiles')
        .select('id, created_at');

    if (!orders || !users) return null;

    const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
    const totalOrders = orders.length;
    const pendingOrders = orders.filter(o => o.status === 'pending').length;
    const totalUsers = users.length;

    // Today's stats
    const today = new Date().toISOString().split('T')[0];
    const todayOrders = orders.filter(o => o.created_at && o.created_at.startsWith(today));
    const todayRevenue = todayOrders.reduce((sum, o) => sum + (o.total || 0), 0);

    // Status breakdown
    const statusCounts = {};
    orders.forEach(o => {
        statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
    });

    return {
        totalRevenue,
        totalOrders,
        pendingOrders,
        totalUsers,
        todayOrders: todayOrders.length,
        todayRevenue,
        statusCounts
    };
}

// ============================================
// EMAIL FUNCTIONS (EmailJS)
// ============================================

async function sendOrderEmail(order) {
    if (typeof emailjs === 'undefined') return;

    const itemsList = order.items.map(item =>
        item.name + ' x' + item.qty + ' — ₹' + (item.price * item.qty)
    ).join('\n');

    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_ORDER_TEMPLATE_ID, {
        to_email: order.customer_email,
        to_name: order.customer_name,
        order_id: order.order_id,
        items_list: itemsList,
        subtotal: '₹' + order.subtotal,
        discount: order.discount > 0 ? '-₹' + order.discount : '₹0',
        delivery: order.delivery_charge === 0 ? 'FREE' : '₹' + order.delivery_charge,
        total: '₹' + order.total,
        delivery_address: order.delivery_address,
        payment_method: 'Cash on Delivery',
        special_notes: order.special_notes || 'None'
    });
}

async function sendStatusUpdateEmail(order, status) {
    if (typeof emailjs === 'undefined') return;

    const statusMessages = {
        confirmed: 'Your order has been confirmed and is being prepared! 🎉',
        shipped: 'Your order is on the way! 🚚',
        delivered: 'Your order has been delivered! Thank you for ordering. 💚'
    };

    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_SHIPPING_TEMPLATE_ID, {
        to_email: order.customer_email,
        to_name: order.customer_name,
        order_id: order.order_id,
        status: status.charAt(0).toUpperCase() + status.slice(1),
        status_message: statusMessages[status] || 'Your order status has been updated.',
        total: '₹' + order.total,
    });
}

// ============================================
// AUTH STATE UI UPDATES
// ============================================

async function updateAuthUI() {
    const user = await getUser();

    const loginLinks = document.querySelectorAll('.auth-login-link');
    const accountLinks = document.querySelectorAll('.auth-account-link');
    const userNames = document.querySelectorAll('.auth-user-name');

    if (user) {
        const profile = await getUserProfile();
        loginLinks.forEach(el => el.classList.add('hidden'));
        accountLinks.forEach(el => el.classList.remove('hidden'));
        userNames.forEach(el => {
            el.textContent = profile?.full_name || user.email?.split('@')[0] || 'Account';
        });
    } else {
        loginLinks.forEach(el => el.classList.remove('hidden'));
        accountLinks.forEach(el => el.classList.add('hidden'));
    }
}

// Listen for auth state changes
function setupAuthListener() {
    if (!sb) return;
    sb.auth.onAuthStateChange(function (event, session) {
        console.log('Auth event:', event);
        updateAuthUI();
    });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function () {
    var checkInterval = setInterval(function () {
        if (sb) {
            clearInterval(checkInterval);
            setupAuthListener();
            updateAuthUI();
        }
    }, 200);
    setTimeout(function () { clearInterval(checkInterval); }, 5000);
});
