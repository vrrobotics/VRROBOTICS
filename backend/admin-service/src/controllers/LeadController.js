const svc = require('../services/LeadService');
const { asyncHandler } = require('../middlewares/error');

// Public capture (no auth) — from the portal signup form.
exports.capture = asyncHandler(async (req, res) => {
    res.json(await svc.capture(req.body));
});

// Admin pipeline (mounted under adminOnly).
exports.list = asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(await svc.list(req.query));
});
exports.stats = asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(await svc.stats());
});
exports.update = asyncHandler(async (req, res) => {
    res.json(await svc.update(req.params.id, req.body));
});
exports.convert = asyncHandler(async (req, res) => {
    res.json(await svc.convert(req.params.id, req.body));
});
exports.remove = asyncHandler(async (req, res) => {
    res.json(await svc.remove(req.params.id));
});
