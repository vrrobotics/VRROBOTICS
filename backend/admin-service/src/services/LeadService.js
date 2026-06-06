const { Op, fn, col } = require('sequelize');
const { Lead } = require('../models');
const { HttpError } = require('../middlewares/error');
const studentService = require('./StudentService');
const env = require('../config/env');
const { enqueue } = require('../jobs/emailQueue');
const { studentWelcome } = require('../helpers/emailTemplates');

// Basic email shape check — capture is public so validate before storing.
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());

// PUBLIC capture from the portal signup. Creates a lead (NO login). Idempotent
// per email while still "open": if an unconverted lead already exists for this
// email we return it instead of stacking duplicates, but we refresh details.
const capture = async (body = {}) => {
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    if (!name) throw new HttpError(422, 'Name is required');
    if (!isEmail(email)) throw new HttpError(422, 'A valid email is required');

    const fields = {
        name,
        email,
        phone: body.phone ? String(body.phone).trim() : null,
        course_interest: body.course_interest ? String(body.course_interest).trim() : null,
        source: body.source ? String(body.source).trim() : 'signup',
        clg_id: body.clg_id ? String(body.clg_id) : null,
    };

    const existing = await Lead.findOne({
        where: { email, status: { [Op.in]: ['new', 'contacted'] } },
        order: [['created_at', 'DESC']],
    });
    if (existing) {
        await existing.update(fields);
        return { message: 'Thanks! Our team will contact you shortly.', lead: existing };
    }
    const lead = await Lead.create({ ...fields, status: 'new' });
    return { message: 'Thanks! Our team will contact you shortly.', lead };
};

// ADMIN: list with optional status filter + search.
const list = async ({ status, search } = {}) => {
    const where = {};
    if (status && status !== 'all') where.status = status;
    if (search) {
        const like = `%${String(search).trim()}%`;
        where[Op.or] = [
            { name: { [Op.iLike]: like } },
            { email: { [Op.iLike]: like } },
            { phone: { [Op.iLike]: like } },
        ];
    }
    const leads = await Lead.findAll({ where, order: [['created_at', 'DESC']], raw: true });
    return { leads };
};

// ADMIN: pipeline counts for the dashboard alert badge.
const stats = async () => {
    const rows = await Lead.findAll({
        attributes: ['status', [fn('COUNT', col('id')), 'count']],
        group: ['status'],
        raw: true,
    });
    const byStatus = Object.fromEntries(rows.map((r) => [r.status, Number(r.count) || 0]));
    const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
    return { total, new: byStatus.new || 0, contacted: byStatus.contacted || 0, converted: byStatus.converted || 0, rejected: byStatus.rejected || 0 };
};

const VALID_STATUS = ['new', 'contacted', 'converted', 'rejected'];

// ADMIN: update follow-up fields. Status is NOT set to 'converted' here — that
// only happens via convert() which actually creates the account.
const update = async (id, body = {}) => {
    const lead = await Lead.findByPk(id);
    if (!lead) throw new HttpError(404, 'Lead not found');
    const patch = {};
    if (body.status !== undefined) {
        if (!VALID_STATUS.includes(body.status)) throw new HttpError(422, 'Invalid status');
        if (body.status === 'converted') throw new HttpError(422, 'Use Convert to create the student account');
        patch.status = body.status;
    }
    if (body.notes !== undefined) patch.notes = String(body.notes);
    if (body.assigned_to !== undefined) patch.assigned_to = body.assigned_to ? String(body.assigned_to) : null;
    await lead.update(patch);
    return { message: 'Lead updated', lead };
};

// ADMIN: convert a lead into a real student (creates their login) and mark it
// converted. Reuses StudentService.create so the account is identical to one an
// admin adds manually. Course assignment stays a separate step (Teacher
// Assignments). Admin supplies the password.
const convert = async (id, body = {}) => {
    const lead = await Lead.findByPk(id);
    if (!lead) throw new HttpError(404, 'Lead not found');
    if (lead.status === 'converted') throw new HttpError(409, 'Lead is already converted');

    const password = String(body.password || '');
    if (password.length < 8) throw new HttpError(422, 'Password must be at least 8 characters');

    const result = await studentService.create({
        name: lead.name,
        email: lead.email,
        password,
        phone: lead.phone || undefined,
        collegeId: body.collegeId || lead.clg_id || undefined,
    });

    const student = result.student || {};
    await lead.update({ status: 'converted', converted_user_id: String(student.id || '') || null });

    // Smooth onboarding: email the student their login details so they can sign
    // in immediately. Best-effort — a mail failure must NOT fail the conversion
    // the admin just saw succeed (the worker handles SMTP retries).
    try {
        const { subject, html } = studentWelcome({
            studentName: lead.name,
            email: lead.email,
            password,
            loginUrl: env.mail?.lmsLoginUrl,
        });
        await enqueue({ to: lead.email, subject, html });
    } catch (e) {
        console.warn('[leads] welcome email enqueue failed:', e.message);
    }

    return { message: 'Lead converted — welcome email sent with login details', student, lead };
};

const remove = async (id) => {
    const lead = await Lead.findByPk(id);
    if (!lead) throw new HttpError(404, 'Lead not found');
    await lead.destroy();
    return { message: 'Lead removed' };
};

module.exports = { capture, list, stats, update, convert, remove };
