# Liquid Motion Toy

比重の異なる流体の液滴が、段差・歯車・シーソー・接触量で開く弁を通って落下する様子を眺めるWebアプリ版のLiquid Motion玩具。

**▶ https://f4ah6o.github.io/LiquidMotionSPA/**

## 遊び方

- **スマホ**: 「タップして開始」後、端末を傾けると重力の向きが変わる。傾き入力を無効にして手動操作だけでも遊べる。
- **デスクトップ / センサー非対応**: 「反転」ボタン、キャンバスのダブルタップ、または`F`キーで容器を反転する。
- **一時停止**: ボタン、`Space`、`P`キーで切り替える。
- **リセット**: 同じシーンと同じseedの初期状態へ戻す。別の配置には変わらない。
- **速度**: 0.5倍、1倍、2倍を選択する。`1`〜`3`キーでも切り替えられる。

## シーン

- **Step Drop**: 段差と羽根車を通る基本シーン
- **Gear Flow**: 2つの歯車が逆方向に連動するシーン
- **Branch and Merge**: 分岐、接触量で開く弁、再合流を組み合わせたシーン
- **Random Lab**: seed付き手続き生成を試す実験シーン

選択したシーンはローカルに保存される。共有URLには`scene`と`seed`が含まれ、JSONとしてシーン定義をエクスポートできる。

## 技術

- ビルドレスのVanilla JS（ES modules）+ Canvas 2D
- Verlet積分、近傍探索、凝集・反発・粘性による粒子物理
- JSON互換のシーン定義とseed付き乱数
- 明示的なシミュレーション状態機械
- 端末センサー、ボタン、ダブルタップ、キーボードを同じ操作へ集約
- PWA manifestとService Workerによるオフライン再生
- Node.js標準テストランナーによるシーン・状態・物理契約の検証

## ローカル実行

```sh
python3 -m http.server 8000
# http://localhost:8000
```

## テスト

```sh
npm test
npm run check
```

## デプロイ

`main`ブランチへのpushでGitHub Pagesへデプロイする。初回のみリポジトリ設定で **Settings → Pages → Source = GitHub Actions** を選択する。
