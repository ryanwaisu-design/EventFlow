import { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { clearAllData, exportBackup, importBackup } from '../data/storage';
import { GUEST_REGIONS, DEFAULT_GUEST_SUBCATEGORIES } from '../data/constants';
import { getGuestSubcategories, listCustomGuestCategories } from '../utils/guestCategories';
import { downloadText } from '../utils/helpers';
import { getQuotaUsage, resetQuotaToday } from '../utils/searchQuota';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { FormField, Input, Select } from '../components/ui/FormFields';

export default function Settings() {
  const { settings, guests, events, attendance, seatingPlans, updateSettings, restoreBackup, showToast, deleteGuestCategory, deleteGuestSubcategoryOption, guestCategories } = useApp();
  const [form, setForm] = useState({ ...settings });
  const [confirmClear, setConfirmClear] = useState(false);
  const [quota, setQuota] = useState(getQuotaUsage());
  const importRef = useRef(null);

  useEffect(() => {
    setForm({ ...settings });
  }, [settings]);

  const handleSave = (e) => {
    e.preventDefault();
    updateSettings(form);
  };

  const updateQuotaSetting = (engine, field, value) => {
    setForm((f) => ({
      ...f,
      searchQuota: {
        ...f.searchQuota,
        [engine]: { ...f.searchQuota?.[engine], [field]: value },
      },
    }));
  };

  const handleExport = () => {
    const json = exportBackup({ guests, events, attendance, seatingPlans, settings: form });
    downloadText(json, `${form.exportPrefix || 'EventFlow'}_備份.json`, 'application/json');
    showToast('備份已下載', 'success');
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = importBackup(text);
      restoreBackup(data);
      setForm({ ...data.settings });
    } catch (err) {
      showToast(err.message || '匯入失敗', 'error');
    }
    e.target.value = '';
  };

  const handleClear = () => {
    clearAllData();
    window.location.reload();
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">系統設定</h1>
          <p className="page-subtitle">管理系統偏好與資料備份</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="max-w-xl">
        <div className="card p-6 mb-6">
          <h2 className="section-title mb-4">基本設定</h2>
          <FormField label="系統名稱">
            <Input value={form.systemName} onChange={(e) => setForm({ ...form, systemName: e.target.value })} />
          </FormField>
          <FormField label="機構名稱">
            <Input value={form.organizationName} onChange={(e) => setForm({ ...form, organizationName: e.target.value })} />
          </FormField>
          <FormField label="預設活動負責人">
            <Input value={form.defaultOwner} onChange={(e) => setForm({ ...form, defaultOwner: e.target.value })} />
          </FormField>
          <FormField label="匯出檔名前綴">
            <Input value={form.exportPrefix} onChange={(e) => setForm({ ...form, exportPrefix: e.target.value })} />
          </FormField>
          <FormField label="預設嘉賓地區">
            <Select value={form.defaultGuestRegion || 'macau'} onChange={(e) => setForm({ ...form, defaultGuestRegion: e.target.value })}>
              {Object.entries(GUEST_REGIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </FormField>
          <label className="flex items-center gap-2 mb-4 cursor-pointer">
            <input type="checkbox" checked={form.enableDemoData} onChange={(e) => setForm({ ...form, enableDemoData: e.target.checked })} className="w-4 h-4 accent-accent" />
            <span className="text-sm text-secondary">啟用示範資料（僅在無資料時生效）</span>
          </label>
          <button type="submit" className="btn-primary">儲存設定</button>
        </div>

        <div className="card p-6 mb-6">
          <h2 className="section-title mb-2">嘉賓類別</h2>
          <p className="text-sm text-muted mb-4">內建類別以外，可在新增／編輯嘉賓時自行加入（例如「內地」）。</p>
          {listCustomGuestCategories(form).length === 0 ? (
            <p className="text-sm text-secondary">尚未新增自訂類別。</p>
          ) : (
            <ul className="space-y-2">
              {listCustomGuestCategories(form).map(([key, label]) => {
                const inUse = guests.some((g) => g.category === key);
                return (
                  <li key={key} className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0">
                    <span className="text-sm text-primary">{label}</span>
                    <div className="flex items-center gap-2">
                      {inUse && <span className="text-xs text-muted">使用中</span>}
                      <button
                        type="button"
                        className="text-xs text-danger hover:underline"
                        onClick={() => {
                          if (inUse) {
                            showToast('仍有嘉賓使用此類別，請先更改後再刪除', 'warning');
                            return;
                          }
                          deleteGuestCategory(key);
                          setForm((f) => {
                            const next = { ...(f.customGuestCategories || {}) };
                            delete next[key];
                            return { ...f, customGuestCategories: next };
                          });
                        }}
                      >
                        刪除
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="card p-6 mb-6">
          <h2 className="section-title mb-2">嘉賓次類別（第二層）</h2>
          <p className="text-sm text-muted mb-4">
            次類別為選填，例如主類別「政府」下可選「行政會」。可在新增／編輯嘉賓時加入自訂次類別。
          </p>
          {Object.entries(guestCategories).map(([parentKey, parentLabel]) => {
            const allLabels = getGuestSubcategories(form, parentKey);
            if (!allLabels.length) return null;
            const defaults = DEFAULT_GUEST_SUBCATEGORIES[parentKey] || [];
            return (
              <div key={parentKey} className="mb-4 last:mb-0">
                <p className="text-sm font-medium text-primary mb-2">{parentLabel}</p>
                <ul className="flex flex-wrap gap-2">
                  {allLabels.map((label) => {
                    const isBuiltin = defaults.includes(label);
                    const inUse = guests.some((g) => g.category === parentKey && g.subcategory === label);
                    return (
                      <li
                        key={label}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border text-xs text-secondary bg-bg"
                      >
                        <span>{label}</span>
                        {isBuiltin && <span className="text-muted">內建</span>}
                        {!isBuiltin && (
                          <button
                            type="button"
                            className="text-danger hover:underline"
                            onClick={() => {
                              if (inUse) {
                                showToast('仍有嘉賓使用此次類別，請先更改後再刪除', 'warning');
                                return;
                              }
                              deleteGuestSubcategoryOption(parentKey, label);
                              setForm((f) => {
                                const map = { ...(f.guestCategorySubcategories || {}) };
                                map[parentKey] = (map[parentKey] || []).filter((s) => s !== label);
                                return { ...f, guestCategorySubcategories: map };
                              });
                            }}
                          >
                            ×
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="card p-6 mb-6">
          <h2 className="section-title mb-4">相片搜尋（選用）</h2>
          <p className="text-sm text-secondary mb-4">
            「本地上傳」與「貼上連結」為免費功能，無需配置。以下設定僅用於「網路搜尋」標籤。
          </p>
          <label className="flex items-center gap-2 mb-4 cursor-pointer">
            <input type="checkbox" checked={!!form.enablePhotoSearch} onChange={(e) => setForm({ ...form, enablePhotoSearch: e.target.checked })} className="w-4 h-4 accent-accent" />
            <span className="text-sm text-secondary">啟用網路相片搜尋（Google Custom Search）</span>
          </label>
          <FormField label="Google CSE API Key">
            <Input type="password" value={form.googleCseApiKey || ''} onChange={(e) => setForm({ ...form, googleCseApiKey: e.target.value })} placeholder="選填" />
          </FormField>
          <FormField label="Google CSE CX（Search Engine ID）">
            <Input value={form.googleCseCx || ''} onChange={(e) => setForm({ ...form, googleCseCx: e.target.value })} placeholder="選填" />
          </FormField>
          <FormField label="CORS Proxy（貼上連結擷取用）">
            <Input value={form.corsProxyUrl || ''} onChange={(e) => setForm({ ...form, corsProxyUrl: e.target.value })} placeholder="https://api.allorigins.win/get?url=" />
          </FormField>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <FormField label="優先相片時限（月）">
              <Input type="number" min="1" max="24" value={form.photoSearchPrimaryMonths ?? 12} onChange={(e) => setForm({ ...form, photoSearchPrimaryMonths: parseInt(e.target.value, 10) || 12 })} />
            </FormField>
            <FormField label="放寬時限（月）">
              <Input type="number" min="1" max="36" value={form.photoSearchFallbackMonths ?? 24} onChange={(e) => setForm({ ...form, photoSearchFallbackMonths: parseInt(e.target.value, 10) || 24 })} />
            </FormField>
          </div>

          <h3 className="text-sm font-medium text-secondary mb-3">搜尋配額（達上限後自動停用）</h3>
          <div className="space-y-3 mb-4 p-3 bg-bg rounded-xl">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.searchQuota?.google?.enabled !== false} onChange={(e) => updateQuotaSetting('google', 'enabled', e.target.checked)} className="accent-accent" />
                Google
              </label>
              <Input
                type="number" min="0" className="w-24"
                value={form.searchQuota?.google?.dailyLimit ?? 80}
                onChange={(e) => updateQuotaSetting('google', 'dailyLimit', parseInt(e.target.value, 10) || 0)}
              />
              <span className="text-xs text-muted">次 / 日（設 0 = 不使用）</span>
              <span className="text-xs text-accent">今日已用：{quota.google}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-muted">
                <input type="checkbox" checked={!!form.searchQuota?.baidu?.enabled} onChange={(e) => updateQuotaSetting('baidu', 'enabled', e.target.checked)} className="accent-accent" disabled />
                Baidu（預留，尚未接入）
              </label>
              <Input type="number" min="0" className="w-24" value={0} disabled />
            </div>
            <button type="button" onClick={() => { resetQuotaToday(); setQuota(getQuotaUsage()); showToast('已重置今日配額', 'success'); }} className="btn-secondary text-sm">
              重置今日配額計數
            </button>
          </div>
          <button type="submit" className="btn-primary">儲存設定</button>
        </div>
      </form>

      <div className="card p-6 mb-6 max-w-xl">
        <h2 className="section-title mb-4">資料備份</h2>
        <div className="flex flex-wrap gap-3">
          <button onClick={handleExport} className="btn-secondary">匯出 JSON 備份</button>
          <button onClick={() => importRef.current?.click()} className="btn-secondary">匯入 JSON 備份</button>
          <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
        </div>
        <p className="text-xs text-muted mt-3">建議定期備份資料，匯入將覆蓋現有所有資料。</p>
      </div>

      <div className="card p-6 max-w-xl border-danger/30">
        <h2 className="section-title mb-2 text-danger">危險區域</h2>
        <p className="text-sm text-secondary mb-4">清除所有資料後無法復原，請先匯出備份。</p>
        <button onClick={() => setConfirmClear(true)} className="btn-danger">清除所有資料</button>
      </div>

      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={handleClear}
        title="確認清除所有資料"
        message="此操作將永久刪除所有嘉賓、活動與邀請記錄，且無法復原。確定要繼續嗎？"
        confirmLabel="清除全部"
        danger
      />
    </div>
  );
}
