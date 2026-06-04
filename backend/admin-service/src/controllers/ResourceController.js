const resourceService = require('../services/ResourceService');
const { asyncHandler } = require('../middlewares/error');

exports.index = asyncHandler(async (req, res) => res.json(await resourceService.list({ page: req.query.page, search: req.query.search })));
exports.show = asyncHandler(async (req, res) => res.json(await resourceService.get(req.params.id)));
exports.store = asyncHandler(async (req, res) => res.json(await resourceService.create({ body: req.body, files: req.files })));
exports.update = asyncHandler(async (req, res) => res.json(await resourceService.update({ id: req.params.id, body: req.body, files: req.files })));
exports.delete = asyncHandler(async (req, res) => res.json(await resourceService.remove(req.params.id)));
exports.status = asyncHandler(async (req, res) => res.json(await resourceService.toggleStatus(req.params.id)));
