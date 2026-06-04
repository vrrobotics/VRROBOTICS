const service = require('../services/CollegeDashboardService');
const { asyncHandler, HttpError } = require('../middlewares/error');

/**
 * School Dashboard — for school admins only.
 * The route is mounted under adminOnly, but we additionally require a college_id
 * on the JWT so root admins (college_id=null) can't pull any college's data.
 */
exports.stats = asyncHandler(async (req, res) => {
    const collegeId = req.user?.college_id;
    if (!collegeId) {
        throw new HttpError(403, 'School Dashboard is only available to school admins');
    }
    res.json(await service.getStats({ collegeId }));
});
