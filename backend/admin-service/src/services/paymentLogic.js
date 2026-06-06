const crypto = require('crypto');

// Pure Razorpay logic — no DB, no network. Unit-tested in isolation.

// Constant-time compare to avoid leaking timing info on signature checks.
const safeEqual = (a, b) => {
    const ba = Buffer.from(String(a || ''), 'utf8');
    const bb = Buffer.from(String(b || ''), 'utf8');
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
};

// Checkout handler signature: HMAC_SHA256(order_id + "|" + payment_id, keySecret).
const verifyCheckoutSignature = ({ orderId, paymentId, signature, keySecret }) => {
    if (!orderId || !paymentId || !signature || !keySecret) return false;
    const expected = crypto
        .createHmac('sha256', keySecret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');
    return safeEqual(expected, signature);
};

// Webhook signature: HMAC_SHA256(rawBody, webhookSecret) sent in X-Razorpay-Signature.
const verifyWebhookSignature = ({ rawBody, signature, webhookSecret }) => {
    if (!rawBody || !signature || !webhookSecret) return false;
    const expected = crypto
        .createHmac('sha256', webhookSecret)
        .update(Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody)))
        .digest('hex');
    return safeEqual(expected, signature);
};

// Paywall decision for a course. Returns true when access must be BLOCKED.
// A paid course (is_paid truthy AND price > 0) is locked unless the student has
// a paid record. Free courses, zero-price courses, and already-paid students
// are never blocked here. (Teacher-delegation gating is applied separately.)
const isPaywalled = ({ isPaid, price, hasPaid }) => {
    const paidCourse = (isPaid === true || isPaid === 1 || isPaid === '1') && Number(price) > 0;
    if (!paidCourse) return false;
    return !hasPaid;
};

module.exports = { verifyCheckoutSignature, verifyWebhookSignature, isPaywalled, safeEqual };
