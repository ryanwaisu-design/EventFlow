# EventFlow — 公關活動管理系統

專為公關團隊、活動統籌、政府關係、企業傳訊、NGO 及大型機構設計的 Progressive Web App（PWA）。

## 功能概覽

- **儀表板** — 數據總覽與快速操作
- **嘉賓資料庫** — 新增、編輯、搜尋、篩選、Excel 匯入
- **活動管理** — 建立活動、複製活動、邀請統計
- **邀請與出席** — 批量發函、狀態追蹤、座位管理
- **簽到模式** — 現場一鍵簽到（適合手機 / 平板）
- **認人名單** — 大圖卡片、列印、Word 匯出
- **匯出中心** — 多種 Excel 名單、標籤合併列印、JSON 備份
- **系統設定** — 機構設定、資料備份與還原

## 技術棧

- React 18 + Vite 6
- Tailwind CSS 3
- SheetJS (xlsx) — Excel 匯入 / 匯出
- localStorage — 本地資料儲存
- PWA — manifest.json + Service Worker 離線支援

## 快速開始

```bash
npm install
npm run dev
```

瀏覽器開啟 http://localhost:5175

## 建置與預覽

```bash
npm run build
npm run preview
```

## 資料儲存

所有資料儲存於瀏覽器 localStorage：

| Key | 內容 |
|-----|------|
| `eventflow_guests` | 嘉賓資料 |
| `eventflow_events` | 活動資料 |
| `eventflow_attendance` | 邀請與出席記錄 |
| `eventflow_settings` | 系統設定 |

首次載入會自動建立示範資料（可在設定中關閉）。

## PWA 安裝

1. 使用 Chrome / Edge / Safari 開啟應用
2. 點選瀏覽器「安裝應用程式」或「加入主畫面」
3. 離線時仍可開啟系統並讀取已儲存資料

## 嘉賓相片功能

新增 / 編輯嘉賓時提供三種方式（**本地上傳為原有方式，完整保留**）：

| 方式 | 費用 | 說明 |
|------|------|------|
| **本地上傳** | 免費 | 選擇檔案或從剪貼簿貼上（原有功能） |
| **貼上連結** | 免費 | 貼上 gov.mo / 新聞文章 URL 或圖片直鏈，自動擷取候選圖 |
| **網路搜尋** | 可選 | 需在設定中啟用 Google CSE，設每日配額，達上限自動停用 |

所有方式選圖後均可 **1:1 裁切**，並記錄相片來源。預設嘉賓地區可設為澳門或內地，影響搜尋優先次序（gov.mo / gov.cn）。

## 授權

MIT
