# Life Dashboard Lite

食事・栄養・筋トレ・有酸素だけを記録・可視化する、個人用の軽量Life Dashboardです。

- Frontend: GitHub Pages（静的HTML/CSS/JavaScript）
- Backend: Supabase（Database + Auth + RLS）
- 1人1 Supabase Projectを想定
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

## 主な機能

- メール + パスワードによるSupabase Auth
- 月間カレンダー
- 日別PFC表示
- 食事登録
- 微量栄養素の任意登録
- 筋トレ登録（1セット1行）
- 有酸素登録
- カロリー / PFC目標
- 微量栄養素の日次集計
- 食品マスタ用テーブル
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

### 共通

- `life_profiles`
- `life_daily_summary`

## データ方針

栄養値が不明な場合は0を入れず、未登録のままにします。推定値は `is_estimated=true` とし、可能なら `source` / `notes` に根拠を残します。

`life_micronutrition_daily` は `known_meal_count` と `item_count` を保持するため、一部の食事しか詳細栄養素が分からない場合でも「完全な日次値」と誤認しにくい設計です。

## Security

- exposed tableはすべてRLSを有効化
- 通常データは `auth.uid() = user_id` で所有者を制限
- frontendではpublishable keyのみ使用
- secret / service_role keyは使用しません

## License

MIT
