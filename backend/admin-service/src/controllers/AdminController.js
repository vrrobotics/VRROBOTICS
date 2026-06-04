const adminService = require('../services/AdminService');
const { asyncHandler, HttpError } = require('../middlewares/error');

exports.index = asyncHandler(async (req, res) => {
    res.json(await adminService.list(req.query));
});

exports.show = asyncHandler(async (req, res) => {
    res.json(await adminService.get(req.params.id));
});

exports.store = asyncHandler(async (req, res) => {
    res.status(201).json(await adminService.create(req.body, req.file));
});

exports.update = asyncHandler(async (req, res) => {
    res.json(await adminService.update(req.params.id, req.body, req.file));
});

exports.destroy = asyncHandler(async (req, res) => {
    res.json(await adminService.remove(req.params.id));
});

// Only an existing root admin may grant/revoke root access.
const assertRoot = (req) => {
    if (!(req.user?.is_root_admin === true || req.user?.role === 'root')) {
        throw new HttpError(403, 'Only a root admin can change root access');
    }
};

exports.grantAccess = asyncHandler(async (req, res) => {
    assertRoot(req);
    res.json(await adminService.grantAccess(req.params.id));
});

exports.revokeAccess = asyncHandler(async (req, res) => {
    assertRoot(req);
    res.json(await adminService.revokeAccess(req.params.id));
});
