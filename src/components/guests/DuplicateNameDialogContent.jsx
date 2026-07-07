function GuestSummaryCard({ guest }) {
  return (
    <div className="rounded-lg border border-border bg-bg/50 px-3 py-2.5 text-sm space-y-1">
      <p><span className="text-muted">姓名：</span><span className="text-primary">{guest.name}</span></p>
      <p><span className="text-muted">單位：</span>{guest.organization}</p>
      <p><span className="text-muted">職銜：</span>{guest.title}</p>
    </div>
  );
}

export default function DuplicateNameDialogContent({ groups, action = '新增' }) {
  if (!groups?.length) return null;

  const intro = action === '匯入'
    ? '系統發現以下姓名與現有資料重複或於匯入檔案中重複。可選擇「取代」更新現有嘉賓，或「兩者皆保留」新增重複記錄。'
    : '系統發現已有同名嘉賓。可選擇「取代」更新現有資料，或「兩者皆保留」另建一筆記錄。';

  const incomingLabel = action === '匯入' ? '匯入嘉賓' : '新增嘉賓';

  return (
    <div className="space-y-4">
      <p className="text-secondary">{intro}</p>
      {groups.map((group) => (
        <div key={group.name} className="space-y-2.5">
          {groups.length > 1 && (
            <p className="text-sm font-medium text-primary">重複姓名：{group.name}</p>
          )}
          {group.existing.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted uppercase tracking-wide">現有嘉賓</p>
              {group.existing.map((guest, idx) => (
                <GuestSummaryCard key={`existing-${idx}`} guest={guest} />
              ))}
            </div>
          )}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted uppercase tracking-wide">{incomingLabel}</p>
            {group.incoming.map((guest, idx) => (
              <GuestSummaryCard key={`incoming-${idx}`} guest={guest} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
