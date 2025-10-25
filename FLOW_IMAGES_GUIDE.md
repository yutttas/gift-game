# Flow障害物画像の追加方法

## 📁 画像ファイルを追加するだけでOK！

`assets/flow/` フォルダに画像ファイル（.png, .jpg, .jpeg, .heic）を追加すれば、**自動的に障害物として認識**されます！

### 対応する拡張子
- `.png`, `.jpg`, `.jpeg`, `.heic`
- 大文字小文字両方OK: `.PNG`, `.JPG`, `.JPEG`, `.HEIC`

## 🎯 自動検出されるファイル名パターン

以下のパターンのファイル名は自動的に検出されます（0〜2000まで）：

### よくあるカメラのファイル名
- `IMG_0001.jpg` ~ `IMG_2000.jpg`
- `PXL_0001.jpg` ~ `PXL_2000.jpg`
- `DSC_0001.jpg` ~ `DSC_2000.jpg`
- `DCIM_0001.jpg` ~ `DCIM_2000.jpg`

### 一般的なファイル名
- `photo_001.png`, `Photo_001.png`
- `image_001.png`, `Image_001.png`
- `pic_001.png`, `Pic_001.png`
- `Picture_001.jpg`
- `Screenshot_001.png`
- `snap_001.jpg`, `shot_001.jpg`

### その他
- `flow_001.jpg` ~ `flow_100.jpg`
- `1.jpg` ~ `100.jpg` (数字のみ)
- ハッシュ風のファイル名（例：`5572ebc4949b5d5903c1e86cee471805_t.jpeg`）

## ⚡ より確実に読み込む方法（オプション）

特定の画像を**確実に**読み込みたい場合は、`assets/config.json` の `flow` 配列に追加：

```json
"flow": [
  "assets/flow/特別な画像.jpg",
  "assets/flow/必ず使いたい画像.png"
],
```

## 💡 使い方の例

1. `assets/flow/IMG_1234.jpg` を追加 → 自動検出される ✅
2. `assets/flow/my-photo.jpg` を追加 → 検出されない可能性あり ⚠️
3. `assets/flow/my-photo.jpg` を使いたい場合：
   - `config.json` の `flow` 配列に `"assets/flow/my-photo.jpg"` を追加

## ⚠️ 注意事項

- 自動検出は**非同期で実行**されるため、ゲーム開始直後には反映されない場合があります
- プレイ中に自動検出された画像が追加されます
- 確実に最初から使いたい画像は `config.json` に明記してください

## デバッグ方法

ブラウザの開発者ツール（F12）→ コンソールで以下を確認：

```
[Boot] Loading X flow images from config  // config.jsonから読み込み
[Flow] Brute force found: Y files         // 自動検出で見つかった数
[Play] Flow keys available: Z             // 利用可能な障害物画像の総数
```

## 調整可能な設定

`assets/config.json` で以下の設定が可能：

```json
{
  "flowMaxConcurrent": 6,    // 同時に表示する障害物の最大数（デフォルト: 6）
  "bgOpacity": 0.65          // 背景の不透明度（0.0 ~ 1.0）
}
```
