# BBEdit Integration

Full JSON Lines support in BBEdit has three parts. The compiled language
module is the core; the LSP server and text filters are optional extras.

## 1. Compiled language module (syntax coloring, function menu, reformat)

Build and install the native module (requires Xcode command line tools):

```bash
cd editors/bbedit/module
make test      # out-of-process tests against a fake BBEdit callback block
make install   # builds universal .bblm, ad-hoc signs, installs to
               # ~/Library/Application Support/BBEdit/Language Modules
```

Relaunch BBEdit to load it. You get:

- A **JSON Lines** language, applied automatically to `.jsonl`, `.ndjson`,
  and `.ldjson` files, and guessed for extensionless JSONL content.
- **Syntax coloring** with per-line error recovery: object keys, string
  values, numbers, `true`/`false`/`null`, and syntax errors (bad tokens,
  unterminated strings, malformed numbers) each get their own run kind.
  A broken record never bleeds color into the lines after it.
- A **function menu** entry per record: line number plus a summary drawn
  from the record's most informative top-level key (`name`, `title`,
  `type`, `event`, …), with invalid records flagged.
- **Text ▸ Reformat Document** normalizes every valid record to the same
  fully compact form `jsonl format` produces (key order and number
  lexemes preserved); invalid and blank lines pass through untouched.
  Reformatting a selection works too. One deliberate difference from the
  CLI: the module preserves each line's existing ending (CR/CRLF/LF)
  rather than rewriting it, so byte-for-byte parity with `jsonl format`
  holds for LF documents.

The module declares the same capability set as BBEdit's built-in JSON
language (coloring, function scanning, reformat, word lookup, language
guessing, language-server info).

## 2. Language server (live diagnostics)

The module's Info.plist tells BBEdit to use `jsonl-lsp` for JSON Lines
documents. Put it on `PATH` with:

```bash
(cd packages/jsonl-cli && npm link)
(cd packages/jsonl-lsp && npm link)
```

BBEdit starts the server automatically when a JSON Lines document opens;
parse errors appear in the text view's gutter as you type.

## 3. Text filters

Install with:

```bash
./editors/bbedit/install-filters.sh
```

This generates wrappers in `~/Library/Application Support/BBEdit/Text
Filters` for:

- `Validate JSONL.sh`
- `Normalize JSONL.sh`
- `Pretty Print JSONL Record.sh` — expands one selected record into
  indented JSON for inspection (⌘Z collapses it back)

Don't copy the scripts by hand: BBEdit runs filters with a minimal `PATH`
that lacks `node`, and the scripts locate the repository CLI relative to
their own location. The generated wrappers fix both, and delegate into the
repository so installed filters always track the current code.
