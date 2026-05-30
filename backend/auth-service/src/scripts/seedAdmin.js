import 'dotenv/config';
import sequelize from '../db/index.js';
import User from '../db/models/User.js';
import Role from '../db/models/Role.js';
import { generateUserID, generateRoleID } from '../utils/uidGeneration.js';
import supabaseAdmin from '../lib/supabaseAdmin.js';

// Seed a platform admin that can actually LOG IN through the new flow:
//   1. create/locate the Supabase Auth user (owns the password)
//   2. mirror a lucy_devdb.users profile row (role=admin) with
//      passwordHash = `supabase:<uid>` (the JWT-subject back-pointer)
// Usage: node src/scripts/seedAdmin.js [email] [password] [name]
(async () => {
    try {
        await sequelize.authenticate();
        await sequelize.sync();

        const email = process.argv[2] || 'vradmin@vrroboticsacademy.com';
        const password = process.argv[3] || 'VrAdmin@2026';
        const name = process.argv[4] || 'VR Robotics Admin';

        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
            throw new Error('SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY must be set in auth-service/.env');
        }

        let adminRole = await Role.findOne({ where: { role: 'admin' } });
        if (!adminRole) {
            adminRole = await Role.create({ roleId: generateRoleID('R'), role: 'admin' });
            console.log(`Created admin role roleId=${adminRole.roleId}`);
        }

        // 1. Ensure the Supabase Auth user exists. createUser fails if the
        //    email is taken, so on conflict we look it up and reset the
        //    password to the requested one (idempotent re-runs).
        let supabaseUid;
        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { name, role: 'admin' },
        });
        if (createErr) {
            // Already exists → find by listing and update the password.
            const { data: list } = await supabaseAdmin.auth.admin.listUsers();
            const found = list?.users?.find((u) => u.email === email);
            if (!found) throw createErr;
            supabaseUid = found.id;
            await supabaseAdmin.auth.admin.updateUserById(supabaseUid, {
                password,
                user_metadata: { name, role: 'admin' },
            });
            console.log(`Supabase user already existed — password reset (uid=${supabaseUid})`);
        } else {
            supabaseUid = created.user.id;
            console.log(`Created Supabase Auth user uid=${supabaseUid}`);
        }

        // 2. Upsert the profile row.
        const existing = await User.findOne({ where: { email } });
        if (existing) {
            await existing.update({
                passwordHash: `supabase:${supabaseUid}`,
                roleId: adminRole.roleId,
                profileStatus: 'active',
            });
            console.log(`Updated profile ${email} (userId=${existing.userId}) → role=admin`);
        } else {
            const user = await User.create({
                userId: generateUserID(),
                email,
                passwordHash: `supabase:${supabaseUid}`,
                name,
                phone: '0000000000',
                dob: '2000-01-01',
                gender: 'male',
                roleId: adminRole.roleId,
                profileStatus: 'active',
            });
            console.log(`Created admin profile userId=${user.userId} email=${email}`);
        }

        console.log(`✅ Login with: email=${email} password=${password}`);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
