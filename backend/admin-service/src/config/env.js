require('dotenv').config();

module.exports = {
    port: Number(process.env.PORT || 5000),
    env: process.env.NODE_ENV || 'development',
    appUrl: process.env.APP_URL || 'http://localhost:5000',
    uploadDir: process.env.UPLOAD_DIR || 'uploads',
    jwt: {
        secret: process.env.JWT_SECRET || 'change-me-in-production',
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    },
    // Primary DB handle — points at the `lms_admin` schema in Supabase
    // Postgres. `url` (DATABASE_URL) wins if set; otherwise we fall back to
    // discrete host/port/user/pass for legacy local dev.
    db: {
        url: process.env.DATABASE_URL || null,
        name: process.env.DB_NAME,
        user: process.env.DB_USER,
        pass: process.env.DB_PASS,
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        schema: process.env.DB_SCHEMA || 'lms_admin',
    },
    // Cross-schema handle — same physical Supabase Postgres DB, different
    // schema (`lucy_devdb`). Used by College Dashboard + StudentService.
    authDb: {
        url: process.env.DATABASE_URL || process.env.AUTH_DATABASE_URL || null,
        name: process.env.AUTH_DB_NAME || process.env.DB_NAME,
        user: process.env.DB_USER,
        pass: process.env.DB_PASS,
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        schema: process.env.AUTH_DB_SCHEMA || 'lucy_devdb',
    },
    // Read-only handle to assessment-service's tables. In Supabase Postgres
    // these live in the same `lucy_devdb` schema, so this defaults to the
    // same DB/schema as authDb. Kept as a separate config slot so we can
    // re-point it (e.g. to a separate Supabase project) without code changes.
    assessmentDb: {
        url: process.env.DATABASE_URL || process.env.ASSESSMENT_DATABASE_URL || null,
        name: process.env.ASSESSMENT_DB_NAME || process.env.DB_NAME,
        user: process.env.DB_USER,
        pass: process.env.DB_PASS,
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        schema: process.env.ASSESSMENT_DB_SCHEMA || 'lucy_devdb',
    },
    // Supabase client config (server-side). The service_role key is
    // privileged — only ever used inside admin-service for admin user
    // management (createUser / updateUserById / deleteUser). Never expose
    // it to the frontend or log it.
    supabase: {
        url: process.env.SUPABASE_URL,
        anonKey: process.env.SUPABASE_ANON_KEY,
        serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        jwtSecret: process.env.SUPABASE_JWT_SECRET,
    },
    // Cloudflare R2 (S3-compatible) — stores PDFs, images, thumbnails,
    // attachments, certificates, exports. Public URL is the worker / custom
    // domain that fronts the bucket; assets are referenced in DB by URL.
    r2: {
        accountId: process.env.R2_ACCOUNT_ID,
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        bucket: process.env.R2_BUCKET_NAME,
        publicUrl: process.env.R2_PUBLIC_URL,
    },
    // Bunny Stream — stores course/lesson videos. Returns video GUIDs;
    // playback URLs are constructed from the CDN hostname + GUID.
    bunnyStream: {
        libraryId: process.env.BUNNY_STREAM_LIBRARY_ID,
        apiKey: process.env.BUNNY_STREAM_API_KEY,
        cdnHostname: process.env.BUNNY_STREAM_CDN_HOSTNAME,
    },
    mail: {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
        from: process.env.SMTP_FROM,
        lmsLoginUrl: process.env.LMS_LOGIN_URL || 'http://localhost:5173/login',
    },
    internalSecret: process.env.INTERNAL_API_SECRET || '',
};
