# JSONL LSP for Zed

Language-server support for JSON Lines (`.jsonl`) and NDJSON (`.ndjson`) in Zed: per-record diagnostics as you type, document and range formatting, record-oriented document outlines, hover-based record inspection (pretty-printed JSON in a popup), and expand/compact code actions.

This extension runs [`jsonl-lsp`](https://www.npmjs.com/package/@sarvagnan/jsonl-lsp). If a `jsonl-lsp` executable is available on the worktree's `PATH`, the extension uses it directly. Otherwise, it installs `@sarvagnan/jsonl-lsp` with Zed's npm/Node.js support on first use and keeps the package current.

## Requirements

The [JSONL extension](https://zed.dev/extensions/jsonl) must be installed — it provides the "JSON Lines" language (grammar, highlighting, and file associations) that this server attaches to. Zed will suggest it automatically when you open a `.jsonl` file.

## Install as a development extension

1. Open Zed's Extensions view.
2. Select **Install Dev Extension**.
3. Choose this `editors/zed` directory.

You can also run `zed: install dev extension` from the command palette and select the same directory.

## LSP-powered document outlines

Enable language-server document symbols for record-oriented outline entries (one per record, named from its most informative key, with expandable top-level fields):

```json
{ "languages": { "JSON Lines": { "document_symbols": "on" } } }
```

## Record inspection

- **Hover** any record to see it pretty-printed in a popup.
- **Code actions** (`cmd-.` on a record) offer *Expand record into indented JSON* and *Compact record to one line* — expand to read or edit comfortably, then compact back (or undo).

## Formatting

`jsonl-lsp` advertises both `documentFormatting` and `documentRangeFormatting`, so Zed's standard formatter settings work for JSON Lines documents:

```json
{
  "languages": {
    "JSON Lines": {
      "formatter": "language_server",
      "format_on_save": "on"
    }
  }
}
```

If another extension also registers a formatter for JSON Lines, the `formatter` setting above selects which one is used.

## Server configuration

`jsonl-lsp` accepts initialization options under the `jsonl` key, forwarded from Zed's standard LSP settings:

```json
{
  "lsp": {
    "jsonl-lsp": {
      "initialization_options": {
        "jsonl": {
          "allowBlankLines": false,
          "finalNewline": "preserve"
        }
      }
    }
  }
}
```
