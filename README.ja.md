# prompt-design-review

プロンプト・CLAUDE.md・skill の書き方を点検し、Claude Code 組み込みの監査（`/doctor prompt-audit`）の結果と一つの報告にまとめる Claude Code プラグインです。ソフトウェアの設計レビュー用ではありません。

[English README](README.md)

## 概要

Claude Code 2.1.283 以降には、プロンプト資産の古い書き方を探す組み込みの監査があります。このプラグインはその監査と分担し、組み込みが見ない設計の欠けだけを見ます。

- 組み込みに任せる: 強調語、CoT や足場の指示、古いモデル向けの記述、手順の過剰な指定、理由のない禁止、存在しない参照、誰も確かめていない規則、一件から作った規則
- このプラグインが見る: 制約の両立（資産の中と、その資産に効く CLAUDE.md・rule との間）、委任の指示、承認と自律の境界、検証と停止の条件、ツール呼び出しの契約、外部の検証への接続、機械で判定できる規則の強制先（hook・permissions・検査 script）の提案
- 確度 低として報告する: 文脈の代わりになっている専門家の役割、境界の構造
- 機械で数える: `skills/prompt-design-review/scripts/check.py`

三つの結果を一つの報告にまとめます。指摘ごとに「場所・引用・問題・差分案・確度・出所」を書き、消してはいけない文を「残すもの」として添えます。報告は利用者の言語で書かれます。

この見直しは文書を読むだけの静的な点検です。指摘に従って挙動が良くなるかは示せないので、効果を確かめるには挙動の試験が要ります。

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

対象の書き換えは、報告の中から選んだ指摘だけに行います。コマンドで始めた回では編集用のツールを使えません。指摘を適用させるには、選んだ指摘を普通のメッセージで伝えてください。コマンドを呼び直すと、編集用のツールがまた外れます。適用で文が増えたときは、変更した行の食い違いを確かめ直し、変更後の資産にもう一度組み込みの監査をかけることを提案します。変更を適用した後は、変更したファイルに `skills/prompt-design-review/scripts/check.py --strict` をかけます。

## 前提

- Claude Code 2.1.283 以降（組み込みの監査）。`claude -p` が使えない環境や、GPT・Gemini 向けのプロンプトでは、組み込みの監査の代わりに理由のない禁止と存在しない参照を見ます。七つの観点はそのまま当てます。
- 組み込みの監査は、空の一時フォルダから Bash ツールの前景で 10 分の上限を付けて呼び、`--add-dir` で対象を含む最も狭いフォルダ（ファイルならその親フォルダ）を渡します。作業中のプロジェクトの skill と CLAUDE.md は読み込まれませんが、`~/.claude` の分は読み込まれます。渡したフォルダに `.claude/skills` があると、その skill（この skill を含むことがある）も読み込まれるため、独立は部分的になります。その場合も実行し、報告に書きます。「全部」は 1 回の呼び出しで各パスを並べます。10 分で終わらないとき（打ち切られたとき）と、対象の読み取りが権限で拒否されたときは、「組み込み: 失敗」として代わりの検査に切り替えます。git の履歴を調べるコマンドなど、ほかの操作が拒否されただけなら、その旨を報告に書いて結果を使います。
- Python 3（標準ライブラリのみ）。check.py が無いか動かないときは「機械検査: 未実行」と書いて続けます。
- Git Bash で組み込みの監査を呼ぶときは `MSYS_NO_PATHCONV=1` が要ります。

## check.py

```text
python skills/prompt-design-review/scripts/check.py [--warn-rules N] [--root DIR] [--strict] PATH [PATH ...]
python skills/prompt-design-review/scripts/check.py --self-test
```

ここでのパスは、このリポジトリを clone したフォルダからの相対パスです。インストールされたプラグインの写しは版ごとに置き場所が変わるので、hook や CI では、タグかコミットに固定した clone を使うか、check.py を自分のリポジトリに写して使ってください。

ファイルごとに、指示の行数と禁止の行数（英語と日本語の言い回し）、存在しない参照パス、重複した文（参考情報）、本文中の版コメント、frontmatter（name・description の有無と形）を出します。1 行目が JSON、続きが人間向けの要約です。UTF-8 で読めないファイルは、そのファイルの項目に `error` として出し、残りの検査を続けます。

- 指示の行数は規則数の推定で、規則数そのものではありません。閾値（既定 40、`--warn-rules` で変更）は、研究で全規則の遵守が 0 になった数（80）より手前に余裕を取った警告の目安です。根拠の文は SKILL.md の手順3 にあります。
- 本文の版コメントは最新版の 1 行まで許し、2 行目から指摘します。
- 終了コード: 0 は実行済み（指摘があっても 0）、`--strict` のときは指摘があれば 1、引数の誤り・存在しないパス・読めない `--root` は 2（1 行目に JSON の `error`、続いて使い方）。`--strict` で 1 にするのは、存在しない参照、版コメントの超過、frontmatter の問題、読めないファイルです。指示の行数の超過と重複した文は警告・参考情報として数えません。
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
- `skills/prompt-design-review/scripts/fixtures/` 自己検査の見本と期待値（見本は skill として読み込まれず、フォルダの走査にも入らないよう、SKILL.md とも *.md とも名付けていない）
- `CHANGELOG.md` 変更の要約

## 配布元

- この GitHub リポジトリ: https://github.com/Az-llc/prompt-design-review
- 合同会社Az のポータル: https://www.az-llc.com/portal/skills-prompts/

これ以外の場所で入手したものは、内容を確かめてから使ってください。

## 提供元

- 開発・提供: 合同会社Az（https://www.az-llc.com/）
- ライセンス: MIT License（[LICENSE](LICENSE) を参照）
