import { useRef, useState } from 'react';
import * as tus from 'tus-js-client';
import { createVideoUpload, getVideoStatus } from '../../../api/curriculum';
import { detectFileDuration } from './videoDuration';

// YouTube-style direct upload to Bunny Stream.
//   1. ask our backend for a presigned TUS ticket (guid + signature)
//   2. stream the file straight to Bunny (browser -> CDN, never our server)
//   3. poll transcode status so we can show Processing -> Ready
// Calls onUploaded(hlsUrl, guid) the moment the upload finishes (the lesson is
// saveable then; Bunny keeps transcoding in the background).
export default function BunnyVideoUploader({ title, currentSrc, onUploaded, onDuration }) {
    const [phase, setPhase] = useState('idle'); // idle | uploading | processing | ready | error
    const [pct, setPct] = useState(0);
    const [encodePct, setEncodePct] = useState(0);
    const [fileName, setFileName] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const pollRef = useRef(null);

    const stopPolling = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };

    const pollStatus = (guid) => {
        stopPolling();
        pollRef.current = setInterval(async () => {
            try {
                const s = await getVideoStatus(guid);
                setEncodePct(s.encodeProgress || 0);
                if (s.ready) { setPhase('ready'); stopPolling(); }
                else if (s.failed) { setPhase('error'); setErrorMsg('Bunny failed to process this video.'); stopPolling(); }
            } catch (_e) { /* keep polling; transient */ }
        }, 3000);
    };

    const handleFile = async (file) => {
        if (!file) return;
        setFileName(file.name);
        setErrorMsg('');
        setPct(0);
        setEncodePct(0);

        // Best-effort duration prefill from the local file.
        detectFileDuration(file).then((d) => { if (d) onDuration?.(d); }).catch(() => {});

        let ticket;
        try {
            ticket = await createVideoUpload(title || file.name);
        } catch (e) {
            setPhase('error');
            setErrorMsg(e.response?.data?.error || 'Could not start the upload (Bunny not configured?)');
            return;
        }

        setPhase('uploading');
        const upload = new tus.Upload(file, {
            endpoint: ticket.tusEndpoint,
            retryDelays: [0, 3000, 5000, 10000, 20000],
            chunkSize: 50 * 1024 * 1024, // 50MB chunks -> resumable + bounded memory
            headers: {
                AuthorizationSignature: ticket.signature,
                AuthorizationExpire: String(ticket.expire),
                VideoId: ticket.guid,
                LibraryId: String(ticket.libraryId),
            },
            metadata: { filetype: file.type, title: title || file.name },
            onError: (err) => {
                setPhase('error');
                setErrorMsg(err?.message || 'Upload failed');
            },
            onProgress: (sent, total) => {
                setPct(total ? Math.round((sent / total) * 100) : 0);
            },
            onSuccess: () => {
                setPct(100);
                setPhase('processing');
                // The HLS URL is stable from the guid — hand it back now so the
                // lesson can be saved while Bunny finishes transcoding.
                onUploaded?.(ticket.hlsUrl, ticket.guid);
                pollStatus(ticket.guid);
            },
        });
        upload.start();
    };

    return (
        <div className="mb-3">
            <label className="ol-form-label">Video file</label>

            {currentSrc && phase === 'idle' && (
                <p className="text-[13px] text-gray mb-2 break-all">Current: {currentSrc}</p>
            )}

            <input
                type="file"
                className="ol-form-control"
                accept="video/*"
                disabled={phase === 'uploading' || phase === 'processing'}
                onChange={(e) => handleFile(e.target.files?.[0] || null)}
            />

            {phase !== 'idle' && (
                <div className="mt-2">
                    <div className="flex items-center justify-between text-[13px] text-dark mb-1">
                        <span className="truncate max-w-[70%]">{fileName}</span>
                        <span className="text-gray">
                            {phase === 'uploading' && `Uploading ${pct}%`}
                            {phase === 'processing' && (encodePct ? `Processing ${encodePct}%` : 'Processing…')}
                            {phase === 'ready' && 'Ready ✓'}
                            {phase === 'error' && 'Failed'}
                        </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-black/10 overflow-hidden">
                        <div
                            className="h-full rounded-full transition-[width] duration-200"
                            style={{
                                width: `${phase === 'uploading' ? pct : (phase === 'processing' ? (encodePct || 15) : 100)}%`,
                                backgroundColor: phase === 'error' ? '#dc2626' : '#FF6A00',
                            }}
                        />
                    </div>
                    {phase === 'processing' && (
                        <p className="text-[12px] text-gray mt-1">
                            Uploaded to Bunny Stream. You can save the lesson now — playback becomes available once transcoding finishes.
                        </p>
                    )}
                    {phase === 'ready' && (
                        <p className="text-[12px] text-green-600 mt-1">Stored in Bunny Stream and ready to stream.</p>
                    )}
                    {phase === 'error' && (
                        <p className="text-[12px] text-red-600 mt-1">{errorMsg}</p>
                    )}
                </div>
            )}
        </div>
    );
}
