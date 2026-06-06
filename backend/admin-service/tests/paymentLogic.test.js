const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {
    verifyCheckoutSignature,
    verifyWebhookSignature,
    isPaywalled,
} = require('../src/services/paymentLogic');

const SECRET = 'test_secret_key';

test('verifyCheckoutSignature: accepts a correct signature', () => {
    const orderId = 'order_ABC', paymentId = 'pay_XYZ';
    const sig = crypto.createHmac('sha256', SECRET).update(`${orderId}|${paymentId}`).digest('hex');
    assert.equal(verifyCheckoutSignature({ orderId, paymentId, signature: sig, keySecret: SECRET }), true);
});

test('verifyCheckoutSignature: rejects a tampered signature', () => {
    assert.equal(verifyCheckoutSignature({ orderId: 'order_ABC', paymentId: 'pay_XYZ', signature: 'deadbeef', keySecret: SECRET }), false);
});

test('verifyCheckoutSignature: rejects when fields missing', () => {
    assert.equal(verifyCheckoutSignature({ orderId: 'o', paymentId: '', signature: 's', keySecret: SECRET }), false);
});

test('verifyWebhookSignature: accepts correct HMAC over raw body', () => {
    const body = Buffer.from(JSON.stringify({ event: 'payment.captured' }));
    const sig = crypto.createHmac('sha256', SECRET).update(body).digest('hex');
    assert.equal(verifyWebhookSignature({ rawBody: body, signature: sig, webhookSecret: SECRET }), true);
});

test('verifyWebhookSignature: rejects wrong signature', () => {
    const body = Buffer.from('{"event":"payment.captured"}');
    assert.equal(verifyWebhookSignature({ rawBody: body, signature: 'nope', webhookSecret: SECRET }), false);
});

test('isPaywalled: paid course, not paid → blocked', () => {
    assert.equal(isPaywalled({ isPaid: 1, price: 499, hasPaid: false }), true);
});

test('isPaywalled: paid course, already paid → allowed', () => {
    assert.equal(isPaywalled({ isPaid: 1, price: 499, hasPaid: true }), false);
});

test('isPaywalled: free course → never blocked', () => {
    assert.equal(isPaywalled({ isPaid: 0, price: 0, hasPaid: false }), false);
});

test('isPaywalled: is_paid true but zero price → not blocked', () => {
    assert.equal(isPaywalled({ isPaid: true, price: 0, hasPaid: false }), false);
});
