const QUOTA_KEY = 'eventflow_search_quota';

function todayKey() {
  return new Date().toISOString().split('T')[0];
}

function loadQuotaState() {
  try {
    const raw = localStorage.getItem(QUOTA_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || parsed.date !== todayKey()) {
      return { date: todayKey(), google: 0, baidu: 0 };
    }
    return parsed;
  } catch {
    return { date: todayKey(), google: 0, baidu: 0 };
  }
}

function saveQuotaState(state) {
  try {
    localStorage.setItem(QUOTA_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function getQuotaUsage() {
  const state = loadQuotaState();
  return { google: state.google || 0, baidu: state.baidu || 0, date: state.date };
}

export function canUseEngine(engine, settings) {
  const cfg = settings?.searchQuota?.[engine];
  if (!cfg?.enabled) return { allowed: false, reason: '此搜尋引擎未啟用' };
  const limit = cfg.dailyLimit ?? 0;
  if (limit <= 0) return { allowed: false, reason: '已設定為不使用（每日上限為 0）' };
  const state = loadQuotaState();
  const used = state[engine] || 0;
  if (used >= limit) return { allowed: false, reason: `今日配額已用完（${used}/${limit}）` };
  return { allowed: true, used, limit };
}

export function incrementQuota(engine) {
  const state = loadQuotaState();
  state[engine] = (state[engine] || 0) + 1;
  saveQuotaState(state);
  return state;
}

export function resetQuotaToday() {
  saveQuotaState({ date: todayKey(), google: 0, baidu: 0 });
}
