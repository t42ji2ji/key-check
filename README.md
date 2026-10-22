# key-check

A small local web UI for [TruffleHog](https://github.com/trufflesecurity/trufflehog): paste API keys, see which ones are still live.

Not affiliated with Truffle Security. All detection and verification is done by your locally installed TruffleHog.

The UI is in English, or in Chinese when the browser language is Chinese. [中文說明](#中文)

## Requirements

- Node.js 18+
- TruffleHog: `brew install trufflehog` (or see its [install guide](https://github.com/trufflesecurity/trufflehog#floppy_disk-installation)). If it's missing, the page offers a one-click install instead (see below).

## Run

```sh
git clone https://github.com/t42ji2ji/key-check.git
cd key-check
npm start
```

Open http://127.0.0.1:5199 and paste keys. Each pasted line becomes its own chip you can remove with ×; a PEM private key or a whole JSON object stays as one. Press Enter or click Check. Pasting `NAME=value` lines, e.g. straight from a `.env` file, improves detection.

## Installing TruffleHog from the page

On load the page asks the server whether TruffleHog is available. It looks for `~/.cache/key-check/bin/trufflehog` first, then `trufflehog` on `PATH`. If neither exists, a panel above the input offers to install it:

1. The server fetches the latest release from GitHub (`trufflesecurity/trufflehog`).
2. It downloads the tarball for your OS/arch and shows progress.
3. It checks the SHA-256 against the release's `checksums.txt` and aborts on mismatch.
4. It extracts the binary to `~/.cache/key-check/bin/trufflehog`. No sudo, nothing outside that folder.

Checking is disabled until TruffleHog is available. A Homebrew install is left alone.

## What happens to your keys

- The server binds to `127.0.0.1` only and rejects requests from other origins.
- Pasted text is piped to `trufflehog stdin`. Nothing is written to disk or logged.
- **Verification sends each key to its own provider's API** (e.g. an OpenAI key goes to api.openai.com). That is how TruffleHog tells live from revoked.
- Do not host this as a public website. Run it on your own machine.

## Results

| Label | Meaning |
|---|---|
| Live | The provider accepted the key. |
| Dead | Recognized, but the provider rejected it. |
| Unknown | Verification failed with an error. |
| Unrecognized | TruffleHog has no detector for this format. Check the provider's dashboard. |

Each result card shows the service logo, the masked key and its state; extra fields from TruffleHog are under Details. Logos are loaded from Google's favicon service by the provider's domain, so Google sees which services you checked (never the keys).

## Gemini `AQ.` keys

Google's newer Gemini keys start with `AQ.`. Released TruffleHog doesn't detect them yet ([#5437](https://github.com/trufflesecurity/trufflehog/issues/5437)); [PR #5440](https://github.com/trufflesecurity/trufflehog/pull/5440) adds it but isn't merged. Two ways key-check handles them:

- **Fallback (always on):** if TruffleHog doesn't report a Gemini key, the server checks each `AQ.` string itself by calling `generativelanguage.googleapis.com/v1beta/models` with the `x-goog-api-key` header. 200 → live, "API key not valid" → dead, anything else → unknown.
- **Patched TruffleHog (optional):** build PR #5440 and put it at `~/.cache/key-check/bin/trufflehog`, which key-check prefers over the one on `PATH`. The PR treats only HTTP 400 as invalid, but invalid `AQ.` keys return 401 (`ACCESS_TOKEN_TYPE_UNSUPPORTED`), so also treat 401 as invalid in `pkg/detectors/googlegemini/googlegemini.go`, or dead `AQ.` keys show as unknown:

  ```go
  case http.StatusBadRequest, http.StatusUnauthorized:
  ```

  ```sh
  git clone https://github.com/trufflesecurity/trufflehog && cd trufflehog
  git fetch origin pull/5440/head:pr5440 && git checkout pr5440
  # apply the 401 change above
  go build -ldflags "-X github.com/trufflesecurity/trufflehog/v3/pkg/version.BuildVersion=pr5440" \
    -o ~/.cache/key-check/bin/trufflehog .
  ```

  Installing from the page overwrites this file with the official release, and `AQ.` detection falls back to the check above. Once #5440 ships in a release, use the official build.

## Development

- The background is [ascii-sharks](https://github.com/stackedlol/ascii-sharks) (sources in `sharks/`, with blood-on-click added). Rebuild `sharks.js` with `npm run build:sharks`.
- Open http://127.0.0.1:5199/#dev to get a **DEV fake data** button: it fills in fake keys and answers `/scan` with canned results for every state, without calling TruffleHog. The code is the `<!-- DEV 測試鈕 -->` block at the end of `index.html`; delete it before release.

## License

MIT for this wrapper. TruffleHog is AGPL-3.0 and is not bundled.

The shark background in `sharks/` and the built `sharks.js` comes from [stackedlol/ascii-sharks](https://github.com/stackedlol/ascii-sharks), with changes. It is **not** covered by this repo's MIT license; that project has no license, so its code stays with its author. It will be removed on request.

---

## 中文

[TruffleHog](https://github.com/trufflesecurity/trufflehog) 的本機網頁介面：貼上 API key，看哪些還有效。介面預設英文，瀏覽器語言是中文時顯示中文。

本專案與 Truffle Security 無關，偵測與驗證都由你電腦上安裝的 TruffleHog 執行。

**需求**：Node.js 18 以上、TruffleHog（`brew install trufflehog`；沒裝的話頁面會提供一鍵安裝）。

**執行**：`npm start`，打開 http://127.0.0.1:5199，貼上 key。多行貼上時每行變成一個標籤，可以按 × 刪掉；PEM 私鑰、整份 JSON 各算一把。按 Enter 或「檢查」開始。連變數名一起貼（例如直接從 `.env` 複製 `NAME=value`）辨識率較高。

**從頁面安裝 TruffleHog**：頁面打開時會問伺服器有沒有 TruffleHog，先找 `~/.cache/key-check/bin/trufflehog`，再找 `PATH` 上的 `trufflehog`。都沒有的話，輸入框上方會出現安裝提示。按下去後伺服器從 GitHub 抓官方最新版，邊下載邊顯示進度，比對 release 的 `checksums.txt`（SHA-256 不符就中止），解壓到 `~/.cache/key-check/bin/trufflehog`。不需要 sudo，也不會動到 Homebrew 裝的那份。裝好之前不能檢查。

**key 會去哪裡**

- 伺服器只綁 `127.0.0.1`，並拒絕來自其他網站的請求。
- 貼上的內容直接交給 `trufflehog stdin`，不寫檔、不記 log。
- **驗證時，每把 key 會送到它所屬服務的 API**（例如 OpenAI key 送到 api.openai.com），這是判斷有效或失效的方式。
- 請在自己的電腦執行，不要架成公開網站讓別人貼 key。

**結果**：仍可使用＝服務商接受這把 key；已失效＝認得但被拒絕；無法確認＝驗證出錯；無法辨識＝TruffleHog 沒有這種格式的偵測器，請到該服務後台確認。其他欄位收在「詳細」裡。服務 logo 是用服務網域向 Google favicon 服務抓的，Google 會知道你查了哪些服務，但看不到 key。

**Gemini `AQ.` key**：正式版 TruffleHog 還認不出（[#5437](https://github.com/trufflesecurity/trufflehog/issues/5437)），[PR #5440](https://github.com/trufflesecurity/trufflehog/pull/5440) 有補但還沒合併。

- 備援（一直開著）：TruffleHog 沒回報 Gemini key 時，伺服器自己用 `x-goog-api-key` header 打 Gemini 的 models API 檢查每個 `AQ.` 字串。回 200 是仍可使用，回「API key not valid」是已失效，其他算無法確認。
- 自編版（選用）：編 PR #5440 放到 `~/.cache/key-check/bin/trufflehog`，key-check 會優先用它。那個 PR 只把 400 當無效，但無效的 `AQ.` key 回的是 401，要在 `googlegemini.go` 把 401 也算無效，否則失效的 `AQ.` key 會顯示無法確認。編法見上方英文段。從頁面安裝會用官方版蓋掉這份，`AQ.` 就回到備援檢查。等 #5440 進正式版再換回官方版。

**授權**：key-check 本身是 MIT；TruffleHog 是 AGPL-3.0，沒有包在這裡。`sharks/` 和打包好的 `sharks.js` 改自 [stackedlol/ascii-sharks](https://github.com/stackedlol/ascii-sharks)，**不屬於** MIT 範圍；原專案沒有授權條款，權利歸原作者，對方要求就會移除。

**開發**：背景是 [ascii-sharks](https://github.com/stackedlol/ascii-sharks)（原始碼在 `sharks/`，加了點擊留血），改完用 `npm run build:sharks` 重編 `sharks.js`。打開 http://127.0.0.1:5199/#dev 會出現「DEV fake data」按鈕：塞入假 key，並攔下 `/scan` 回傳各種狀態的假結果，不會呼叫 TruffleHog。程式在 `index.html` 最後的 `<!-- DEV 測試鈕 -->` 區塊，上線前整段刪掉。
