# key-check

A small local web UI for [TruffleHog](https://github.com/trufflesecurity/trufflehog): paste API keys, see which ones are still live.

Not affiliated with Truffle Security. All detection and verification is done by your locally installed TruffleHog.

[中文說明](#中文)

## Requirements

- Node.js 18+
- TruffleHog: `brew install trufflehog` (or see its [install guide](https://github.com/trufflesecurity/trufflehog#floppy_disk-installation))

## Run

```sh
git clone https://github.com/t42ji2ji/key-check.git
cd key-check
npm start
```

Open http://127.0.0.1:5199 and paste keys (one per line). Pasting `NAME=value` lines, e.g. straight from a `.env` file, improves detection.

## What happens to your keys

- The server binds to `127.0.0.1` only and rejects requests from other origins.
- Pasted text is piped to `trufflehog stdin`. Nothing is written to disk or logged.
- **Verification sends each key to its own provider's API** (e.g. an OpenAI key goes to api.openai.com). That is how TruffleHog tells live from revoked.
- Do not host this as a public website. Run it on your own machine.

## Results

| Label | Meaning |
|---|---|
| 仍有效 (live) | The provider accepted the key. Revoke it. |
| 已失效 (dead) | Recognized, but the provider rejected it. |
| 無法判斷 (unknown) | Verification failed with an error. |
| 認不出 (unrecognized) | TruffleHog has no detector for this format. Check the provider's dashboard. |

Google's newer Gemini keys starting with `AQ.` aren't detected by TruffleHog yet ([#5437](https://github.com/trufflesecurity/trufflehog/issues/5437)), so key-check checks those directly against the Gemini API. Some valid `AQ.` keys are reportedly rejected by that endpoint; confirm in AI Studio if a fresh key shows as dead.

## License

MIT for this wrapper. TruffleHog is AGPL-3.0 and is not bundled.

---

## 中文

[TruffleHog](https://github.com/trufflesecurity/trufflehog) 的本機網頁介面：貼上 API key，看哪些還有效。

本專案與 Truffle Security 無關，偵測與驗證都由你電腦上安裝的 TruffleHog 執行。

**需求**：Node.js 18 以上、TruffleHog（`brew install trufflehog`）。

**執行**：`npm start`，打開 http://127.0.0.1:5199，貼上 key（一行一把）。連變數名一起貼（例如直接從 `.env` 複製 `NAME=value`）辨識率較高。

**key 會去哪裡**

- 伺服器只綁 `127.0.0.1`，並拒絕來自其他網站的請求。
- 貼上的內容直接交給 `trufflehog stdin`，不寫檔、不記 log。
- **驗證時，每把 key 會送到它所屬服務的 API**（例如 OpenAI key 送到 api.openai.com），這是判斷有效或失效的方式。
- 請在自己的電腦執行，不要架成公開網站讓別人貼 key。

**結果**：仍有效＝服務商接受這把 key，請撤銷；已失效＝認得但被拒絕；無法判斷＝驗證出錯；認不出＝TruffleHog 沒有這種格式的偵測器，請到該服務後台確認。

Google 新版 `AQ.` 開頭的 Gemini key，TruffleHog 目前還認不出（[#5437](https://github.com/trufflesecurity/trufflehog/issues/5437)），key-check 會直接向 Gemini API 確認。有回報指出少數有效的 `AQ.` key 也會被拒，剛建立的 key 若顯示已失效，請到 AI Studio 確認。
