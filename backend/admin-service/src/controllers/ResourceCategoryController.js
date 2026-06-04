const svc = require('../services/ResourceCategoryService');
const { asyncHandler } = require('../middlewares/error');

exports.index = asyncHandler(async (_req, res) => res.json(await svc.list()));
exports.store = asyncHandler(async (req, res) => res.status(201).json(await svc.create(req.body)));
exports.update = asyncHandler(async (req, res) => res.json(await svc.update(req.params.id, req.body)));
exports.destroy = asyncHandler(async (req, res) => res.json(await svc.remove(req.params.id)));
