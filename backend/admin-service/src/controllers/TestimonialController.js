const testimonialService = require('../services/TestimonialService');
const { asyncHandler } = require('../middlewares/error');

exports.index = asyncHandler(async (req, res) => res.json(await testimonialService.list({ page: req.query.page, search: req.query.search })));
exports.show = asyncHandler(async (req, res) => res.json(await testimonialService.get(req.params.id)));
exports.store = asyncHandler(async (req, res) => res.json(await testimonialService.create({ body: req.body, file: req.file })));
exports.update = asyncHandler(async (req, res) => res.json(await testimonialService.update({ id: req.params.id, body: req.body, file: req.file })));
exports.delete = asyncHandler(async (req, res) => res.json(await testimonialService.remove(req.params.id)));
exports.status = asyncHandler(async (req, res) => res.json(await testimonialService.toggleStatus(req.params.id)));
