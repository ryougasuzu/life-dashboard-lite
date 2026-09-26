# Life Dashboard Lite

食事・栄養の可視化と、筋トレ・有酸素の手動記録に絞った個人用Life Dashboardです。

> **ChatGPTに導入作業を任せる場合:** [INSTALL_WITH_CHATGPT.md](./INSTALL_WITH_CHATGPT.md) を使ってください。

- Frontend: GitHub Pages（静的HTML/CSS/JavaScript）
- Backend: Supabase（Database + Auth + RLS）
- 1人1 Supabase Projectを想定
- 食事・栄養: Pagesでは閲覧専用。ChatGPT、API、SQLなど外部経路からSupabaseへ登録
- 筋トレ・有酸素: Pagesから登録可能
- Health Connect / ScreenTime / GPS / Camera / Push通知は含みません
- 欠測値は0にせず、NULLまたは未登録のまま扱います

## セットアップ

### 1. このRepositoryをコピー

GitHubの **Use this template** またはForkで自分のRepositoryを作成します。

### 2. Supabase Projectを作成

無料のSupabase Projectを1つ作成します。

### 3. DBを作成

Supabase Dashboard → SQL Editorで、次の順に実行します。

1. `supabase/setup.sql`
2. `supabase/seed.sql`

`setup.sql` はテーブル、RLS、Data API権限、日次集計Viewをまとめて作成します。

### 4. Authを設定

Supabase Dashboard → Authentication → URL Configurationで、GitHub PagesのURLをSite URL / Redirect URLとして設定します。

例:

```text
https://YOUR_GITHUB_ID.github.io/YOUR_REPOSITORY/
```

メール確認を有効にしている場合、確認メール後のリダイレクト先としても同じURLを許可してください。

### 5. Supabase接続情報を設定

`js/config.js` を開き、以下を自分の値に変更します。

```js
window.LIFE_DASHBOARD_CONFIG = {
  supabaseUrl: "https://YOUR_PROJECT_REF.supabase.co",
  supabasePublishableKey: "sb_publishable_...",
  defaultTimezone: "Asia/Tokyo"
};
```

**publishable keyはフロントエンド用です。secret key / service_role keyは絶対に入れないでください。**

### 6. GitHub Pagesを有効化

Repository → Settings → Pages → Source を **GitHub Actions** にします。

`main` へpushすると自動デプロイされます。

## 入力経路

### 食事・栄養

Pagesからは登録しません。

```text
ChatGPT / API / SQL / 任意の入力クライアント
                  ↓
              Supabase
                  ↓
        Life Dashboard Lite
              （閲覧）
```

食事の正本は `life_meals`、詳細栄養素は `life_meal_nutrients` です。繰り返し使う食品には `life_food_catalog` / `life_food_nutrients` を利用できます。

### 筋トレ・有酸素

Pagesの「筋トレ」「有酸素」画面から直接Supabaseへ保存します。

- 筋トレ: `life_workout_sessions` + `life_strength_sets`
- 有酸素: `life_cardio_sessions`

## 主な機能

- メール + パスワードによるSupabase Auth
- 月間カレンダー
- 日別食事履歴
- 日別PFC表示
- ビタミン・ミネラル等の表示
- 栄養データの算出済み件数・推定値件数表示
- 筋トレ登録（1セット1行）
- 有酸素登録
- カロリー / PFC目標
- 微量栄養素目標
- ユーザーごとのタイムゾーン
- RLSによるユーザー単位のデータ分離

## データモデル

### 食事・栄養

- `life_meals`
- `life_meal_nutrients`
- `life_food_catalog`
- `life_food_nutrients`
- `life_nutrient_definitions`
- `life_targets`
- `life_nutrient_targets`
- `life_nutrition_daily`
- `life_micronutrition_daily`

### 運動

- `life_workout_sessions`
- `life_strength_sets`
- `life_cardio_sessions`

### 共通・表示用

- `life_profiles`
- `life_meals_local`
- `life_workout_sessions_local`
- `life_cardio_sessions_local`
- `life_daily_summary`

## 栄養データ方針

栄養値が不明な場合は0を入れず、未登録のままにします。推定値は `is_estimated=true` とし、可能なら `source` / `notes` に根拠を残します。

`life_micronutrition_daily` は `known_meal_count` と `item_count` を保持するため、一部の食事しか詳細栄養素が分からない場合でも「完全な日次値」と誤認しにくい設計です。

## Security

- exposed tableはすべてRLSを有効化
- 通常データは `auth.uid() = user_id` で所有者を制限
- 集計Viewは `security_invoker = true`
- `anon` にデータテーブルのアクセス権を与えない
- frontendではpublishable keyのみ使用
- secret / service_role keyは使用しません

## License

MIT
