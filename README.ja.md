# prompt-design-review

プロンプト・CLAUDE.md・skill の書き方を点検し、Claude Code 組み込みの監査（`/doctor prompt-audit`）の結果と並べて一つの報告書にする Claude Code プラグインです。ソフトウェアの設計レビュー用ではありません。

[English README](README.md)

## 概要

Claude Code 2.1.283 以降には、プロンプト資産の古い書き方を探す組み込みの監査があります。このプラグインはその監査を動かし、監査が見ない設計の欠けを足して、二つを並べて報告します。

- 組み込みの監査（報告書では「Claude Code 標準の Prompt 診断」）: 監査が出したもの全部（古い書き方や強調しすぎ、存在しない参照、ファイル同士の矛盾、今後 Anthropic が足すもの）。指摘と監査自身の理由をそのまま載せるので、新しい種類の指摘もプラグインを直さずに出ます
- このプラグインの観点: 制約の両立（資産の中と、その資産に効く CLAUDE.md・rule との間）、委任の指示、承認と自律の境界、検証と停止の条件、ツール呼び出しの契約、外部の検証への接続、機械で判定できる規則の強制先（hook・permissions・検査 script）の提案
- このプラグインの機械検査（`skills/prompt-design-review/scripts/check.py`）: 参照先の有無、skill の見出しの書式、古い版の記録の残り、資産と、一緒に読み込まれるファイルの決まりの数の推定
- 確信度 低として報告する: 文脈の代わりになっている専門家の役割、境界の構造

報告書は利用者の言語で、このプラグインの中身を知らない人が読める形で書かれます。どの項目にも出どころ（論文、Anthropic の資料、標準の Prompt 診断、このプラグインの検査や判断）を添えるので、利用者が自分で判断できます。

- 表題と結論: 総合判定（要修正／軽微な指摘のみ／指摘なし／確認できた範囲では指摘なし）、報告の限界の注記、同時に当てはまる決まりが多すぎるときの注意、そのまま使うと何が起きるか
- このプラグインの観点: 観点ごとに 1 行で、なぜ守るか、根拠、判定と影響、該当箇所と措置
- Claude Code 標準の Prompt 診断: 診断が出した指摘ごとに 1 行で、診断自身の理由つき。両方が同じ箇所を指摘したときは、番号を 1 つだけ付けます
- 対応の推奨（「使う前に」「余裕があるときに」と、確信度 低の指摘をまとめた「ご判断ください」）、指摘ごとの詳細（原文・問題・差分案・確信度）、変えずに残すべき箇所
- 次のアクション: 番号の選択肢（「使う前に」を反映／それと「余裕があるときに」を反映／選んで反映／ファイルは変えずに反映後の全文を先に見る）と、それぞれで残る指摘の件数。番号で返事をします。「ご判断ください」の指摘は、名指ししたときだけ反映します

同時に当てはまる決まりが多すぎると、一部が守られない可能性が高くなります。資産そのものの機械検査の数が目安を超えたときは、数えた文を 1 つずつ文脈で読み、決まりかどうかと、資産の作業のどの段階で当てはまるか（作業中、確認のとき、反映のときだけ、など）を判断し、一番多く重なる段階の数を出します（このプラグインの判断。言い回しで拾った文から始めるので、実際はもっと多いことがあります。一緒に読み込まれるファイルの分は足しません）。その数が目安を超えたら、注意として、同時に当てはまる決まりが増えるほど全部は守られにくくなること（査読前の Eliav 2026）、それが始まる数はモデルによって違い（同じ研究）、決まりの難しさでも変わると考えられるので（このプラグインの判断）目安の 40 はこのプラグインが決めた値にすぎないこと、段階で数えるのはこのプラグインの推論であることを示し、機械で判定できる決まりを script や hook に移すか、段階を分けることを勧めます。報告には研究の数値を載せません。今の Claude のモデルで試した小さな実験の記録は、背景として [docs/rule-count-experiment.md](docs/rule-count-experiment.md) にあります。それとは別に、一緒に読み込まれる指示ファイルの分で合計が目安を超えるときは、そのファイルと数を挙げる短い注記を出します（段階の判断はしません）。

この見直しは文書を読むだけです。指摘に従って挙動が良くなるかは示せないので、効果を確かめるには挙動の試験が要ります。

## インストール

Claude Code の中で:

```text
/plugin marketplace add Az-llc/prompt-design-review
/plugin install prompt-design-review@az-llc
```

