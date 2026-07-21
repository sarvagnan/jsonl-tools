#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import process from "node:process";
import {
  FINAL_NEWLINE_POLICIES,
  formatJsonRecord,
  normalizeJsonLines,
  validateJsonLines
} from "@sarva/jsonl-core";

const USAGE = `Usage:
  jsonl validate [--allow-blank-lines] [file ...]
  jsonl format [--check] [--allow-blank-lines] [--final-newline preserve|always|never] file
  jsonl normalize [--allow-blank-lines] [--final-newline preserve|always|never] [file]
  jsonl pretty-record [--indent spaces] [file]

Commands:
  validate   Validate JSONL / NDJSON input.
  format     Print normalized JSONL to stdout, or check whether input is normalized.
  normalize  Normalize JSONL from stdin or a file to stdout.
  pretty-record
             Pretty print one selected JSONL record.
`;

async function main(argv) {
  const [command, ...rest] = argv;

  if (!command || command === "--help" || command === "-h") {
    process.stdout.write(USAGE);
    return 0;
  }

  if (command === "validate") {
    return validateCommand(rest);
  }

  if (command === "format") {
    return formatCommand(rest);
  }

  if (command === "normalize") {
    return normalizeCommand(rest);
  }

  if (command === "pretty-record") {
    return prettyRecordCommand(rest);
  }

  writeUsageError(`Unknown command: ${command}`);
  return 2;
}

async function validateCommand(args) {
  const parsed = parseCommonArgs(args, { allowCheck: false });

  if (parsed.error) {
    writeUsageError(parsed.error);
    return 2;
  }

  const inputs = parsed.files.length > 0 ? parsed.files : ["-"];
  let ok = true;

  for (const file of inputs) {
    const text = await readInput(file);
    const result = validateJsonLines(text, parsed.options);

    if (!result.ok) {
      ok = false;
      writeDiagnostics(file, result.diagnostics);
    }
  }

  return ok ? 0 : 1;
}

async function formatCommand(args) {
  const parsed = parseCommonArgs(args, { allowCheck: true });

  if (parsed.error) {
    writeUsageError(parsed.error);
    return 2;
  }

  if (parsed.files.length !== 1) {
    writeUsageError("format expects exactly one file");
    return 2;
  }

  const file = parsed.files[0];
  const text = await readInput(file);
  const result = normalizeJsonLines(text, parsed.options);

  if (!result.ok) {
    writeDiagnostics(file, result.diagnostics);
    return 1;
  }

  if (parsed.check) {
    if (result.output !== text) {
      process.stderr.write(`${displayName(file)} is not normalized\n`);
      return 1;
    }

    return 0;
  }

  process.stdout.write(result.output);
  return 0;
}

async function normalizeCommand(args) {
  const parsed = parseCommonArgs(args, { allowCheck: false });

  if (parsed.error) {
    writeUsageError(parsed.error);
    return 2;
  }

  if (parsed.files.length > 1) {
    writeUsageError("normalize expects at most one file");
    return 2;
  }

  const file = parsed.files[0] ?? "-";
  const text = await readInput(file);
  const result = normalizeJsonLines(text, parsed.options);

  if (!result.ok) {
    writeDiagnostics(file, result.diagnostics);
    return 1;
  }

  process.stdout.write(result.output);
  return 0;
}

async function prettyRecordCommand(args) {
  const parsed = parsePrettyRecordArgs(args);

  if (parsed.error) {
    writeUsageError(parsed.error);
    return 2;
  }

  const file = parsed.files[0] ?? "-";
  const text = await readInput(file);
  const result = formatJsonRecord(text, { indent: parsed.indent });

  if (!result.ok) {
    writeDiagnostics(file, result.diagnostics);
    return 1;
  }

  process.stdout.write(result.output);
  return 0;
}

function parseCommonArgs(args, { allowCheck }) {
  const options = {};
  const files = [];
  let check = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--allow-blank-lines") {
      options.allowBlankLines = true;
      continue;
    }

    if (arg === "--check") {
      if (!allowCheck) {
        return { error: "--check is only supported by format" };
      }

      check = true;
      continue;
    }

    if (arg === "--final-newline") {
      const value = args[index + 1];

      if (!FINAL_NEWLINE_POLICIES.has(value)) {
        return { error: "--final-newline expects preserve, always, or never" };
      }

      options.finalNewline = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--final-newline=")) {
      const value = arg.slice("--final-newline=".length);

      if (!FINAL_NEWLINE_POLICIES.has(value)) {
        return { error: "--final-newline expects preserve, always, or never" };
      }

      options.finalNewline = value;
      continue;
    }

    if (arg.startsWith("-") && arg !== "-") {
      return { error: `Unknown option: ${arg}` };
    }

    files.push(arg);
  }

  return {
    options,
    files,
    check
  };
}

function parseIndent(raw) {
  if (!/^\d+$/.test(raw ?? "")) {
    return null;
  }

  const value = Number.parseInt(raw, 10);

  return value >= 0 && value <= 16 ? value : null;
}

function parsePrettyRecordArgs(args) {
  const files = [];
  let indent = 2;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--indent") {
      const value = parseIndent(args[index + 1]);

      if (value === null) {
        return { error: "--indent expects an integer from 0 to 16" };
      }

      indent = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--indent=")) {
      const value = parseIndent(arg.slice("--indent=".length));

      if (value === null) {
        return { error: "--indent expects an integer from 0 to 16" };
      }

      indent = value;
      continue;
    }

    if (arg.startsWith("-") && arg !== "-") {
      return { error: `Unknown option: ${arg}` };
    }

    files.push(arg);
  }

  if (files.length > 1) {
    return { error: "pretty-record expects at most one file" };
  }

  return { files, indent };
}

async function readInput(file) {
  if (file === "-") {
    process.stdin.setEncoding("utf8");
    return readAllStdin();
  }

  return readFile(file, "utf8");
}

async function readAllStdin() {
  let data = "";

  for await (const chunk of process.stdin) {
    data += chunk;
  }

  return data;
}

function writeDiagnostics(file, diagnostics) {
  for (const diagnostic of diagnostics) {
    process.stderr.write(
      `${displayName(file)}:${diagnostic.line}:${diagnostic.column}: ${diagnostic.severity}: ${diagnostic.message}\n`
    );
  }
}

function writeUsageError(message) {
  process.stderr.write(`${message}\n\n${USAGE}`);
}

function displayName(file) {
  return file === "-" ? "<stdin>" : file;
}

//	exit quietly when a downstream pipe closes early (e.g. `jsonl ... | head`)
process.stdout.on("error", (error) => {
  if (error.code === "EPIPE") {
    process.exit(0);
  }

  throw error;
});

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
  }
);
