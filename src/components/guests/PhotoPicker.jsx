import { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { PHOTO_MODES, GUEST_REGIONS } from '../../data/constants';
import { readFileAsDataURL } from '../../utils/helpers';
import { readClipboardImage } from '../../utils/imageUtils';
import { extractFromUrl } from '../../utils/urlExtract';
import { searchGuestPhotos } from '../../utils/photoSearch';
import { getQuotaUsage, canUseEngine } from '../../utils/searchQuota';
import GuestAvatar from '../ui/GuestAvatar';
import ImageCropModal from './ImageCropModal';
import { Input, Select, FormField } from '../ui/FormFields';

const emptySource = () => ({
  photoSourceUrl: '',
  photoSourceDate: '',
});

export default function PhotoPicker({ guest, onChange }) {
  const { settings, showToast } = useApp();
  const [mode, setMode] = useState('upload');
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [cropSrc, setCropSrc] = useState('');
  const [cropMeta, setCropMeta] = useState(emptySource());
  const [cropOpen, setCropOpen] = useState(false);
  const fileRef = useRef(null);

  const photoRegion = guest.photoRegion || settings.defaultGuestRegion || 'macau';
  const quota = getQuotaUsage();
  const googleQuota = canUseEngine('google', settings);

  const applyPhoto = (photo, meta = emptySource()) => {
    onChange({
      photo,
      photoSourceUrl: meta.photoSourceUrl || '',
      photoSourceDate: meta.photoSourceDate || '',
    });
  };

  const openCrop = (src, meta) => {
    setCropSrc(src);
    setCropMeta(meta);
    setCropOpen(true);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataURL(file);
      openCrop(dataUrl, { photoSourceUrl: '', photoSourceDate: '' });
    } catch {
      showToast('相片上傳失敗', 'error');
    }
    e.target.value = '';
  };

  const handlePasteClipboard = async () => {
    try {
      const blobUrl = await readClipboardImage();
      openCrop(blobUrl, { photoSourceUrl: '', photoSourceDate: '' });
    } catch (e) {
      showToast(e.message || '無法讀取剪貼簿', 'warning');
    }
  };

  const handleExtractUrl = async () => {
    setLoading(true);
    setCandidates([]);
    try {
      const result = await extractFromUrl(urlInput, settings);
      if (!result.images?.length) {
        showToast('未找到可用圖片', 'warning');
        return;
      }
      setCandidates(result.images);
      showToast(`找到 ${result.images.length} 張候選圖片`, 'success');
    } catch (e) {
      showToast(e.message || '擷取失敗', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!guest.name?.trim()) {
      showToast('請先填寫姓名', 'warning');
      return;
    }
    setLoading(true);
    setCandidates([]);
    try {
      const results = await searchGuestPhotos({ ...guest, photoRegion }, settings);
      setCandidates(results);
      showToast(`找到 ${results.length} 張候選圖片`, 'success');
    } catch (e) {
      showToast(e.message || '搜尋失敗', 'error');
    } finally {
      setLoading(false);
    }
  };

  const selectCandidate = (item) => {
    openCrop(item.url, {
      photoSourceUrl: item.sourceUrl || item.url,
      photoSourceDate: item.sourceDate || '',
    });
  };

  const handleCropConfirm = (dataUrl, meta) => {
    applyPhoto(dataUrl, meta || cropMeta);
    setCandidates([]);
    setUrlInput('');
    showToast('相片已設定', 'success');
  };

  const clearPhoto = () => {
    applyPhoto('', emptySource());
    setCandidates([]);
  };

  const editPhoto = () => {
    if (!guest.photo) return;
    openCrop(guest.photo, {
      photoSourceUrl: guest.photoSourceUrl || '',
      photoSourceDate: guest.photoSourceDate || '',
    });
  };

  const replacePhoto = () => {
    fileRef.current?.click();
  };

  const tabs = [
    { id: 'upload', label: PHOTO_MODES.upload },
    { id: 'url', label: PHOTO_MODES.url },
    ...(settings.enablePhotoSearch ? [{ id: 'search', label: PHOTO_MODES.search }] : []),
  ];

  return (
    <div className="mb-6 p-4 bg-bg rounded-xl border border-border">
      <div className="flex items-start gap-4 mb-4">
        <GuestAvatar guest={guest} size="lg" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-primary mb-1">嘉賓相片</p>
          {(guest.photoSourceUrl || guest.photoSourceDate) && (
            <p className="text-xs text-muted truncate">
              {guest.photoSourceUrl && <span>連結：{guest.photoSourceUrl}</span>}
              {guest.photoSourceDate && <span>{guest.photoSourceUrl ? ' · ' : ''}{guest.photoSourceDate}</span>}
            </p>
          )}
          {guest.photo && (
            <div className="flex flex-wrap gap-3 mt-2">
              <button type="button" onClick={editPhoto} className="text-xs text-accent hover:underline">
                修改相片
              </button>
              <button type="button" onClick={replacePhoto} className="text-xs text-secondary hover:underline">
                更換相片
              </button>
              <button type="button" onClick={clearPhoto} className="text-xs text-danger hover:underline">
                清除相片
              </button>
            </div>
          )}
        </div>
      </div>

      {guest.photo && (
        <div className="grid sm:grid-cols-2 gap-3 mb-4 p-3 bg-card rounded-xl border border-border">
          <FormField label="來源連結">
            <Input
              type="url"
              value={guest.photoSourceUrl || ''}
              onChange={(e) => onChange({ photoSourceUrl: e.target.value })}
              placeholder="https://..."
            />
          </FormField>
          <FormField label="來源日期" required>
            <Input
              type="date"
              value={guest.photoSourceDate || ''}
              onChange={(e) => onChange({ photoSourceDate: e.target.value })}
              required
            />
          </FormField>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => { setMode(t.id); setCandidates([]); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              mode === t.id ? 'bg-accent/20 text-accent border border-accent/40' : 'bg-card-hover text-secondary border border-transparent'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {mode === 'upload' && (
        <div className="space-y-3">
          <p className="text-xs text-muted">原有方式：從本機選擇圖片檔案，支援 JPG、PNG。未上傳將自動產生姓名頭像。</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} className="btn-secondary text-sm">
              選擇檔案
            </button>
            <button type="button" onClick={handlePasteClipboard} className="btn-secondary text-sm">
              從剪貼簿貼上
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
        </div>
      )}

      {mode === 'url' && (
        <div className="space-y-3">
          <p className="text-xs text-muted">
            貼上活動報導或政府新聞連結，系統將擷取頁內圖片（免 API 費用）。亦可直接貼上圖片 URL。
          </p>
          <div className="flex gap-2">
            <Input
              className="flex-1"
              placeholder="https://www.gov.mo/... 或圖片連結"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
            />
            <button type="button" onClick={handleExtractUrl} disabled={loading || !urlInput.trim()} className="btn-primary text-sm disabled:opacity-50">
              {loading ? '擷取中…' : '擷取'}
            </button>
          </div>
        </div>
      )}

      {mode === 'search' && (
        <div className="space-y-3">
          <p className="text-xs text-muted">
            使用 Google Custom Search（需在設定中配置 API）。優先搜尋近 {settings.photoSearchPrimaryMonths || 12} 個月相片。
            達免費上限後將自動停用。
          </p>
          <div className="flex flex-wrap gap-3 items-center">
            <label className="text-sm text-secondary">嘉賓地區</label>
            <Select
              value={photoRegion}
              onChange={(e) => onChange({ photoRegion: e.target.value })}
              className="w-32"
            >
              {Object.entries(GUEST_REGIONS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
            <span className="text-xs text-muted">
              Google 今日：{quota.google}/{settings.searchQuota?.google?.dailyLimit ?? 0}
              {!googleQuota.allowed && `（${googleQuota.reason}）`}
            </span>
          </div>
          <button
            type="button"
            onClick={handleSearch}
            disabled={loading || !googleQuota.allowed}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {loading ? '搜尋中…' : '搜尋近期相片'}
          </button>
        </div>
      )}

      {candidates.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-sm text-secondary mb-3">請選擇一張相片（點擊後可裁切）：</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {candidates.map((item, idx) => (
              <button
                key={`${item.url}-${idx}`}
                type="button"
                onClick={() => selectCandidate(item)}
                className="card p-2 text-left hover:border-accent/50 transition-all overflow-hidden"
              >
                <div className="aspect-square bg-bg rounded-lg overflow-hidden mb-2">
                  <img
                    src={item.url}
                    alt={item.title || '候選圖'}
                    className="w-full h-full object-cover"
                    onError={(e) => { e.target.style.display = 'none'; }}
                    crossOrigin="anonymous"
                  />
                </div>
                <p className="text-xs text-primary line-clamp-2">{item.title || '—'}</p>
                <p className="text-xs text-muted truncate mt-1">{item.sourceName}</p>
                {item.sourceDate && <p className="text-xs text-accent">{item.sourceDate}</p>}
              </button>
            ))}
          </div>
          <p className="text-xs text-warning mt-3">請確認相片與嘉賓身份一致後再使用。</p>
        </div>
      )}

      <ImageCropModal
        open={cropOpen}
        imageSrc={cropSrc}
        sourceMeta={cropMeta}
        onClose={() => setCropOpen(false)}
        onConfirm={handleCropConfirm}
      />
    </div>
  );
}