Claude Code 2.1.275 以降では、1 行でも入れられます。

```text
/plugin install prompt-design-review --marketplace Az-llc/prompt-design-review
```

シェルから:

```bash
claude plugin marketplace add Az-llc/prompt-design-review
claude plugin install prompt-design-review@az-llc
```

### 更新

このマーケットプレイスの自動更新は、ほかの第三者のマーケットプレイスと同じく、既定では切れています。新しい版を入れるには、シェルで次を実行します。

```bash
claude plugin update prompt-design-review@az-llc
```

セッションの中では、`/plugin` の **Installed** タブでこのプラグインを開き、**Update now** を選びます。新しい版は次のセッションか、`/reload-plugins` の後に読み込まれます。自動で更新するには、`/plugin` の **Marketplaces** で `az-llc` を選び、**Enable auto-update** を選びます。

## 使い方

プラグインの skill にはプラグイン名の接頭辞が付くので、次のように呼びます。

```text
/prompt-design-review:prompt-design-review <見直す SKILL.md / CLAUDE.md / rule のパス>
```

プロンプト・skill・CLAUDE.md の見直しや監査、作成や編集の後の点検を頼んだときも、Claude がこの skill を使います。

- ファイルを指定すると、そのファイルだけを見ます（その資産に効く CLAUDE.md・rule は、食い違いの確認に読むだけです）。
- フォルダを指定すると、その中の指示ファイルすべてを見ます。
- 指定が無いと、対象を尋ねて止まります。対象を付けてコマンドを呼び直してください。
- 「全部」と頼んだときだけ、プロジェクトと `~/.claude` の指示ファイルを見ます。その会話でまだ了承していなければ、件数を示して了承を求め、止まります。了承したら「全部」を付けてコマンドを呼び直してください。組み込みの監査の費用は、約 0.7〜1.3 USD/ファイル、プロジェクト全体を 1 回で約 1.3〜1.8 USD でした（2026-10、作者の環境での測定。料金とモデルで変わります）。

対象の書き換えは、報告の中から選んだ指摘だけに行います。コマンドで始めた回では編集用のツールを使えません。指摘を適用させるには、報告書の「次のアクション」の番号か、選んだ指摘を普通のメッセージで伝えてください。コマンドを呼び直すと、編集用のツールがまた外れます。適用で文が増えたときは、変更した行の食い違いを確かめ直し、変更後の資産にもう一度組み込みの監査をかけることを提案します。変更を適用した後は、変更したファイルに `skills/prompt-design-review/scripts/check.py --strict` をかけます。

## 前提

- Claude Code 2.1.283 以降（組み込みの監査）。`claude -p` が使えない環境や、GPT・Gemini 向けのプロンプトでは、診断の欄に「実行していない」と書き、代わりに理由のない禁止を見ます。七つの観点はそのまま当てます。
- 組み込みの監査は `skills/prompt-design-review/scripts/run-audit.py` が呼びます。空の一時フォルダから、セーフモード（`--safe-mode`）で、対象のフォルダを `--add-dir` で渡し、読むためのツールだけを渡し（対象を変えられず、コマンドも実行できず、git の履歴も見ません）、Bash ツールの 10 分に収まる時間の上限を付けます。セーフモードでは、あなたの `~/.claude` の CLAUDE.md・rule・skill・プラグインも、作業中のプロジェクトの分も診断に入らないので、あなたの個人的な決まりが判定に混ざりません。その資産に効く CLAUDE.md との食い違いは、代わりにこのプラグインの一つ目の観点が見ます。失敗したときは報告書に平易な言葉でそう書き、確かめられなかった範囲を示します。
- Python 3（標準ライブラリのみ）。

## check.py

```text
python skills/prompt-design-review/scripts/check.py [--warn-rules N] [--root DIR] [--strict] [--no-context] PATH [PATH ...]
python skills/prompt-design-review/scripts/check.py --self-test
```

ここでのパスは、このリポジトリを clone したフォルダからの相対パスです。インストールされたプラグインの写しは版ごとに置き場所が変わるので、hook や CI では、タグかコミットに固定した clone を使うか、check.py を自分のリポジトリに写して使ってください。

ファイルごとに、決まりの推定数（指示の文。英語と日本語の言い回し）と、Claude Code が一緒に読み込む指示ファイルを合わせた数（`rule_load`）、禁止の行数、存在しない参照パスと確かめなかった参照、重複した文（参考情報）、本文中の版コメント、frontmatter（name・description の有無と形）を出します。1 行目が JSON、続きが人間向けの要約です。UTF-8 で読めないファイルは、そのファイルの項目に `error` として出し、残りの検査を続けます。

