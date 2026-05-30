// Bunny Stream adapter — handles lesson video upload + playback.
//
// Flow per video:
//   1. createVideo()       → POST /library/{id}/videos       (returns guid)
//   2. uploadVideo(guid)   → PUT  /library/{id}/videos/{guid} (raw body)
//   3. Frontend plays via the HLS URL or iframe embed.
//
// Bunny does the transcoding + HLS/adaptive bitrate behind the CDN, so we
// only need to store the GUID + hostname combo. `lessons.lesson_src` will
// hold the embed URL or just the GUID (caller decides the convention).
//
// Auth: Bunny Stream uses an API key in the AccessKey header — different
// from the Bunny CDN pull-zone key. Get it from
//   https://dash.bunny.net/stream/<library-id>/api

const fs     = require('fs');
const crypto = require('crypto');
const axios  = require('axios');
const env    = require('../config/env');

const TIMEOUT_MS = 60_000;

// Bunny's TUS resumable-upload endpoint. The browser uploads directly here so
// large videos never pass through our app server.
const TUS_ENDPOINT = 'https://video.bunnycdn.com/tusupload';

function authHeaders() {
    if (!env.bunnyStream.apiKey) {
        throw new Error('BUNNY_STREAM_API_KEY not configured');
    }
    return {
        AccessKey: env.bunnyStream.apiKey,
        Accept:    'application/json',
    };
}

function libraryUrl(path = '') {
    if (!env.bunnyStream.libraryId) {
        throw new Error('BUNNY_STREAM_LIBRARY_ID not configured');
    }
    return `https://video.bunnycdn.com/library/${env.bunnyStream.libraryId}${path}`;
}

// Step 1 — register a new video and get its GUID. Optional `collectionId`
// drops the video into a Bunny Stream collection (folder) so every video
// belonging to one of our courses stays grouped, mirroring the per-course
// layout we use for R2 (courses/<id>/...).
async function createVideo(title, { collectionId } = {}) {
    const body = { title: String(title || 'Untitled Lesson') };
    if (collectionId) body.collectionId = collectionId;
    const res = await axios.post(
        libraryUrl('/videos'),
        body,
        {
            headers: { ...authHeaders(), 'Content-Type': 'application/json' },
            timeout: TIMEOUT_MS,
        }
    );
    return res.data; // { guid, libraryId, title, ... }
}

// Create a Bunny Stream collection (folder) at the library level. We use
// one collection per course so every lesson video for that course is grouped
// together inside the Bunny dashboard + API listings. Returns the collection
// metadata (`guid` is what we persist on the course row).
async function createCollection(name) {
    const res = await axios.post(
        libraryUrl('/collections'),
        { name: String(name || 'Collection') },
        {
            headers: { ...authHeaders(), 'Content-Type': 'application/json' },
            timeout: TIMEOUT_MS,
        }
    );
    return res.data; // { guid, name, videoCount, ... }
}

// Step 2 — upload the raw video bytes for the GUID returned by createVideo().
async function uploadVideo(guid, file) {
    if (!file?.path) throw new Error('uploadVideo: file.path is required');
    const stream = fs.createReadStream(file.path);
    try {
        await axios.put(
            libraryUrl(`/videos/${guid}`),
            stream,
            {
                headers: {
                    AccessKey:      env.bunnyStream.apiKey,
                    'Content-Type': file.mimetype || 'application/octet-stream',
                },
                // Big files — disable axios's default 10MB limit.
                maxBodyLength:   Infinity,
                maxContentLength: Infinity,
                timeout: 30 * 60_000, // 30min cap on a single upload
            }
        );
    } finally {
        if (file.path && fs.existsSync(file.path)) {
            try { fs.unlinkSync(file.path); } catch (_) { /* ignore */ }
        }
    }
}

// Convenience — create + upload in one call. Returns the playback URLs and
// the GUID the caller should persist in DB (e.g. lessons.lesson_src). Pass
// `collectionId` to land the video inside a Bunny Stream collection (folder).
async function uploadVideoForTitle(title, file, opts = {}) {
    const created = await createVideo(title, opts);
    await uploadVideo(created.guid, file);
    return {
        guid: created.guid,
        title: created.title,
        // HLS playlist served by the Bunny CDN — works in <video> tags via
        // hls.js, or directly in Safari.
        hlsUrl: `https://${env.bunnyStream.cdnHostname}/${created.guid}/playlist.m3u8`,
        // iframe embed URL — paste straight into <iframe src="...">. The
        // public detail page renders this when lesson_type === 'video'.
        embedUrl: `https://iframe.mediadelivery.net/embed/${env.bunnyStream.libraryId}/${created.guid}`,
        // Direct thumbnail URL — useful for lesson list cards.
        thumbnailUrl: `https://${env.bunnyStream.cdnHostname}/${created.guid}/thumbnail.jpg`,
    };
}

