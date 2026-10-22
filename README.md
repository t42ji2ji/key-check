# key-check

**English** | [繁體中文](README.zh-TW.md)

Accidentally pushed an API key to GitHub, or pasted one in a chat? Paste it into key-check to find out whether it still works, so you know if you need to revoke it.

![key-check screenshot](docs/screenshot.png)

- Works with GitHub, OpenAI, Anthropic, AWS, Stripe, Gemini and 800+ other services
- Runs on your own computer. Your keys are never stored.
- Paste a whole `.env` file at once and check every key in it

Under the hood it uses [TruffleHog](https://github.com/trufflesecurity/trufflehog), an open-source secret scanner. key-check is not affiliated with Truffle Security.

## Get started

You need [Node.js](https://nodejs.org) 18 or newer.

```sh
git clone https://github.com/t42ji2ji/key-check.git
cd key-check
npm start
```

Then open http://127.0.0.1:5199 in your browser.

The first time, the page may say TruffleHog isn't installed. Click **Install** and it will set it up for you. If you already have it (for example from `brew install trufflehog`), the page uses that one.

## How to use it

1. Paste one or more keys. Each line becomes its own item; click × to remove one.
2. Click **Check**, or press Enter.
3. Read the result for each key:

| Result | What it means | What to do |
|---|---|---|
| **Live** | The key still works. | Revoke it now. The card links to the right page. |
| **Dead** | The key no longer works. | Nothing. It's already revoked or invalid. |
| **Unknown** | Something went wrong while checking. | Try again later, or check the service's dashboard. |
| **Unrecognized** | key-check doesn't know what kind of key this is. | Check the service's dashboard yourself. |

Tip: paste the variable name with the key, like `OPENAI_API_KEY=sk-...`. It helps key-check tell what kind of key it is.

## Is it safe to paste my keys here?

- Everything runs on your computer. Your keys aren't saved to disk or logs.
- To find out whether a key works, each key is sent **only to the service it belongs to**. An OpenAI key goes to OpenAI, a GitHub token goes to GitHub, and so on. Nothing goes to us or to anyone else.
- The service logos are loaded from Google, so Google can see which services you checked, but never the keys.
- Only run key-check on your own computer. Don't put it on a public server for other people to paste keys into.

## FAQ

**Does it work on Windows?**
It should, but it has only been tested on macOS so far. If you try it on Windows, please open an issue and let us know how it went.

**My Gemini key starts with `AQ.`. Is it supported?**
Yes. TruffleHog doesn't recognize these newer Google keys yet, so key-check checks them with Google directly.

**Where does the page install TruffleHog?**
In `~/.cache/key-check/bin`, inside your home folder. It doesn't need admin rights and doesn't touch anything else. Delete that folder to remove it.

## Advanced

<details>
<summary>How the install works</summary>

The page asks the local server whether TruffleHog is available. The server looks for `~/.cache/key-check/bin/trufflehog` first, then `trufflehog` on your `PATH`. When you click Install, the server downloads the latest official release from GitHub, verifies its SHA-256 against the release's `checksums.txt` (and stops if it doesn't match), and extracts it to `~/.cache/key-check/bin`.

</details>

<details>
<summary>Gemini <code>AQ.</code> keys in detail</summary>

Released TruffleHog doesn't detect `AQ.` keys yet ([#5437](https://github.com/trufflesecurity/trufflehog/issues/5437)). [PR #5440](https://github.com/trufflesecurity/trufflehog/pull/5440) adds them but isn't merged.

By default, when TruffleHog doesn't report a Gemini key, the server checks each `AQ.` string itself. It calls `generativelanguage.googleapis.com/v1beta/models` with the `x-goog-api-key` header: 200 means live, "API key not valid" means dead, anything else is unknown.

You can also build PR #5440 and put the binary at `~/.cache/key-check/bin/trufflehog`; key-check prefers it over the one on `PATH`. The PR only treats HTTP 400 as invalid, but invalid `AQ.` keys return 401, so add 401 in `pkg/detectors/googlegemini/googlegemini.go`:

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

Clicking Install on the page replaces this build with the official release.

</details>

<details>
<summary>Development</summary>

- The background is [ascii-sharks](https://github.com/stackedlol/ascii-sharks). The source is in `sharks/`, changed so that clicking leaves blood and the sharks rise and dive. Rebuild with `npm run build:sharks`.
- Open http://127.0.0.1:5199/#dev to get a **DEV fake data** button. It fills in fake keys and returns made-up results for every state, without calling TruffleHog. The code is the `<!-- DEV 測試鈕 -->` block at the end of `index.html`.
- The page is in English, or in Chinese when the browser language is Chinese.

</details>

## License

key-check is MIT licensed. TruffleHog is AGPL-3.0 and is not included in this repo.

The shark background (`sharks/` and `sharks.js`) is adapted from [stackedlol/ascii-sharks](https://github.com/stackedlol/ascii-sharks). That project has no license, so this part is **not** covered by MIT and remains its author's work. It will be removed on request.
