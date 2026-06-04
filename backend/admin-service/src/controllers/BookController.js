const bookService = require('../services/BookService');
const { asyncHandler } = require('../middlewares/error');

exports.index = asyncHandler(async (req, res) => {
    const { page, search } = req.query;
    res.json(await bookService.list({ page, search }));
});

exports.show = asyncHandler(async (req, res) => {
    res.json(await bookService.get(req.params.id));
});

exports.store = asyncHandler(async (req, res) => {
    res.json(await bookService.create({ body: req.body, file: req.file }));
});

exports.update = asyncHandler(async (req, res) => {
    res.json(await bookService.update({ id: req.params.id, body: req.body, file: req.file }));
});

exports.delete = asyncHandler(async (req, res) => {
    res.json(await bookService.remove(req.params.id));
});

exports.status = asyncHandler(async (req, res) => {
    res.json(await bookService.toggleStatus(req.params.id));
});
