// Instructor admin CRUD. Instructors are auth-service users with role
// 'instructor' (lucy_devdb.users + roles), so we operate via the read/write
// authDb handle and join the roles table — the same pattern StudentService
// uses for students.
//
// Note: lucy_devdb uses camelCase column names; on Postgres those MUST be
// double-quoted in every raw query (unquoted identifiers fold to lowercase
// and the resolve fails silently as "column does not exist").
const { QueryTypes } = require('sequelize');
const authDb = require('../config/authDatabase');
const { HttpError } = require('../middlewares/error');
const { upload, removeFile, niceFileName } = require('../helpers/fileUploader');
const supabaseAdmin = require('../lib/supabaseAdmin');

const ROLE = 'instructor';

const saveInstructorPhoto = async (file, displayName) => {
    if (!file) return null;
    const ext = (file.originalname || '').split('.').pop() || 'jpg';
    const destPath = `uploads/users/instructor/${niceFileName(displayName || 'instructor', ext)}`;
    await upload(file, destPath, 400, 400);
    return destPath;
};

// 11-char userId, same pattern as auth-service's generateUserID ("20" + 9
// digits). Inlined so admin-service doesn't depend on the auth service code.
const generateUserId = () => {
    const n = Math.floor(100000000 + Math.random() * 900000000);
    return `20${n}`;
};

const resolveInstructorRoleId = async () => {
    const rows = await authDb.query(
        `SELECT "roleId" FROM roles WHERE role = :role LIMIT 1`,
        { replacements: { role: ROLE }, type: QueryTypes.SELECT }
    );
    if (!rows.length) throw new HttpError(500, 'instructor role not found in roles table');
    return rows[0].roleId;
};

const list = async ({ page = 1, per_page = 1000, search = '' }) => {
    const limit = Number(per_page);
    const offset = (Number(page) - 1) * limit;
    const like = `%${String(search).trim()}%`;
    const searchClause = search
        ? 'AND (u.name ILIKE :like OR u.email ILIKE :like OR u.expertise ILIKE :like)'
        : '';
    try {
        const [{ count }] = await authDb.query(
            `SELECT COUNT(*) AS count
               FROM users u
               JOIN roles r ON r."roleId" = u."roleId"
              WHERE r.role = :role ${searchClause}`,
            { replacements: { role: ROLE, like }, type: QueryTypes.SELECT }
        );
        const rows = await authDb.query(
            `SELECT u."userId" AS id, u.name, u.email, u.phone, u.expertise,
                    u."yearsOfExperience", u."linkedinUrl", u.bio, u.address,
                    u."instructorPhoto", u."createdAt"
               FROM users u
               JOIN roles r ON r."roleId" = u."roleId"
              WHERE r.role = :role ${searchClause}
              ORDER BY u."createdAt" DESC
              LIMIT :limit OFFSET :offset`,
            { replacements: { role: ROLE, like, limit, offset }, type: QueryTypes.SELECT }
        );
        const instructors = rows.map((r) => {
            const { instructorPhoto, ...rest } = r;
            return { ...rest, photo: instructorPhoto || null, course_count: 0 };
        });
        return { instructors, total: Number(count), page: Number(page), per_page: limit };
    } catch (err) {
        console.warn('[instructors] auth DB query failed:', err.message);
        return { instructors: [], total: 0, page: Number(page), per_page: limit };
    }
};

const get = async (id) => {
    const rows = await authDb.query(
        `SELECT u."userId" AS id, u.name, u.email, u.phone, u.dob, u.gender,
                u.expertise, u.bio, u."yearsOfExperience", u."linkedinUrl",
                u.address, u."instructorPhoto", u."createdAt"
           FROM users u
           JOIN roles r ON r."roleId" = u."roleId"
          WHERE r.role = :role AND u."userId" = :id LIMIT 1`,
        { replacements: { role: ROLE, id: String(id) }, type: QueryTypes.SELECT }
    );
    if (!rows.length) throw new HttpError(404, 'Instructor not found');
    const { instructorPhoto, ...rest } = rows[0];
    return { instructor: { ...rest, photo: instructorPhoto || null } };
};

const findById = async (id) => {
    const rows = await authDb.query(
        `SELECT "userId", "instructorPhoto", "passwordHash"
           FROM users WHERE "userId" = :id LIMIT 1`,
        { replacements: { id: String(id) }, type: QueryTypes.SELECT }
    );
    return rows[0] || null;
};

const isEmailTaken = async (email, excludeId = null) => {
    const sql = excludeId
        ? `SELECT 1 FROM users WHERE email = :email AND "userId" <> :id LIMIT 1`
        : `SELECT 1 FROM users WHERE email = :email LIMIT 1`;
    const rows = await authDb.query(sql, {
        replacements: { email, id: String(excludeId || '') },
        type: QueryTypes.SELECT,
    });
    return rows.length > 0;
};