// Ingest a video into Bunny Stream from a URL (so the admin doesn't have to
// open the Bunny dashboard and paste the URL there). Two-step per Bunny docs:
// create the video shell, then trigger the fetch from URL. Bunny transcodes
// in the background — the lesson can save immediately; the existing
// /video/:guid/status endpoint reports progress.
async function importVideoFromUrl(url, title, opts = {}) {
    if (!url) throw new Error('importVideoFromUrl: url is required');
    const created = await createVideo(title, opts);
    await axios.post(
        libraryUrl(`/videos/${created.guid}/fetch`),
        { url: String(url) },
        {
            headers: { ...authHeaders(), 'Content-Type': 'application/json' },
            timeout: TIMEOUT_MS,
        }
    );
    return {
        guid: created.guid,
        title: created.title,
        hlsUrl: hlsUrl(created.guid),
        embedUrl: embedUrl(created.guid),
        thumbnailUrl: thumbnailUrl(created.guid),
    };
}

// Heuristic: should we send this URL through Bunny's fetch API? Yes when it's
// an external http(s) URL we don't already host on Bunny. Bunny URLs (CDN
// playlist, iframe embed, raw API host) are already in our library so
// re-importing would just create a duplicate.
function isExternalImportableUrl(src) {
    const url = String(src || '').trim();
    if (!url || !/^https?:\/\//i.test(url)) return false;
    const cdnHost = String(env.bunnyStream.cdnHostname || '').replace(/^https?:\/\//, '');
    if (cdnHost && url.includes(cdnHost)) return false;
    if (/iframe\.mediadelivery\.net\//i.test(url)) return false;
    if (/video\.bunnycdn\.com\//i.test(url)) return false;
    return true;
}

async function deleteVideo(guid) {
    if (!guid) return;
    try {
        await axios.delete(libraryUrl(`/videos/${guid}`), {
            headers: authHeaders(),
            timeout: TIMEOUT_MS,
        });
    } catch (e) {
        console.warn('[bunny-stream] delete failed:', e.message);
    }
}

async function getVideo(guid) {
    if (!guid) return null;
    const res = await axios.get(libraryUrl(`/videos/${guid}`), {
        headers: authHeaders(),
        timeout: TIMEOUT_MS,
    });
    return res.data;
}

// Stable helpers for building URLs from a stored GUID (the GUID is the only
// thing we persist; URLs are derived at read time so we can swap CDN
// hostnames in env without a DB migration).
function hlsUrl(guid) {
    if (!guid || !env.bunnyStream.cdnHostname) return null;
    return `https://${env.bunnyStream.cdnHostname}/${guid}/playlist.m3u8`;
}
function embedUrl(guid) {
    if (!guid || !env.bunnyStream.libraryId) return null;
    return `https://iframe.mediadelivery.net/embed/${env.bunnyStream.libraryId}/${guid}`;
}
function thumbnailUrl(guid) {
    if (!guid || !env.bunnyStream.cdnHostname) return null;
    return `https://${env.bunnyStream.cdnHostname}/${guid}/thumbnail.jpg`;
}

// Mint everything the browser needs for a direct TUS upload to Bunny:
//   1. register the video to get its GUID
//   2. compute the presigned auth signature
//      signature = sha256(libraryId + apiKey + expire + guid)
// The API key never leaves the server — only the derived signature is sent
// to the browser, and it expires (default 2h).
async function createDirectUpload(title, opts = {}) {
    if (!env.bunnyStream.apiKey || !env.bunnyStream.libraryId) {
        throw new Error('Bunny Stream is not configured (BUNNY_STREAM_API_KEY / LIBRARY_ID)');
    }
    const created = await createVideo(title, opts);
    const guid = created.guid;
    const libraryId = String(env.bunnyStream.libraryId);
    const expire = Date.now() + 2 * 60 * 60 * 1000; // 2 hours
    const signature = crypto
        .createHash('sha256')
        .update(`${libraryId}${env.bunnyStream.apiKey}${expire}${guid}`)
        .digest('hex');
    return {
        guid,
        libraryId,
        signature,
        expire,
        tusEndpoint: TUS_ENDPOINT,
        // The HLS playlist is what we persist on the lesson + play via hls.js.
        hlsUrl: hlsUrl(guid),
        embedUrl: embedUrl(guid),
        thumbnailUrl: thumbnailUrl(guid),
    };
}

// Bunny encode status codes: 0 Created, 1 Uploaded, 2 Processing,
// 3 Transcoding, 4 Finished, 5 Error, 6 UploadFailed. We surface the raw
// status + encode progress so the admin UI can show "Processing 45%".
async function getStatus(guid) {
    const v = await getVideo(guid);
    const status = v?.status ?? null;
    return {
        guid,
        status,
        encodeProgress: v?.encodeProgress ?? 0,
        ready: status === 4,
        failed: status === 5 || status === 6,
    };
}

module.exports = {
    createVideo,
    uploadVideo,
    uploadVideoForTitle,
    importVideoFromUrl,
    isExternalImportableUrl,
    createCollection,
    createDirectUpload,
    getStatus,
    deleteVideo,
    getVideo,
    hlsUrl,
    embedUrl,
    thumbnailUrl,
};
