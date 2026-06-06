import DOMPurify from 'dompurify';

// Sanitize untrusted/rich-text HTML before injecting it via
// dangerouslySetInnerHTML. Course descriptions, lesson summaries/attachments
// and teacher bios are authored by teachers/admins (a semi-trusted, multi-user
// set) and rendered into students' browsers on the app origin — without this a
// malicious <script>/onerror payload would run with the student's session and
// could steal their Supabase access token. DOMPurify strips scripts and event
// handlers while keeping normal rich-text formatting.
export function sanitizeHtml(dirty: unknown): string {
  if (dirty == null) return '';
  return DOMPurify.sanitize(String(dirty));
}

export default sanitizeHtml;
