import { useState } from 'react';

/**
 * Single-field category form — only the category name is editable. Icon,
 * schools, keywords, description and images were removed per request so adding
 * a category takes one field. On EDIT we silently resubmit any existing values
 * (icon / keywords / description / school mapping) so saving the name alone
 * doesn't wipe them, since the backend update rewrites those columns.
 */
export default function CategoryForm({ initial = {}, hiddenParentId, onSubmit }) {
    const [title, setTitle] = useState(initial.title || '');

    const submit = (e) => {
        e.preventDefault();
        const fd = new FormData();
        const parentId = hiddenParentId !== undefined ? hiddenParentId : (initial.parent_id ?? 0);
        if (parentId) fd.append('parent_id', parentId);
        fd.append('title', title);
        // Preserve existing values on edit (no-ops on a fresh add).
        if (initial.icon) fd.append('icon', initial.icon);
        if (initial.keywords) fd.append('keywords', initial.keywords);
        if (initial.description) fd.append('description', initial.description);
        if (Array.isArray(initial.clg_ids) && initial.clg_ids.length) {
            initial.clg_ids.forEach((id) => fd.append('clgIds[]', id));
        }
        onSubmit(fd);
    };

    return (
        <form onSubmit={submit}>
            <div className="mb-4">
                <label className="ol-form-label">
                    Category<span className="text-danger ml-1">*</span>
                </label>
                <input
                    className="ol-form-control"
                    name="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter category name"
                    required
                    autoFocus
                />
            </div>
            <div>
                <button className="ol-btn-primary">Submit</button>
            </div>
        </form>
    );
}
