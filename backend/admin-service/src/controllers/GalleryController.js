const galleryService = require('../services/GalleryService');
const { asyncHandler } = require('../middlewares/error');

exports.index = asyncHandler(async (req, res) => {
    const { page, search } = req.query;
    res.json(await galleryService.list({ page, search }));
});

exports.show = asyncHandler(async (req, res) => {
    res.json(await galleryService.get(req.params.id));
});

exports.store = asyncHandler(async (req, res) => {
    res.json(await galleryService.create({ body: req.body, file: req.file }));
});

exports.update = asyncHandler(async (req, res) => {
    res.json(await galleryService.update({ id: req.params.id, body: req.body, file: req.file }));
});

exports.delete = asyncHandler(async (req, res) => {
    res.json(await galleryService.remove(req.params.id));
});

exports.status = asyncHandler(async (req, res) => {
    res.json(await galleryService.toggleStatus(req.params.id));
});
