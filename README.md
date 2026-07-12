# Liquid Motion Toy

比重の異なる流体の液滴が、段差・ジグザグ通路・斜面・羽根車・シーソーを通って落下する様子を眺める鑑賞玩具の Web アプリ版。

**▶ https://f4ah6o.github.io/LiquidMotionSPA/**

## 遊び方

- **スマホ**: 「タップして開始」→ 端末を傾けると重力の向きが変わり、液滴が流れる。ひっくり返すと砂時計のように再開。
- **デスクトップ / センサー非対応**: 「⟳ 反転」ボタンまたはダブルタップで容器を反転。
- **✦ リセット**: 段差・歯車・シーソーの配置を自動生成し直す(ページ読込ごとにも毎回変わる)。

## 技術

- ビルドレスの Vanilla JS (ES modules) + Canvas 2D
- 自作パーティクル物理(Verlet 積分 + 凝集/反発で液滴の変形・分裂・合体を表現。バルブやスクリプト的な流量制御はなく、開口の幅・重力・物性だけで流下が決まる)
- ステージ(段差・歯車・シーソー・トレイ開口)は手続き生成で、反転遊びが成立するよう点対称に配置
- `DeviceOrientationEvent` を重力ベクトルに変換(iOS 13+ の権限リクエスト対応、画面回転補正あり)
- GitHub Actions で GitHub Pages にデプロイ(`.github/workflows/pages.yml`)

## ローカル実行

```sh
python3 -m http.server 8000
# → http://localhost:8000
```

## デプロイ

`main` ブランチへの push で自動デプロイ。初回のみリポジトリ設定で **Settings → Pages → Source = "GitHub Actions"** を選択する。
