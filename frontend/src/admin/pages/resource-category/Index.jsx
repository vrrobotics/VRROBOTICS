import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Trash2 } from 'lucide-react';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import {
    listResourceCategories, storeResourceCategory, deleteResourceCategory,
} from '../../api/resourceCategory';

/**
 * Manage Resource Categories — admin CRUD for the categories that group
 * teaching resources (Coding, Maths, Science…). These drive the category radio
 * filter on the teacher Resources dashboard. Single field: the category name.
 * ?action=add (from the "Add Category" sidebar link) auto-opens the Add modal.
 */
export default function ResourceCategoryIndex() {
    const [params, setParams] = useSearchParams();
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [addOpen, setAddOpen] = useState(false);
    const [name, setName] = useState('');
    const [saving, setSaving] = useState(false);
    const [confirm, setConfirm] = useState(null);

    const load = async () => {
        setLoading(true);
        try { const r = await listResourceCategories(); setCategories(r?.categories || []); }
        catch { setCategories([]); }
        finally { setLoading(false); }
    };
    useEffect(() => { load(); }, []);

    useEffect(() => {
        if (params.get('action') === 'add') {
            setAddOpen(true);
            const next = new URLSearchParams(params);
            next.delete('action');
            setParams(next, { replace: true });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const submit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await storeResourceCategory({ name });
            toast.success('Category added');
            setName(''); setAddOpen(false); load();
        } catch (err) {
            toast.error(err?.response?.data?.error || 'Failed');
        } finally { setSaving(false); }
    };

    const handleDelete = async (id) => {
        try { await deleteResourceCategory(id); toast.success('Category deleted'); setConfirm(null); load(); }
        catch (err) { toast.error(err?.response?.data?.error || 'Failed'); setConfirm(null); }
    };

    return (
        <div>
            <div className="ol-card rounded-ol-8 mb-3">
                <div className="ol-card-body py-12px px-20px my-3">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <h4 className="text-[16px] font-semibold text-dark m-0 flex items-center gap-2">
                            <i className="fi-rr-settings-sliders" /> Resource Categories
                        </h4>
                        <button type="button" className="ol-btn-outline-secondary flex items-center gap-10px" onClick={() => setAddOpen(true)}>
                            <span className="fi-rr-plus" /> <span>Add Category</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="ol-card p-3">
                <div className="ol-card-body">
                    {loading ? (
                        <p className="text-gray text-[14px] py-6 text-center">Loading…</p>
                    ) : categories.length === 0 ? (
                        <div className="py-12 text-center border border-dashed border-border rounded-ol-8">
                            <p className="text-[16px] font-semibold text-dark mb-1">No categories yet</p>
                            <p className="text-[13px] text-gray">Click “Add Category” to create the first one.</p>
                        </div>
                    ) : (
                        <ul className="list-none p-0 m-0 divide-y divide-ebordermuted">
                            {categories.map((c) => (
                                <li key={c.id} className="flex items-center justify-between py-3 px-1">
                                    <span className="text-[14px] font-medium text-dark">{c.name}</span>
                                    <button type="button" className="text-gray hover:text-danger px-2" title="Delete" onClick={() => setConfirm(c.id)}>
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {addOpen && (
                <Modal title="Add Category" size="sm" onClose={() => setAddOpen(false)}>
                    <form onSubmit={submit}>
                        <div className="mb-4">
                            <label className="ol-form-label">Category<span className="text-danger ml-1">*</span></label>
                            <input className="ol-form-control" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter category name" required autoFocus />
                        </div>
                        <div className="flex justify-end">
                            <button type="submit" className="ol-btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Submit'}</button>
                        </div>
                    </form>
                </Modal>
            )}

            {confirm && (
                <ConfirmDialog
                    message="Delete this category?"
                    onCancel={() => setConfirm(null)}
                    onConfirm={() => handleDelete(confirm)}
                />
            )}
        </div>
    );
}
