# CLAUDE.md — 中國跳棋專案指南（交接文件）

> 給接手的 AI / 開發者：這份是**目前現況**對齊版（2026-06-01）。先讀這份，再看 `README.md`。
> 最重要的兩件事：(1) 規則邏輯全在純 `src/core/`，不碰 UI；(2) 測試分兩層——`npm run test`（規則）
> 與 `npm run playtest`（瀏覽器，抓動畫/凍結）。**下一個要做的主項是「手機版兩頁式」，設計已定案，見最下方。**

## 連結
- GitHub：`https://github.com/summer09201017-cloud/checkers`（主分支 `main`）
- 線上版（Netlify，自動部署）：`https://chinese-checker.netlify.app/`

## 指令
```bash
npm install
npm run dev        # 開發伺服器 http://localhost:5173
npm run test       # 規則引擎單元測試 + 自我對弈（Node，13 個測試）
npm run playtest   # 瀏覽器自動試玩（需先 npx playwright install chromium）
npm run lint       # eslint
npm run build      # tsc -b && vite build（產出含 PWA manifest + service worker）
```
部署：push 到 `main` → Netlify 自動 build（設定在 `netlify.toml`：build=`npm run build`、publish=`dist`、Node 22）。

## 架構（現況）
```
src/
  core/                  純 TypeScript 規則引擎，不依賴 React/DOM
    types.ts             GameState 等資料型別（含 winnerId / isDraw / movesSinceProgress / bestDistanceToGoal）
    board.ts             星形 121 格棋盤、立方座標、6 方向、cubeDistance
    game.ts              合法步生成、applyMove、勝負/和局/終止判定（MAX_PLIES / STALL_PLIES）
    ai.ts                AI 選步（easy/normal/hard）
    ai.worker.ts         Web Worker：把 AI 運算移出主執行緒（避免卡 UI）
    game.test.ts         單元 + 自我對弈 + 回放重現 測試
  app/                   React 控制器與外觀（薄膠水層，無規則）
    useGameController.ts 回合/選子/悔棋/AI 觸發/回放(viewedGame) 狀態
    appearance.ts        主題與棋子顏色
    sound.ts             Web Audio 音效 + 五聲音階 BGM
    storage.ts           localStorage 存檔/偏好
    MoveLog.tsx          棋譜面板（可點某一手回放）
    VictoryOverlay.tsx   勝利/和局彈窗（煙火、可關閉 ✕）
  renderers/svg2d/       2D SVG 棋盤（只讀 GameState、發出點擊意圖；含移動動畫）
e2e/playtest.mjs         Playwright 瀏覽器自動試玩腳本（npm run playtest）
scripts/gen-icons.mjs    從 public/app-icon.svg 產生 PWA PNG 圖示
```

## 開發鐵則（沿用，勿違反）
1. **規則只進 `core/`**，不 import React/DOM。換 3D renderer 時規則一條都不用改。
2. **`GameState` 不可變**：`applyMove(state, move)` 回傳新 state。悔棋=狀態堆疊、AI 試算=直接套假想步、回放=重放棋譜。
3. **合法步由引擎產生，不信任 UI**：`applyMove` 會重新驗證、非法即丟錯。
4. **兩層測試，缺一不可**：
   - `npm run test` 抓規則 bug（終止性、和局、封鎖、AI 卡死）——Node 跑純 core，**看不到畫面層**。
   - `npm run playtest` 抓畫面/動畫/Worker/計時 bug——用真瀏覽器玩，監看 `pageerror`。
5. **renderer 可測性契約**：互動格子掛 `data-testid="cell-<id>"` + `data-cell-id`、棋子掛 `data-testid="piece-<id>"`、合法目標格用 `.is-legal-target`。playtest 靠這些驅動。
6. **動畫注意**：任何 `requestAnimationFrame` 迴圈的陣列索引都要夾在合法範圍（幀時間戳可能早於 startTime → 負索引），且取消/丟錯時要把「動畫中」狀態歸零，否則棋盤會被永久鎖住（凍結）。

---

## Roadmap — 已完成 vs 真正待做（對齊 2026-06-01 現況）

