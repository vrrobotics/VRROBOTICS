import 'dotenv/config';
import sequelize from '../db/index.js';
import User from '../db/models/User.js';
import Role from '../db/models/Role.js';
import { generateUserID, generateRoleID } from '../utils/uidGeneration.js';
import supabaseAdmin from '../lib/supabaseAdmin.js';

// Seed a college-scoped admin that can log in through Supabase Auth.
// Usage: node src/scripts/seedCollegeAdmin.js [email] [password] [name] [collegeId]
(async () => {
    try {
        await sequelize.authenticate();
        await sequelize.sync();

        const email = process.argv[2] || 'college-admin@gmail.com';
        const password = process.argv[3] || 'college123';
        const name = process.argv[4] || 'College Admin';
        const collegeId = process.argv[5] || 'COLLEGE001';

        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
            throw new Error('SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY must be set in auth-service/.env');
        }

        let adminRole = await Role.findOne({ where: { role: 'admin' } });
        if (!adminRole) {
            adminRole = await Role.create({ roleId: generateRoleID('R'), role: 'admin' });
            console.log(`Created admin role roleId=${adminRole.roleId}`);
        }

        // 1. Supabase Auth user (idempotent).
        let supabaseUid;
        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { name, role: 'admin', collegeId },
        });
        if (createErr) {
            const { data: list } = await supabaseAdmin.auth.admin.listUsers();
            const found = list?.users?.find((u) => u.email === email);
            if (!found) throw createErr;
            supabaseUid = found.id;
            await supabaseAdmin.auth.admin.updateUserById(supabaseUid, {
                password,
                user_metadata: { name, role: 'admin', collegeId },
            });
            console.log(`Supabase user already existed — password reset (uid=${supabaseUid})`);
        } else {
            supabaseUid = created.user.id;
            console.log(`Created Supabase Auth user uid=${supabaseUid}`);
        }

        // 2. Profile row scoped to the college.
        const existing = await User.findOne({ where: { email } });
        if (existing) {
            await existing.update({
                passwordHash: `supabase:${supabaseUid}`,
                roleId: adminRole.roleId,
                profileStatus: 'active',
                collegeId,
            });
            console.log(`Updated profile ${email} (userId=${existing.userId}) → college admin (collegeId=${collegeId})`);
        } else {
            const user = await User.create({
                userId: generateUserID(),
                email,
                passwordHash: `supabase:${supabaseUid}`,
                name,
                phone: '9999999999',
                dob: '2000-01-01',
                gender: 'male',
                roleId: adminRole.roleId,
                profileStatus: 'active',
                collegeId,
            });
            console.log(`Created college admin userId=${user.userId} email=${email} collegeId=${collegeId}`);
        }

        console.log(`\n✅ Login with:`);
        console.log(`   Email: ${email}`);
        console.log(`   Password: ${password}`);
        console.log(`   College ID: ${collegeId}\n`);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
