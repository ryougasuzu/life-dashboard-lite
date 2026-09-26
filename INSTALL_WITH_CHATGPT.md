# ChatGPTで導入する手順

このドキュメントは、**Life Dashboard Lite の導入作業を利用者本人ではなく、その利用者のChatGPTに進めてもらう**ことを前提にしています。

Life Dashboard Lite は次の役割分担です。

- **食事・栄養**: ChatGPT等からSupabaseへ登録し、GitHub Pagesでは閲覧
- **筋トレ・有酸素**: GitHub Pagesから手動登録可能
- **表示・集計**: GitHub Pages
- **データの正本**: 利用者自身のSupabase Project

各利用者は、自分専用のSupabase ProjectとGitHub Repositoryを持ちます。

---

## 利用者が最初に用意するもの

以下のアカウントが必要です。

- GitHub
- Supabase
- ChatGPT

このRepositoryを自分のGitHubアカウントへコピーしてください。

推奨:

1. GitHubでこのRepositoryを開く
2. **Use this template** で自分のRepositoryを作成
3. 作成したRepositoryのURLをコピー

Forkでも動作します。

---

# ChatGPTに送る指示

新しいChatGPTチャットを開き、GitHubとSupabaseへの接続を有効にしたうえで、次のように依頼してください。

```text
Life Dashboard Liteを導入したいです。

私のGitHub Repository:
https://github.com/YOUR_NAME/YOUR_REPOSITORY

このRepositoryの INSTALL_WITH_CHATGPT.md と README.md を読んで、
私のSupabase無料ProjectとGitHub Pagesを使って導入してください。

可能な作業はあなたが直接実行してください。
私の操作が必要な箇所だけ、具体的な手順を案内してください。

secret key / service_role keyはGitHubやブラウザ側へ保存しないでください。
```

ChatGPTには、以下の手順を最後まで進めてもらってください。

---

# ChatGPT向け実行手順

以下は、このRepositoryをセットアップするAIエージェント向けの指示です。

## 1. Repositoryを確認する

利用者が指定したRepositoryを開き、最低限次のファイルが存在することを確認してください。

```text
index.html
css/app.css
js/app.js
js/config.js
supabase/setup.sql
supabase/seed.sql
.github/workflows/pages.yml
README.md
INSTALL_WITH_CHATGPT.md
```

元Repositoryではなく、**利用者自身が所有するコピー先Repository**を編集してください。

---

## 2. Supabase Projectを用意する

利用者のSupabaseアカウントで、このDashboard専用のProjectを1つ使用します。

既存の空Projectを使っても、新しいProjectを作成しても構いません。

推奨Project名:

```text
life-dashboard
```

他のアプリとデータを混在させる必要はありません。

### Project選択時の注意

既存Projectを使う場合は、同名の `life_*` テーブルやViewが存在しないか確認してください。

既存データがある場合は勝手に削除・上書きせず、利用者へ確認してください。

---

## 3. Database Schemaを作る

Repository内の次のSQLを順番に実行してください。

1. `supabase/setup.sql`
2. `supabase/seed.sql`

`setup.sql` では主に以下を作成します。

### 食事・栄養

- `life_meals`
- `life_meal_nutrients`
- `life_food_catalog`
- `life_food_nutrients`
- `life_nutrient_definitions`
- `life_targets`
- `life_nutrient_targets`

### 運動

- `life_workout_sessions`
- `life_strength_sets`
- `life_cardio_sessions`

### 共通・表示用

- `life_profiles`
- `life_meals_local`
- `life_workout_sessions_local`
- `life_cardio_sessions_local`
- `life_nutrition_daily`
- `life_micronutrition_daily`
- `life_daily_summary`

### セキュリティ

すべてのユーザーデータはSupabase Authの

```sql
auth.uid() = user_id
```

を基本としてRLSで分離されます。

SQL適用後は、Security Advisor等で重大な警告がないか確認してください。

---

## 4. SQL適用を検証する

最低限、次を確認してください。

- 必要な `life_*` テーブルが存在する
- `life_nutrient_definitions` に栄養素定義が入っている
- RLSが有効
- `life_daily_summary` が存在する
- `life_nutrition_daily` が存在する
- `life_micronutrition_daily` が存在する

栄養素の欠測は0として補完しないでください。

---

## 5. Supabase Authを設定する

GitHub Pagesの公開URLをAuthのSite URLまたはRedirect URLとして許可します。

通常のURLは次の形式です。

```text
https://GITHUB_USERNAME.github.io/REPOSITORY_NAME/
```

例:

```text
https://example.github.io/life-dashboard-lite/
```

メール確認を有効にしている場合も、このURLへ戻れるようにしてください。

Auth設定をツールから変更できない場合は、利用者にSupabase Dashboard上の操作手順だけ案内してください。

---

## 6. Supabase URLとPublishable Keyを取得する

対象Projectから以下を取得します。

- Project URL
- Publishable key

使用してよいキーは、

```text
sb_publishable_...
```

です。

### 絶対に使用してはいけないもの

以下は `js/config.js` に入れないでください。

- secret key
- `sb_secret_...`
- service_role key
- database password

Publishable keyはブラウザ向けの公開キーです。データ保護はRLSとSupabase Authで行います。

---

## 7. js/config.js を設定する

Repositoryの

```text
js/config.js
```

を利用者のSupabase Projectに合わせて更新してください。

形式:

```js
window.LIFE_DASHBOARD_CONFIG = {
  supabaseUrl: "https://PROJECT_REF.supabase.co",
  supabasePublishableKey: "sb_publishable_...",
  defaultTimezone: "Asia/Tokyo"
};
```