- 決まりの数は言い回しから推定するので、取りこぼしや数え違いがあります。`rule_load` には、対象のフォルダで始めた会話で Claude Code が最初に読み込むファイルを足します。Claude Code のメモリの資料をこの道具が読み取った範囲で（プロジェクトの根の決め方は推定です）、対象のフォルダとその上のすべてのフォルダの CLAUDE.md・CLAUDE.local.md、プロジェクトの根（`.git` のある最も近いフォルダ）の `.claude/CLAUDE.md` と `paths` のない `.claude/rules/**/*.md`、`~/.claude/CLAUDE.md` と `paths` のない `~/.claude/rules/**/*.md`、組織が配る管理用の CLAUDE.md（あれば）、それに `@path` での取り込み（4 段まで）です。各項目には出どころ（`source`: managed・user・ancestor・project・import）が付き、数えなかったもの（自動メモリ、AGENTS.md、必要なときだけ読み込まれる rule など）は `rule_load.not_counted` に出ます。`--no-context` で外せます（CI や hook では、あなたの端末と中身が違うので外します）。
- 目安（既定 40、`--warn-rules` で変更）は、この道具が決めた値で、研究の値ではありません。Eliav（2026、査読前、arXiv 2607.19257）は、1 回の応答に当てはまる決まりが増えるほど守られにくくなること、それが始まる数がモデルで違うことを示しています。決まりの難しさでも変わるというのは、この道具の判断です（[docs/rule-count-experiment.md](docs/rule-count-experiment.md) を参照）。
- 本文の版コメントは最新版の 1 行まで許し、2 行目から指摘します。
- 終了コード: 0 は実行済み（指摘があっても 0）、`--strict` のときは指摘があれば 1、引数の誤り・存在しないパス・読めない `--root` は 2（1 行目に JSON の `error`、続いて使い方）。`--strict` で 1 にするのは、存在しない参照、版コメントの超過、frontmatter の問題、読めないファイルです。目安の超過と重複した文は警告・参考情報として数えません。
- 終了コードで止める Claude Code の hook は、2 を返したときだけ止まり、Claude に伝わるのは標準エラーです。そのため hook で使うときは `python <check.py の絶対パス> --strict <パス> 1>&2 || exit 2` のように包みます。CI では `--strict` の 1 をそのまま失敗に使えます。
- 引数には任意の .md ファイルかフォルダを渡せます。name・description の検査は、SKILL.md と、frontmatter に name か description を持つファイルに行います。
- プラグインの中（`.claude-plugin/plugin.json` を持つフォルダ）では、パスと LICENSE はプラグインのフォルダまでしかたどりません。リポジトリを基準にするには `--root` を渡します。

## 根拠

各観点の根拠は SKILL.md の本文に、出典を確かめた短い文で書いています。

## ファイル構成

- `.claude-plugin/plugin.json` プラグインの定義
- `.claude-plugin/marketplace.json` このプラグインを載せたマーケットプレイス
- `skills/prompt-design-review/SKILL.md` skill 本体
- `skills/prompt-design-review/scripts/check.py` 機械検査
- `skills/prompt-design-review/scripts/run-audit.py` 組み込みの監査をセーフモードで動かし、1 行の JSON（`status` ok／failed／not_run、`reason`、`result`、`other_denials`、`cost_usd`）を返す。引数の誤りは終了コード 2。`--self-test` は通信しない。実際の実行は、ほかの `claude -p` の呼び出しと同じく課金される
- `skills/prompt-design-review/scripts/fixtures/` 自己検査の見本と期待値（見本は skill として読み込まれず、フォルダの走査にも入らないよう、SKILL.md とも *.md とも名付けていない）
- `docs/rule-count-experiment.md` 背景資料: 今の Claude のモデルが同時に何個の決まりを守れるかを試した小さな実験（報告書では引用しない）
- `CHANGELOG.md` 変更の要約

## 配布元

- この GitHub リポジトリ: https://github.com/Az-llc/prompt-design-review
- 合同会社Az のポータル: https://www.az-llc.com/portal/skills-prompts/

これ以外の場所で入手したものは、内容を確かめてから使ってください。

## 提供元

- 開発・提供: 合同会社Az（https://www.az-llc.com/）
- ライセンス: MIT License（[LICENSE](LICENSE) を参照）
