const svc = require('../services/PaymentService');
const { asyncHandler } = require('../middlewares/error');

// Create a Razorpay order for a course (verified student only).
exports.createOrder = asyncHandler(async (req, res) => {
    res.json(await svc.createOrder({ user: req.authUser || { userId: req.verifiedUserId }, courseId: req.body.course_id }));
});

// Verify the checkout handler response and grant access (verified student only).
exports.verify = asyncHandler(async (req, res) => {
    res.json(await svc.verifyAndGrant({
        user: req.authUser || { userId: req.verifiedUserId },
        orderId: req.body.razorpay_order_id,
        paymentId: req.body.razorpay_payment_id,
        signature: req.body.razorpay_signature,
    }));
});

// Razorpay webhook — unauthenticated; HMAC over the raw body is the auth.
exports.webhook = asyncHandler(async (req, res) => {
    const result = await svc.handleWebhook({
        rawBody: req.rawBody,
        signature: req.headers['x-razorpay-signature'],
    });
    res.json(result);
});
