export const STORAGE_KEYS = {
  guests: 'eventflow_guests',
  events: 'eventflow_events',
  attendance: 'eventflow_attendance',
  settings: 'eventflow_settings',
  seatingPlans: 'eventflow_seating_plans',
};

export const GUEST_CATEGORIES = {
  government: '政府',
  community: '社團',
  public: '公共機構',
  business: '商業',
  media: '媒體',
  vip: 'VIP / 貴賓',
  sponsor: '贊助商',
  other: '其他',
};

export const EVENT_TYPES = {
  dinner: '晚宴',
  ceremony: '典禮',
  press_conference: '記者會',
  seminar: '講座 / 研討會',
  networking: '交流活動',
  launch: '發佈會',
  visit: '參觀 / 探訪',
  other: '其他',
};

export const ATTENDANCE_STATUS = {
  draft: '擬邀請',
  pending_invite: '待發函',
  invited: '已發函',
  pending_reply: '待回覆',
  attending: '確認出席',
  declined: '婉拒 / 缺席',
  waitlist: '候補',
  checked_in: '已簽到',
  no_show: '未出席',
};

export const STATUS_COLORS = {
  draft: 'bg-muted/20 text-muted',
  pending_invite: 'bg-warning/20 text-warning',
  invited: 'bg-info/20 text-info',
  pending_reply: 'bg-warning/20 text-warning',
  attending: 'bg-success/20 text-success',
  declined: 'bg-danger/20 text-danger',
  waitlist: 'bg-secondary/20 text-secondary',
  checked_in: 'bg-success/20 text-success',
  no_show: 'bg-danger/20 text-danger',
};

export const NAV_ITEMS = [
  { id: 'dashboard', label: '儀表板', icon: '◈' },
  { id: 'guests', label: '嘉賓資料庫', icon: '◎' },
  { id: 'events', label: '活動管理', icon: '◇' },
  { id: 'invitations', label: '邀請與出席', icon: '✉' },
  { id: 'seating', label: '活動排位', icon: '⊞' },
  { id: 'checkin', label: '簽到模式', icon: '✓' },
  { id: 'recognition', label: '認人名單', icon: '👁' },
  { id: 'export', label: '匯出中心', icon: '↓' },
  { id: 'settings', label: '系統設定', icon: '⚙' },
];

export const GUEST_REGIONS = {
  macau: '澳門',
  mainland: '內地',
};

export const PHOTO_MODES = {
  upload: '本地上傳',
  url: '貼上連結',
  search: '網路搜尋',
};

export const DEFAULT_SETTINGS = {
  systemName: 'EventFlow',
  organizationName: '公關活動管理系統',
  defaultOwner: '',
  exportPrefix: 'EventFlow',
  enableDemoData: true,
  defaultGuestRegion: 'macau',
  enablePhotoSearch: false,
  googleCseApiKey: '',
  googleCseCx: '',
  corsProxyUrl: 'https://api.allorigins.win/get?url=',
  photoSearchPrimaryMonths: 12,
  photoSearchFallbackMonths: 24,
  searchQuota: {
    google: { enabled: true, dailyLimit: 80 },
    baidu: { enabled: false, dailyLimit: 0 },
  },
};
