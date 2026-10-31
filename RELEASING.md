# リリース手順

このプロジェクトのリリースは、[changesets](https://github.com/changesets/changesets) でバージョンと CHANGELOG を更新し、`pnpm release` でタグを push すると、GitHub Actions（`.github/workflows/publish.yml`）が自動で npm に公開する仕組みになっています。ローカルから `npm publish` することはありません。

## 前提条件

- npm アカウントを持っていて、2要素認証（2FA）が設定されていること
- npm 上の `ruroute` パッケージの管理権限があること
- このリポジトリへの push 権限があること

## 初回セットアップ（最初の1回だけ）

`ruroute` は既に npm に公開済み（0.4.0 まで）なので、手動での初回公開は不要です。npm の Trusted Publisher（GitHub Actions を信頼済みの発行元として登録する仕組み）の登録だけ行います。

1. [npmjs.com](https://www.npmjs.com/) にログインし、`ruroute` の設定ページの「Trusted Publisher」セクションから登録します。登録する内容:

   | 項目                 | 値                                                                 |
   | -------------------- | ------------------------------------------------------------------ |
   | Publisher            | `GitHub Actions`                                                   |
   | Organization or user | `mokume3`                                                          |
   | Repository           | `ruroute`                                                          |
   | Workflow filename    | `publish.yml`                                                      |
   | Environment name     | （空欄のまま）                                                     |
   | Allowed actions      | `Allow npm publish` にチェック（`Allow npm stage publish` は不要） |

   「Allowed actions」は最低1つのチェックが必須です。`npm stage publish` はステージング公開後に人間が2FAで承認・昇格するフローで、`publish.yml` はステージングを経由せず直接 `npm publish` を実行する設計なので、`Allow npm publish` のみにチェックしてください。

2. これ以降のリリースはすべて `publish.yml` 経由で行われます。`npm publish` にトークンは不要です（`id-token: write` 権限だけで通ります）。

## 変更を加えるとき（開発中）

リリースに含めたい変更を入れる PR ごとに、changeset を追加します。

```bash
pnpm changeset
```

対話形式で patch / minor / major と変更内容を聞かれ、`.changeset/` に Markdown ファイルが作られます。このファイルも一緒にコミットしてください。ここに書いた内容が、リリース時に `CHANGELOG.md` に入ります。

## 通常のリリース手順

1. main を最新にし、作業ツリーがきれいな状態にします。

   ```bash
   git switch main
   git pull
   ```

2. 溜まっている changeset からバージョンを決め、`package.json` の `version` と `CHANGELOG.md` を更新します（使った `.changeset/*.md` は削除されます）。

   ```bash
   pnpm version-packages
   ```

3. 差分を確認してコミットします。

   ```bash
   git add -A
   git commit -m "chore: release v$(node -p "require('./package.json').version")"
   ```

4. タグを作って push します。`changeset tag` が `v<version>` のタグを作り、`git push --follow-tags` で main とタグを一緒に push します。push 前に lefthook の pre-push（テスト・カバレッジ・knip など）が走ります。

   ```bash
   pnpm release
   ```

5. GitHub の Actions タブを開き、`Publish` ワークフローの実行結果を確認します。

   ```bash
   gh run watch $(gh run list --workflow=publish.yml --limit 1 --json databaseId --jq '.[0].databaseId')
   ```

6. 完了したら、npm（`https://www.npmjs.com/package/ruroute`）と GitHub の Releases ページに反映されていることを確認します。

## プレリリース（`next` タグ）

`1.0.0-next.0` のように `-` を含むバージョンは、npm の `next` dist-tag で公開されます（`latest` は動きません）。changesets のプレリリースモードを使います。

```bash
pnpm changeset pre enter next
pnpm version-packages
```

あとは通常のリリース手順の 3 以降と同じです。プレリリースを終えるときは `pnpm changeset pre exit` を実行してから `pnpm version-packages` します。

## dry-run で試す

実際にタグを push する前に、CI 上でのインストール・チェック・ビルドだけを安全に試したい場合は、GitHub の Actions タブから `Publish` ワークフローを手動実行します。`workflow_dispatch` には入力が無く、常に dry-run 扱いになります（`npm publish` と GitHub Release の作成は常にスキップされます）。

```bash
gh workflow run publish.yml --ref main
```

## トラブルシューティング

### `pnpm install` が `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` で失敗した

lockfile に、公開されてから日の浅い依存パッケージが入っています。pnpm の待機ルール（minimumReleaseAge）は回避せず、待機期間を過ぎるまで待つか、待機期間を過ぎた1つ前の版に下げて lockfile を更新してください。

```bash
pnpm update <package>
```

### バージョン不一致でジョブが失敗した

タグ名と `package.json` の `version` が一致していません。`pnpm release` を使わず手でタグを打った場合などに起きます。そのタグを削除してください。

```bash
git tag -d v1.2.3
git push origin :refs/tags/v1.2.3
```

その後、`package.json` の `version` が正しいことを確認して `pnpm release` をやり直します。

### チェックやテストがコード側の問題で失敗した

型チェック・lint・テスト・カバレッジ・knip・tree-shaking・型パフォーマンスのいずれかがコード側の問題で失敗した場合、GitHub の Actions タブから「Re-run all jobs」をしても直りません。ワークフロー実行はトリガー時点のコミット（`headSha`）に固定されていて、`actions/checkout` はその同じコミットを何度でもチェックアウトし直すだけだからです。後から main に修正を push しても、古い実行の rerun には反映されません。

対応手順:

1. main 上でコードを修正し、ローカルで以下が通ることを確認する

   ```bash
   pnpm typecheck && pnpm lint && pnpm build && pnpm test:coverage && pnpm knip
   ```

2. 失敗したタグと同じバージョンは再利用できないため、`pnpm changeset` で patch の changeset を追加し、通常のリリース手順の 2 からやり直して新しいバージョン（例: v1.2.0 が失敗したなら v1.2.1）を切る
3. 新しいタグの push で Publish ワークフローが最初から走る

dry-run（`workflow_dispatch`）が同じ理由で失敗した場合は、rerun ではなく次のコマンドで新規に dispatch し直してください。その時点の main の先端（修正後のコミット）が使われます。

```bash
gh workflow run publish.yml --ref main
```

rerun が有効なのは、ネットワーク瞬断など「コミット内容は変わらないのにたまたま失敗した」場合だけです（次項）。

### `npm publish` がネットワークエラー等で失敗した

タグは既に push されているので、同じ実行を再実行すれば十分です（コミット内容は変わらないため冪等です）。GitHub の Actions タブから、失敗したワークフロー実行を開き、「Re-run all jobs」を選んでください。

### `npm publish` は成功したが GitHub Release の作成が失敗した

パッケージは既に公開されているので影響は軽微です。以下を手動で実行してください。

```bash
gh release create v1.2.3 --generate-notes
```
