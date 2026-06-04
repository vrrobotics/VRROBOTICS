import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import MentorPanel, { MENTOR_SECTIONS } from './MentorPanel';

// Slug → section label for the mentor sidebar items (lives in MentorPanel).
const MENTOR_TAB_LABEL = Object.fromEntries(MENTOR_SECTIONS.map((s) => [s.slug, s.label]));

/**
 * College Admin landing (/admin/college). The old School Dashboard (KPIs) and
 * the Batches tools were removed at the admin's request — Batches now lives
 * under the root/super admin. This page now just renders the Mentor Dashboard
 * feature set, one section at a time, driven by ?tab= from the sidebar items.
 */
const VALID_TABS = Object.keys(MENTOR_TAB_LABEL);

export default function CollegeDashboardPage() {
    const [params] = useSearchParams();
    const initialTab = VALID_TABS.includes(params.get('tab')) ? params.get('tab') : 'dashboard';
    const [tab, setTab] = useState(initialTab);

    useEffect(() => {
        const fromUrl = VALID_TABS.includes(params.get('tab')) ? params.get('tab') : 'dashboard';
        if (fromUrl !== tab) setTab(fromUrl);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params]);

    // Default (no/unknown tab) → Mentor Dashboard; mentor-* slugs → their section.
    return <MentorPanel section={MENTOR_TAB_LABEL[tab] || 'Mentor Dashboard'} />;
}
