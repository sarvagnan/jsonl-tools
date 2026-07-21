# jsonl-tools

## Why this exists

LLM agents and web tools emit JSON Lines everywhere — transcripts, logs,
tool output, eval results — but none of the editors I use supported the
format as such: at best a `.jsonl` file gets mis-highlighted as JSON and
flagged as one big syntax error. I especially wanted proper support in
BBEdit, which is what I reach for to preview files. So: JSON Lines /
NDJSON tooling built from a shared parsing core — a CLI, a Language
Server Protocol server, and editor integrations that consume them.
BBEdit is the first integration (a native compiled language module);
the packages themselves are editor-neutral.

Layout:

- `packages/jsonl-core` (`@sarva/jsonl-core`): line-by-line JSONL parsing,
  validation diagnostics, and normalization
- `packages/jsonl-cli` (`@sarva/jsonl-cli`): command-line validation and
  formatting; installs the `jsonl` binary
- `packages/jsonl-lsp` (`@sarva/jsonl-lsp`): stdio LSP server for
  diagnostics and formatting, usable from any LSP-capable editor
  (BBEdit, Neovim, Helix, Zed, Emacs, …); installs the `jsonl-lsp` binary
- `editors/bbedit`: BBEdit integration — compiled language module (syntax
  coloring, function menu with per-record summaries, Reformat Document,
  language guessing, LSP hookup) built against the official Bare Bones
  Language Module SDK, plus text filters

The packages are npm workspaces; run `npm install` once at the root.

## CLI

```bash
jsonl validate file.jsonl
jsonl format file.jsonl
jsonl format --check file.jsonl
jsonl normalize < input.jsonl > output.jsonl
jsonl pretty-record < selected-record.jsonl
```

During local development, run through Node directly:

```bash
node packages/jsonl-cli/bin/jsonl.js validate file.jsonl
```

By default, blank physical lines are invalid. Pass `--allow-blank-lines` to tolerate and skip them during normalization.

`format` prints normalized JSONL to stdout and does not modify files. `format --check` exits non-zero when input is invalid or not already normalized.

`pretty-record` expects exactly one selected JSONL record and prints expanded JSON for inspection.

## Core API

```js
import {
  normalizeJsonLines,
  parseJsonLines,
  validateJsonLines
} from "@sarva/jsonl-core";
```

Diagnostics are reported with one-based `line` and `column` fields suitable for editor display.

## LSP

```bash
jsonl-lsp --stdio
```

Initial capabilities:

- `textDocument/publishDiagnostics`
- `textDocument/formatting`
- `textDocument/rangeFormatting`

The server accepts initialization options under `jsonl`:

```json
{
  "jsonl": {
    "allowBlankLines": false,
    "finalNewline": "preserve"
  }
}
```

## BBEdit

```bash
cd editors/bbedit/module && make test && make install   # native language module
(cd packages/jsonl-cli && npm link)                     # jsonl on PATH
(cd packages/jsonl-lsp && npm link)                     # jsonl-lsp on PATH
```

Relaunch BBEdit and open any `.jsonl` file. See
[docs/bbedit-install.md](docs/bbedit-install.md) for details, including the
text filters.

## Tests

```bash
npm test              # workspace packages + editor filter scripts
npm run test:module   # compiled module: harness + reformat parity with the CLI
```
