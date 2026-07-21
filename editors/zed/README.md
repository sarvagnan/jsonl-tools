# JSONL Tools for Zed

JSONL Tools adds JSON Lines (`.jsonl`) and NDJSON (`.ndjson`) support to Zed, with `.ldjson` recognized as an additional common suffix. It uses the JSON tree-sitter grammar for syntax highlighting, bracket matching, indentation, and a basic structural outline with one item per top-level record.

The extension also runs [`jsonl-lsp`](https://www.npmjs.com/package/@sarvagnan/jsonl-lsp) for JSONL diagnostics, document and range formatting, and a record-oriented document outline. If a `jsonl-lsp` executable is available on the worktree's `PATH`, the extension uses it directly. Otherwise, it installs `@sarvagnan/jsonl-lsp` with Zed's npm/Node.js support on first use and keeps the package current.

It also provides hover-based record inspection and expand/compact code actions for JSONL records.

## Install as a development extension

1. Open Zed's Extensions view.
2. Select **Install Dev Extension**.
3. Choose this `editors/zed` directory.

You can also run `zed: install dev extension` from the command palette and select the same directory.

## LSP-powered document outlines

Enable language-server document symbols for record-oriented outline entries:

```json
{ "languages": { "JSONL": { "document_symbols": "on" } } }
```

Without that setting, Zed can use the extension's basic tree-sitter structural outline fallback.

## Formatting

`jsonl-lsp` advertises both `documentFormatting` and `documentRangeFormatting`. Zed's standard `format_on_save` language setting therefore works for JSONL when the language server is active. For example:

```json
{
  "languages": {
    "JSONL": {
      "formatter": "language_server",
      "format_on_save": "on"
    }
  }
}
```

## Server configuration

`jsonl-lsp` accepts initialization options under the `jsonl` key, forwarded
from Zed's standard LSP settings:

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