日本で利用する場合は通常 `Asia/Tokyo` のままで構いません。

変更を利用者のRepositoryへcommitしてください。

---

## 8. GitHub Pagesを有効化する

このRepositoryには

```text
.github/workflows/pages.yml
```

があります。

GitHub PagesのSourceを **GitHub Actions** に設定してください。

ツールから変更できない場合は、利用者に次を案内してください。

```text
Repository
→ Settings
→ Pages
→ Build and deployment
→ Source
→ GitHub Actions
```

設定後、workflowを実行し、PagesのURLを確認してください。

---

## 9. 初回ユーザー登録を行う

公開されたLife Dashboard Liteを開きます。

画面から、

- メールアドレス
- パスワード

を入力して初回登録します。

メール確認が有効な場合は確認メールを開きます。

ログイン後、`life_profiles` にそのユーザーの設定行が作られます。

---

## 10. 動作確認する

最低限、以下を確認してください。

### 認証

- 新規登録できる
- ログインできる
- ログアウトできる

### Dashboard

- 月間カレンダーが表示される
- 日付を選択できる
- データがない日は0ではなく「—」等で表示される

### 筋トレ

Pagesからテストとして1件登録し、

- `life_workout_sessions`
- `life_strength_sets`

へ保存されることを確認してください。

確認後、不要なテストデータは削除して構いません。

### 有酸素

Pagesからテストとして1件登録し、

- `life_cardio_sessions`

へ保存されることを確認してください。

確認後、不要なテストデータは削除して構いません。

### RLS

ログインしていない状態で個人データを取得できないことを確認してください。

---

# 食事記録の運用

Life Dashboard Liteでは、**Pagesから食事を入力しません**。

食事はChatGPTとの会話からSupabaseへ登録する運用を想定しています。

利用者は例えば次のように伝えます。

```text
今日の朝、米0.7合、卵2個、納豆1パックを食べた
```

ChatGPTは、その利用者のSupabaseへ記録してください。

---

## 食事記録時のルール

### 正本

食事:

```text
life_meals
```

詳細栄養素:

```text
life_meal_nutrients
```

食品マスタ:

```text
life_food_catalog
life_food_nutrients
```

### 栄養値の優先順位

1. メーカー公式
2. 登録済み食品マスタ
3. 公的な食品成分表
4. 類似食品
5. 合理的推定

メーカー公式等で確認できない推定値には、

```text
is_estimated = true
```

を設定してください。

可能であれば `source` と `notes` に根拠を残してください。

---

## PFCだけで終了しない

新しい食事を記録するときは、

```text
life_nutrient_definitions
```

に定義されている詳細栄養素も確認してください。

推定可能なものは `life_meal_nutrients` に保存します。

ただし、**不明な栄養素を根拠なく0で保存してはいけません。**

0として保存できるのは、

- メーカー公式値が0
- 公的成分表で0
- 食品組成上、合理的に0と判断可能

などの場合です。

不明なら未登録のままにしてください。

---

## 食品マスタを再利用する

同じ食品を繰り返し食べる場合、毎回推定し直さず、

```text
life_food_catalog
life_food_nutrients
```

に登録された既存データを優先して利用してください。

例:

- プロテイン
- カロリーメイト等の栄養調整食品
- 納豆
- ヨーグルト
- 飲料
- 冷凍食品

---

## 日次栄養評価

日次栄養を見る場合は、

```text
life_nutrition_daily
life_micronutrition_daily
```

を利用します。

詳細栄養素については、

- `known_meal_count`
- `item_count`
- `estimated_value_count`

を考慮してください。

例えば、

```text
known_meal_count = 2
item_count = 5
```

なら、その栄養素の値は5件中2件分しか算出されていません。

完全な1日合計として扱わないでください。

---

# 運動記録の運用

筋トレ・有酸素は基本的にGitHub Pagesから入力できます。

利用者がChatGPTに直接伝えた場合は、ChatGPTからSupabaseへ記録しても構いません。

### 筋トレ

セッション:

```text
life_workout_sessions
```

セット:

```text
life_strength_sets
```

### 有酸素

```text
life_cardio_sessions
```

予定ではなく、実際に行った運動だけを保存してください。

---

# ChatGPTが導入完了時に報告する内容

導入が完了したら、利用者へ最低限次を報告してください。

1. 使用したSupabase Project名
2. GitHub Repository名
3. GitHub Pages URL
4. Database schema適用結果
5. Auth設定状況
6. RLS確認結果
7. 筋トレ登録テスト結果
8. 有酸素登録テスト結果
9. 利用者側に残っている手作業

secret key、service_role key、database passwordなどの秘密情報は回答へ表示しないでください。

---

# 導入後に利用者がChatGPTへ送る例

食事登録:

```text
朝、米0.7合、卵2個、納豆1パックを食べた。Life Dashboardに記録して。
```

食事確認:

```text
今日の食事と栄養をLife DashboardのSupabaseから確認して。
```

運動確認:

```text
今週の筋トレと有酸素をまとめて。
```

栄養評価:

```text
今日の栄養を評価して。不完全な栄養素はknown_meal_countも考慮して。
```

---

## 導入方針の要約

```text
利用者
  │
  ├─ 食事をChatGPTに伝える
  │        ↓
  │     Supabase
  │
  ├─ 筋トレ・有酸素をPagesから入力
  │        ↓
  │     Supabase
  │
  └─ GitHub Pagesで閲覧
           ↑
        Supabase
```

Life Dashboard Liteは、GitHub Pagesをデータの正本にしません。

**データの正本は常に利用者自身のSupabaseです。**
