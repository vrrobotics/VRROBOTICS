const multer = require('multer');
const path = require('path');
const fs = require('fs');

const tmp = path.join(__dirname, '..', '..', 'tmp');
if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, tmp),
    // SECURITY: file.originalname is fully client-controlled. Using it raw lets
    // a crafted name like `x/../../../src/server.js` escape tmp/ and overwrite
    // arbitrary files (path traversal → potential RCE). path.basename strips any
    // directory components and we also scrub leftover separators.
    filename: (req, file, cb) => {
        const safe = path.basename(file.originalname || 'upload').replace(/[/\\]/g, '_');
        cb(null, `${Date.now()}-${safe}`);
    },
});

module.exports = multer({ storage, limits: { fileSize: 200 * 1024 * 1024 } });
