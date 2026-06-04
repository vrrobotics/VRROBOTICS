const projectService = require('../services/ProjectService');
const { asyncHandler } = require('../middlewares/error');

exports.index = asyncHandler(async (req, res) => res.json(await projectService.list({ page: req.query.page, search: req.query.search })));
exports.show = asyncHandler(async (req, res) => res.json(await projectService.get(req.params.id)));
exports.store = asyncHandler(async (req, res) => res.json(await projectService.create({ body: req.body, file: req.file })));
exports.update = asyncHandler(async (req, res) => res.json(await projectService.update({ id: req.params.id, body: req.body, file: req.file })));
exports.delete = asyncHandler(async (req, res) => res.json(await projectService.remove(req.params.id)));
exports.status = asyncHandler(async (req, res) => res.json(await projectService.toggleStatus(req.params.id)));
