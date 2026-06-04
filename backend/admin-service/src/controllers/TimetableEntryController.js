const ttService = require('../services/TimetableEntryService');
const { asyncHandler } = require('../middlewares/error');

exports.index = asyncHandler(async (req, res) => res.json(await ttService.list({ page: req.query.page })));
exports.show = asyncHandler(async (req, res) => res.json(await ttService.get(req.params.id)));
exports.store = asyncHandler(async (req, res) => res.json(await ttService.create({ body: req.body })));
exports.update = asyncHandler(async (req, res) => res.json(await ttService.update({ id: req.params.id, body: req.body })));
exports.delete = asyncHandler(async (req, res) => res.json(await ttService.remove(req.params.id)));
exports.status = asyncHandler(async (req, res) => res.json(await ttService.toggleStatus(req.params.id)));