// Admin-created instructors land in lucy_devdb.users (role=instructor) AND
// Supabase Auth so they can sign in. Mirrors StudentService.create.
const create = async (body, file = null) => {
    if (!body.name || !body.email || !body.password) {
        throw new HttpError(422, 'Name, email, and password are required');
    }
    if (String(body.password).length < 8) {
        throw new HttpError(422, 'Password must be at least 8 characters');
    }
    if (await isEmailTaken(body.email)) {
        throw new HttpError(422, 'Email already in use');
    }
    const roleId = await resolveInstructorRoleId();
    const userId = generateUserId();

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: body.email,
        password: body.password,
        email_confirm: true,
        user_metadata: { name: body.name, role: 'instructor' },
    });
    if (createErr) throw new HttpError(400, createErr.message);
    const supabaseUid = created.user.id;

    const photoPath = await saveInstructorPhoto(file, body.name);

    try {
        await authDb.query(
            `INSERT INTO users
                ("userId", name, email, "passwordHash", phone, "roleId",
                 expertise, bio, "yearsOfExperience", "linkedinUrl", address,
                 "instructorPhoto", "createdAt", "updatedAt")
             VALUES
                (:userId, :name, :email, :passwordHash, :phone, :roleId,
                 :expertise, :bio, :yearsOfExperience, :linkedinUrl, :address,
                 :instructorPhoto, NOW(), NOW())`,
            {
                replacements: {
                    userId,
                    name: body.name,
                    email: body.email,
                    passwordHash: `supabase:${supabaseUid}`,
                    phone: body.phone || null,
                    roleId,
                    expertise: body.expertise || null,
                    bio: body.bio || null,
                    yearsOfExperience:
                        body.yearsOfExperience != null && body.yearsOfExperience !== ''
                            ? Number(body.yearsOfExperience)
                            : null,
                    linkedinUrl: body.linkedinUrl || null,
                    address: body.address || null,
                    instructorPhoto: photoPath,
                },
                type: QueryTypes.INSERT,
            }
        );
    } catch (e) {
        await supabaseAdmin.auth.admin.deleteUser(supabaseUid).catch(() => {});
        throw e;
    }

    return { message: 'Instructor added successfully', instructor: (await get(userId)).instructor };
};

const update = async (id, body, file = null) => {
    const existing = await findById(id);
    if (!existing) throw new HttpError(404, 'Instructor not found');
    if (!body.name || !body.email) throw new HttpError(422, 'Name and email are required');
    if (await isEmailTaken(body.email, id)) {
        throw new HttpError(422, 'Email already in use');
    }
    const sets = [
        'name = :name', 'email = :email', 'phone = :phone',
        'expertise = :expertise', 'bio = :bio',
        '"yearsOfExperience" = :yearsOfExperience',
        '"linkedinUrl" = :linkedinUrl',
        'address = :address',
    ];
    const replacements = {
        id: String(id),
        name: body.name,
        email: body.email,
        phone: body.phone ?? null,
        expertise: body.expertise ?? null,
        bio: body.bio ?? null,
        yearsOfExperience:
            body.yearsOfExperience != null && body.yearsOfExperience !== ''
                ? Number(body.yearsOfExperience)
                : null,
        linkedinUrl: body.linkedinUrl ?? null,
        address: body.address ?? null,
    };

    if (file) {
        const photoPath = await saveInstructorPhoto(file, body.name);
        if (photoPath) {
            sets.push('"instructorPhoto" = :instructorPhoto');
            replacements.instructorPhoto = photoPath;
            if (existing.instructorPhoto) removeFile(existing.instructorPhoto);
        }
    }

    await authDb.query(
        `UPDATE users SET ${sets.join(', ')}, "updatedAt" = NOW()
          WHERE "userId" = :id`,
        { replacements, type: QueryTypes.UPDATE }
    );

    // Keep Supabase Auth in sync on email changes.
    if (body.email && body.email !== existing.email) {
        const uid = String(existing.passwordHash || '').replace(/^supabase:/, '');
        if (uid) {
            await supabaseAdmin.auth.admin
                .updateUserById(uid, { email: body.email })
                .catch((e) => console.warn('[instructor] Supabase email sync failed:', e.message));
        }
    }

    return (await get(id)).instructor;
};

const remove = async (id) => {
    const existing = await findById(id);
    if (!existing) throw new HttpError(404, 'Instructor not found');

    await authDb.query(`DELETE FROM users WHERE "userId" = :id`, {
        replacements: { id: String(id) },
        type: QueryTypes.DELETE,
    });
    if (existing.instructorPhoto) removeFile(existing.instructorPhoto);

    // Drop the Supabase Auth user so the email is freed for re-use.
    const uid = String(existing.passwordHash || '').replace(/^supabase:/, '');
    if (uid) {
        await supabaseAdmin.auth.admin
            .deleteUser(uid)
            .catch((e) => console.warn('[instructor] Supabase delete failed:', e.message));
    }

    return { message: 'Instructor deleted successfully' };
};

module.exports = { list, get, create, update, remove };
