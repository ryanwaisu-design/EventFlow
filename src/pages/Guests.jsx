import { useState, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { getPrimaryAffiliation, generateId, nowISO } from '../utils/helpers';
import { importGuestsFromExcel, parseImportedGuestRow } from '../utils/export';
import GuestAvatar from '../components/ui/GuestAvatar';
import CategoryTag from '../components/ui/CategoryTag';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import ActionDialog from '../components/ui/ActionDialog';
import PhotoPicker from '../components/guests/PhotoPicker';
import { FormField, Input, Select, Textarea, CategorySelect, CategoryFilterSelect } from '../components/ui/FormFields';
import {
  findExistingDuplicateNames,
  analyzeImportDuplicateNames,
  formatDuplicateNamesMessage,
} from '../utils/guestDuplicates';

const emptyGuest = () => ({
  name: '', photo: '', category: 'other',
  photoSourceUrl: '', photoSourceName: '', photoSourceDate: '', photoRegion: '',
  affiliations: [{ organization: '', title: '', isPrimary: true }],
  email: '', phone: '', address: '',
  assistantName: '', assistantEmail: '', assistantPhone: '',
  notes: '', tags: [],
});

export default function Guests() {
  const { guests, addGuest, updateGuest, deleteGuest, deleteGuests, importGuests, showToast, guestCategories, addGuestCategory } = useApp();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [orgFilter, setOrgFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyGuest());
  const [deleteId, setDeleteId] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [duplicateDialog, setDuplicateDialog] = useState(null);
  const fileRef = useRef(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return guests.filter((g) => {
      const aff = getPrimaryAffiliation(g);
      const matchSearch = !q || g.name?.toLowerCase().includes(q) || aff.organization?.toLowerCase().includes(q);
      const matchCat = !categoryFilter || g.category === categoryFilter;
      const matchOrg = !orgFilter || aff.organization?.toLowerCase().includes(orgFilter.toLowerCase());
      return matchSearch && matchCat && matchOrg;
    });
  }, [guests, search, categoryFilter, orgFilter]);

  const selectedIds = [...selected];
  const allFilteredSelected = filtered.length > 0 && filtered.every((g) => selected.has(g.id));

  const toggleSelect = (id, e) => {
    e?.stopPropagation();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((g) => next.delete(g.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((g) => next.add(g.id));
        return next;
      });
    }
  };

  const handleBulkDelete = () => {
    deleteGuests(selectedIds);
    setSelected(new Set());
    setConfirmBulk(false);
  };

  const handleDeleteAll = () => {
    deleteGuests(guests.map((g) => g.id));
    setSelected(new Set());
    setConfirmDeleteAll(false);
  };

  const openAdd = () => { setEditing(null); setForm(emptyGuest()); setModalOpen(true); };
  const openEdit = (g) => {
    setEditing(g);
    setForm({
      ...emptyGuest(),
      ...g,
      affiliations: g.affiliations?.length ? g.affiliations : [{ organization: '', title: '', isPrimary: true }],
      tags: g.tags || [],
    });
    setModalOpen(true);
  };

  const updateAffiliation = (idx, field, value) => {
    setForm((f) => {
      const affs = [...f.affiliations];
      affs[idx] = { ...affs[idx], [field]: value };
      return { ...f, affiliations: affs };
    });
  };

  const setPrimaryAff = (idx) => {
    setForm((f) => ({
      ...f,
      affiliations: f.affiliations.map((a, i) => ({ ...a, isPrimary: i === idx })),
    }));
  };

  const addAffiliation = () => {
    setForm((f) => ({ ...f, affiliations: [...f.affiliations, { organization: '', title: '', isPrimary: false }] }));
  };

  const removeAffiliation = (idx) => {
    setForm((f) => {
      const affs = f.affiliations.filter((_, i) => i !== idx);
      if (affs.length && !affs.some((a) => a.isPrimary)) affs[0].isPrimary = true;
      return { ...f, affiliations: affs.length ? affs : [{ organization: '', title: '', isPrimary: true }] };
    });
  };

  const saveGuest = (data) => {
    if (editing) updateGuest(editing.id, data);
    else addGuest(data);
    setModalOpen(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name?.trim()) { showToast('請填寫姓名', 'error'); return; }
    if (form.photo && !form.photoSourceDate) {
      showToast('已上傳相片，請填寫來源日期', 'error');
      return;
    }
    const data = {
      ...form,
      name: form.name.trim(),
      tags: typeof form.tags === 'string' ? form.tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean) : form.tags,
    };
    if (!editing) {
      const dupes = findExistingDuplicateNames([data.name], guests);
      if (dupes.length) {
        setDuplicateDialog({ kind: 'add', data, names: dupes });
        return;
      }
    }
    saveGuest(data);
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await importGuestsFromExcel(file);
      const parsed = rows.map((r) => parseImportedGuestRow(r, generateId, nowISO, guestCategories)).filter(Boolean);
      if (!parsed.length) { showToast('未找到有效嘉賓資料', 'warning'); return; }
      const { all } = analyzeImportDuplicateNames(parsed, guests);
      if (all.length) {
        setDuplicateDialog({ kind: 'import', guests: parsed, names: all });
        return;
      }
      importGuests(parsed);
    } catch { showToast('匯入失敗，請檢查檔案格式', 'error'); }
    e.target.value = '';
  };

  const handleDuplicateKeepBoth = () => {
    if (!duplicateDialog) return;
    if (duplicateDialog.kind === 'add') saveGuest(duplicateDialog.data);
    else importGuests(duplicateDialog.guests);
  };

  const handleDuplicateCancel = () => {
    if (duplicateDialog?.kind === 'add') setModalOpen(false);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">嘉賓資料庫</h1>
          <p className="page-subtitle">管理嘉賓資料、所屬單位與聯絡方式</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => fileRef.current?.click()} className="btn-secondary">匯入 Excel</button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
          {guests.length > 0 && (
            <button onClick={() => setConfirmDeleteAll(true)} className="btn-danger">刪除全部</button>
          )}
          <button onClick={openAdd} className="btn-primary">＋ 新增嘉賓</button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input className="input flex-1" placeholder="搜尋姓名..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <CategoryFilterSelect
          categories={guestCategories}
          value={categoryFilter}
          onChange={setCategoryFilter}
          className="sm:w-40"
        />
        <input className="input sm:w-48" placeholder="篩選單位..." value={orgFilter} onChange={(e) => setOrgFilter(e.target.value)} />
      </div>

      {filtered.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-card rounded-xl border border-border">
          <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={allFilteredSelected}
              onChange={toggleSelectAllFiltered}
              className="accent-accent"
            />
            全選本頁（{filtered.length}）
          </label>
          {selectedIds.length > 0 && (
            <>
              <span className="text-sm text-muted">已選 {selectedIds.length} 位</span>
              <button onClick={() => setConfirmBulk(true)} className="btn-danger text-sm py-1.5">
                刪除所選
              </button>
              <button type="button" onClick={() => setSelected(new Set())} className="btn-secondary text-sm py-1.5">
                取消選取
              </button>
            </>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState icon="◎" title="尚無嘉賓" description="新增嘉賓或從 Excel 匯入資料" action={<button onClick={openAdd} className="btn-primary">新增嘉賓</button>} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((g) => {
            const aff = getPrimaryAffiliation(g);
            const isSelected = selected.has(g.id);
            return (
              <div
                key={g.id}
                role="button"
                tabIndex={0}
                onClick={() => openEdit(g)}
                onKeyDown={(e) => { if (e.key === 'Enter') openEdit(g); }}
                className={`card p-4 text-left hover:border-accent/40 transition-all group cursor-pointer relative ${
                  isSelected ? 'border-accent/60 ring-1 ring-accent/30' : ''
                }`}
              >
                <label
                  className="absolute top-3 right-3 z-10"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => toggleSelect(g.id, e)}
                    className="w-4 h-4 accent-accent cursor-pointer"
                    aria-label={`選取 ${g.name}`}
                  />
                </label>
                <div className="flex items-start gap-3 pr-6">
                  <GuestAvatar guest={g} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-primary truncate group-hover:text-accent transition-colors">{g.name}</p>
                    <div className="mt-1"><CategoryTag category={g.category} small /></div>
                    <p className="text-sm text-secondary mt-2 truncate">{aff.organization}</p>
                    <p className="text-xs text-muted truncate">{aff.title}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? '編輯嘉賓' : '新增嘉賓'} wide>
        <form onSubmit={handleSubmit}>
          <PhotoPicker guest={form} onChange={(updates) => setForm((f) => ({ ...f, ...updates }))} />

          <div className="grid sm:grid-cols-2 gap-4">
            <FormField label="姓名" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></FormField>
            <FormField label="類別" required>
              <CategorySelect
                value={form.category}
                onChange={(v) => setForm({ ...form, category: v })}
                categories={guestCategories}
                onAddCategory={addGuestCategory}
                required
              />
            </FormField>
          </div>

          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-secondary">所屬單位與職銜</label>
              <button type="button" onClick={addAffiliation} className="text-xs text-accent hover:text-accent-hover">＋ 新增</button>
            </div>
            {form.affiliations.map((aff, idx) => (
              <div key={idx} className="flex gap-2 mb-2 items-center">
                <Input placeholder="單位" value={aff.organization} onChange={(e) => updateAffiliation(idx, 'organization', e.target.value)} className="flex-1" />
                <Input placeholder="職銜" value={aff.title} onChange={(e) => updateAffiliation(idx, 'title', e.target.value)} className="flex-1" />
                <button type="button" onClick={() => setPrimaryAff(idx)} className={`text-xs px-2 py-1 rounded ${aff.isPrimary ? 'bg-accent text-bg' : 'bg-card-hover text-muted'}`}>主要</button>
                {form.affiliations.length > 1 && (
                  <button type="button" onClick={() => removeAffiliation(idx)} className="text-danger text-sm">×</button>
                )}
              </div>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <FormField label="電郵"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></FormField>
            <FormField label="電話"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></FormField>
          </div>
          <FormField label="地址"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></FormField>

          <div className="grid sm:grid-cols-3 gap-4">
            <FormField label="助理姓名"><Input value={form.assistantName} onChange={(e) => setForm({ ...form, assistantName: e.target.value })} /></FormField>
            <FormField label="助理電郵"><Input value={form.assistantEmail} onChange={(e) => setForm({ ...form, assistantEmail: e.target.value })} /></FormField>
            <FormField label="助理電話"><Input value={form.assistantPhone} onChange={(e) => setForm({ ...form, assistantPhone: e.target.value })} /></FormField>
          </div>
          <FormField label="標籤（逗號分隔）"><Input value={Array.isArray(form.tags) ? form.tags.join(', ') : form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></FormField>
          <FormField label="備註"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></FormField>

          <div className="flex justify-between mt-6">
            {editing ? (
              <button type="button" onClick={() => { setModalOpen(false); setDeleteId(editing.id); }} className="btn-danger">刪除嘉賓</button>
            ) : <span />}
            <div className="flex gap-3">
              <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">取消</button>
              <button type="submit" className="btn-primary">儲存</button>
            </div>
          </div>
        </form>
      </Modal>

      <ActionDialog
        open={!!duplicateDialog}
        onClose={() => setDuplicateDialog(null)}
        title="發現重複姓名"
        message={
          duplicateDialog
            ? formatDuplicateNamesMessage(duplicateDialog.names, {
              action: duplicateDialog.kind === 'import' ? '匯入' : '新增',
            })
            : ''
        }
        actions={[
          { label: '兩者皆保留', variant: 'primary', onClick: handleDuplicateKeepBoth },
          { label: '取消', variant: 'secondary', onClick: handleDuplicateCancel },
          { label: '返回', variant: 'secondary', onClick: () => {} },
        ]}
      />

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { deleteGuest(deleteId); setDeleteId(null); }}
        title="確認刪除"
        message="刪除嘉賓將同時移除所有活動中的邀請記錄，此操作無法復原。"
        confirmLabel="刪除"
        danger
      />

      <ConfirmDialog
        open={confirmBulk}
        onClose={() => setConfirmBulk(false)}
        onConfirm={handleBulkDelete}
        title="確認刪除所選嘉賓"
        message={`將刪除 ${selectedIds.length} 位嘉賓，並一併移除其在所有活動中的邀請記錄。此操作無法復原。`}
        confirmLabel="刪除所選"
        danger
      />

      <ConfirmDialog
        open={confirmDeleteAll}
        onClose={() => setConfirmDeleteAll(false)}
        onConfirm={handleDeleteAll}
        title="確認刪除全部嘉賓"
        message={`將刪除資料庫中全部 ${guests.length} 位嘉賓，並一併清除所有相關邀請記錄。此操作無法復原，請先確認已備份。`}
        confirmLabel="刪除全部"
        danger
      />
    </div>
  );
}
