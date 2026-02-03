# 🎤 音声メモ - 録音＆文字起こしアプリ

iPhone/PCで使える音声録音アプリ。リアルタイム文字起こしと高精度AIによる文字起こしの両方に対応。Obsidianでの管理に最適化。

## ✨ 主な機能

- 🎤 **音声録音** - ブラウザで簡単に録音
- 💬 **2つの文字起こしモード**
  - リアルタイム（Web Speech API）
  - 高精度（Groq Whisper API）
- 📅 **自動日付ファイル名** - `YYYY-MM-DD_HH-MM_recording.md`
- 📝 **Markdown出力** - Obsidian用フロントマター対応
- 📱 **PWA対応** - iPhoneホーム画面に追加可能
- 🎨 **モダンUI** - ダークテーマ、アニメーション

## 🚀 使い方

### オンライン版（iPhone/PC）
https://YOUR_USERNAME.github.io/voice-memo/

1. ブラウザでアクセス
2. マイク許可
3. 録音開始
4. ファイルダウンロード
5. Obsidianに保存

### iPhone PWAインストール
1. Safariで開く
2. 共有ボタン → 「ホーム画面に追加」
3. アプリとして起動

### Groq API設定（高精度モード）
1. https://console.groq.com/keys でAPIキー取得（無料）
2. 設定⚙️でAPIキー入力
3. 「高精度 Groq」を選択

## 📂 Obsidian連携

ダウンロードしたファイルをObsidian Vaultにコピー：

```
Obsidian Vault/
  └── Recording/
      ├── 2026-02-03_23-00_recording.md
      └── 2026-02-03_23-00_recording.webm
```

## 🛠️ 技術スタック

- Vanilla JavaScript（フレームワーク不要）
- MediaRecorder API
- Web Speech API
- Groq Whisper API
- PWA（Service Worker）

## 📄 ライセンス

MIT License

## 👤 作者

山下和也