### ✅ 已完成（已上線）
**核心玩法**
- 標準 121 格星形棋盤、每方 10 子、相鄰步 + 跨棋跳 + 連跳。
- 2 人本機對戰；AI 對手（簡單/普通/困難），AI 運算在 Web Worker。
- 悔棋、重新開始、主題（清爽/木質/夜間/翡翠）、雙方各 6 種棋子顏色。

**體驗功能**
- 移動/連跳動畫、Web Audio 音效 + BGM、勝利煙火彈窗、AI 提示、手機觸控放大。
- 自動存檔（localStorage）。
- 棋譜面板 + **回放**（點某一手重現當時盤面，可返回實況）。
- **和局彈窗**（VictoryOverlay 也處理和局；彈窗可 ✕ 關閉以回看棋盤）。

**正確性修復（本輪重點，原本「遊戲永遠不會結束」）**
- 修 AI 收尾卡死：改瞄準最近**空**終點格 + 進營大獎勵。
- 修封鎖死局：勝利改為「終點全滿且自己佔多數」（`game.ts hasPlayerWon`）。
- 加終止保證：`isDraw` + 無進度偵測（`STALL_PLIES`）+ 步數上限（`MAX_PLIES`）。
- 修動畫當機/凍結：rAF 索引夾範圍（`ChineseCheckersBoard.tsx`）。

**工程/部署**
- **PWA**：可安裝、離線可玩、專屬圖示（`vite-plugin-pwa` + manifest + service worker）。
- **瀏覽器自動試玩**：`npm run playtest`（`e2e/playtest.mjs`）。
- Netlify 部署設定（`netlify.toml`），已上線。

### 🔲 真正待做
1. **【進行中・最高優先】手機版兩頁式版面**（設計已定案，尚未實作）——見下方規格。
2. 可分享網址（把棋局/棋譜編碼進 URL 分享）。〔之前評估為 S，使用者暫未要〕
3. 更強 AI（minimax/alpha-beta 加深，或 MCTS）。
4. 本機多人（3–6 人，pass-and-play）。
5. 3D renderer（重用同一套 core）。
6. 線上對戰 / 帳號 / 排名（XL，等於另一個專案）。

### ⚠️ 已知技術債
- 約 **6 個既有 lint 錯誤**（`set-state-in-effect` / `no-explicit-any`）在 `ChineseCheckersBoard.tsx`、
  `VictoryOverlay.tsx`、`sound.ts`、`useGameController.ts` 的 worker effect。**非本輪造成**，目前留著
  （修要動到動畫/音效行為）。`npm run build` 與測試不受影響。

---

## 待做主項規格：手機版兩頁式（已與使用者定案）
**目標**：手機上把棋盤放到最大。桌機維持現狀。

- **套用範圍**：**只在手機/窄螢幕**（建議 `max-width: 768px` 或沿用既有 960px 斷點）。桌機/平板維持現在的
  header + 棋盤 + 側欄版面，不動。
- **畫面 1（設定）**：主題、棋子顏色、AI 開關 + 難度、聲音、對局記錄(MoveLog)，最下方一顆大的「開始遊戲」。
- **畫面 2（全螢幕遊玩）**：滿版棋盤 + 最下方一條**精簡工具列**：`[悔棋] [重來] [提示] [⚙設定]`。
  `⚙` 回到畫面 1（當暫停/選單用）。
- **全螢幕作法**：靠 **PWA standalone**（已做）+ CSS `100dvh` 滿版佈局 + `env(safe-area-inset-*)`。
  **不要**用 JS Fullscreen API（iOS Safari 不支援元素全螢幕）。
- **實作建議**：加一個 `useMediaQuery('(max-width: 768px)')` hook；把設定區塊抽成 `GameSettings` 元件，
  桌機側欄與手機畫面 1 共用；App 用 `mobileView: 'setup' | 'play'` 狀態切換；遊玩中棋盤互動沿用既有的
  `isInteractionDisabled`。`viewport-fit=cover` 已在 `index.html` 設好。
- **注意**：勝利/和局彈窗在手機也要正常（已可 ✕ 關閉回看）；切換畫面時別讓 AI effect 重複觸發。
- **驗收**：`npm run playtest`（本機 + 線上）零錯誤；手機實機跑兩頁流程順、可安裝、可離線。
