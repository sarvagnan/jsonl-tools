#!/usr/bin/env node

import process from "node:process";
import {
  normalizeJsonLines,
  renderJsonValue,
  summarizeJsonLines,
  validateJsonLines
} from "@sarvagnan/jsonl-core";

const documents = new Map();
let settings = {
  allowBlankLines: false,
  finalNewline: "preserve"
};
let buffer = Buffer.alloc(0);
let shuttingDown = false;

process.stdin.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  readMessages();
});

function readMessages() {
  while (true) {
    const headerEnd = buffer.indexOf("\r\n\r\n");

    if (headerEnd === -1) {
      return;
    }

    const header = buffer.subarray(0, headerEnd).toString("ascii");
    const match = /Content-Length:\s*(\d+)/i.exec(header);

    if (!match) {
      buffer = buffer.subarray(headerEnd + 4);
      continue;
    }

    const contentLength = Number(match[1]);
    const messageStart = headerEnd + 4;
    const messageEnd = messageStart + contentLength;

    if (buffer.length < messageEnd) {
      return;
    }

    const payload = buffer.subarray(messageStart, messageEnd).toString("utf8");
    buffer = buffer.subarray(messageEnd);

    let message;

    try {
      message = JSON.parse(payload);
    } catch {
      respondError(null, -32700, "Parse error");
      continue;
    }

    handleMessage(message);
  }
}

function handleMessage(message) {
  if (message === null || typeof message !== "object" || Array.isArray(message)) {
    respondError(null, -32600, "Invalid Request");
    return;
  }

  if (typeof message.method === "string") {
    handleRequestOrNotification(message);
    return;
  }

  if (message.id !== undefined && !("result" in message) && !("error" in message)) {
    respondError(message.id, -32600, "Invalid Request");
  }
}

function handleRequestOrNotification(message) {
  const { id, method, params } = message;

  try {
    if (method === "initialize") {
      settings = {
        ...settings,
        ...(params?.initializationOptions?.jsonl ?? {})
      };

      respond(id, {
        capabilities: {
          textDocumentSync: 1,
          documentFormattingProvider: true,
          documentRangeFormattingProvider: true,
          documentSymbolProvider: true,
          hoverProvider: true,
          codeActionProvider: true
        },
        serverInfo: {
          name: "jsonl-lsp",
          version: "0.2.0"
        }
      });
      return;
    }

    if (method === "shutdown") {
      shuttingDown = true;
      respond(id, null);
      return;
    }

    if (method === "exit") {
      process.exit(shuttingDown ? 0 : 1);
    }

    if (method === "textDocument/didOpen") {
      const document = params.textDocument;
      documents.set(document.uri, {
        text: document.text,
        version: document.version ?? null
      });
      publishDiagnostics(document.uri);
      return;
    }

    if (method === "textDocument/didChange") {
      const uri = params.textDocument.uri;
      const document = documents.get(uri);
      let text = document?.text ?? "";
      let applied = false;

      //	the server advertises full sync, but apply ranged deltas correctly
      //	anyway rather than clobbering the document with the delta text
      for (const change of params.contentChanges ?? []) {
        if (!change || typeof change.text !== "string") {
          continue;
        }

        if (change.range) {
          const start = offsetAt(text, change.range.start);
          const end = offsetAt(text, change.range.end);
          text = text.slice(0, start) + change.text + text.slice(end);
        } else {
          text = change.text;
        }

        applied = true;
      }

      if (applied) {
        documents.set(uri, {
          text,
          version: params.textDocument.version ?? null
        });
        publishDiagnostics(uri);
      }

      return;
    }

    if (method === "textDocument/didClose") {
      const uri = params.textDocument.uri;
      documents.delete(uri);
      notify("textDocument/publishDiagnostics", { uri, diagnostics: [] });
      return;
    }

    if (method === "textDocument/formatting") {
      respond(id, formatDocument(params.textDocument.uri));
      return;
    }

    if (method === "textDocument/rangeFormatting") {
      respond(id, formatRange(params.textDocument.uri, params.range));
      return;
    }

    if (method === "textDocument/documentSymbol") {
      respond(id, documentSymbols(params.textDocument.uri));
      return;
    }

    if (method === "textDocument/hover") {
      respond(id, hoverAt(params.textDocument.uri, params.position));
      return;
    }

    if (method === "textDocument/codeAction") {
      respond(id, codeActionsFor(params.textDocument.uri, params.range));
      return;
    }

    if (id !== undefined) {
      respondError(id, -32601, `Method not found: ${method}`);
    }
  } catch (error) {
    if (id !== undefined) {
      respondError(id, -32603, error.message);
    }
  }
}

function publishDiagnostics(uri) {
  const document = documents.get(uri);

  if (!document) {
    return;
  }

  const result = validateJsonLines(document.text, settings);
  const lines = document.text.split(/\r\n|\r|\n/);

  notify("textDocument/publishDiagnostics", {
    uri,
    version: document.version,
    diagnostics: result.diagnostics.map((diagnostic) => toLspDiagnostic(diagnostic, lines))
  });
}

function formatDocument(uri) {
  const document = documents.get(uri);

  if (!document) {
    return [];
  }

  const result = normalizeJsonLines(document.text, settings);

  if (!result.ok || result.output === document.text) {
    return [];
  }

  return [
    {
      range: fullDocumentRange(document.text),
      newText: result.output
    }
  ];
}

function formatRange(uri, range) {
  const document = documents.get(uri);

  if (!document) {
    return [];
  }

  const start = offsetAt(document.text, range.start);
  const end = offsetAt(document.text, range.end);
  const selectedText = document.text.slice(start, end);
  const result = normalizeJsonLines(selectedText, {
    ...settings,
    finalNewline: "preserve"
  });

  if (!result.ok || result.output === selectedText) {
    return [];
  }

  return [
    {
      range,
      newText: result.output
    }
  ];
}

function documentSymbols(uri) {
  const document = documents.get(uri);

  if (!document) {
    return [];
  }

  return summarizeJsonLines(document.text, settings).map((summary) => {
    const range = {
      start: positionAt(document.text, summary.startOffset),
      end: positionAt(document.text, summary.endOffset)
    };
    const symbol = {
      name: summary.name,
      kind: summary.valid ? symbolKind(summary.valueKind) : 21,
      range,
      selectionRange: range
    };

    if (summary.valid && summary.valueKind === "object") {
      symbol.children = summary.members.map((member) => ({
        name: member.key,
        kind: symbolKind(member.valueKind),
        range: {
          start: positionAt(document.text, member.keyStart),
          end: positionAt(document.text, member.valueEnd)
        },
        selectionRange: {
          start: positionAt(document.text, member.keyStart),
          end: positionAt(document.text, member.keyEnd)
        }
      }));
    }

    return symbol;
  });
}

function hoverAt(uri, position) {
  const document = documents.get(uri);

  if (!document) {
    return null;
  }

  const line = physicalLineAt(document.text, position.line);

  if (!line || /^[ \t]*$/.test(line.text)) {
    return null;
  }

  const result = renderJsonValue(line.text, { indent: 2 });

  if (!result.ok) {
    return null;
  }

  const { pretty, notice } = truncateHoverValue(result.output, 50000);

  return {
    contents: {
      kind: "markdown",
      value: `\`\`\`json\n${pretty}\n\`\`\`${notice}`
    },
    range: line.range
  };
}

function codeActionsFor(uri, range) {
  const document = documents.get(uri);

  if (!document) {
    return [];
  }

  const line = physicalLineAt(document.text, range.start.line);

  if (!line) {
    return [];
  }

  const actions = [];
  const expanded = renderJsonValue(line.text, { indent: 2 });

  if (expanded.ok && expanded.output !== line.text) {
    actions.push(rewriteAction(
      uri,
      "Expand record into indented JSON",
      line.range,
      expanded.output
    ));
  }

  const emptySelection = range.start.line === range.end.line &&
    range.start.character === range.end.character;
  const selectionRange = emptySelection ? line.range : range;
  const selectionStart = offsetAt(document.text, selectionRange.start);
  const selectionEnd = offsetAt(document.text, selectionRange.end);
  const selectedText = document.text.slice(selectionStart, selectionEnd);
  const compacted = renderJsonValue(selectedText, { indent: 0 });

  if (compacted.ok && compacted.output !== selectedText) {
    actions.push(rewriteAction(
      uri,
      "Compact record to one line",
      selectionRange,
      compacted.output
    ));
  }

  return actions;
}

function physicalLineAt(text, lineNumber) {
  const lines = text.split(/\r\n|\r|\n/);

  if (lineNumber < 0 || lineNumber >= lines.length) {
    return null;
  }

  return {
    text: lines[lineNumber],
    range: {
      start: { line: lineNumber, character: 0 },
      end: { line: lineNumber, character: lines[lineNumber].length }
    }
  };
}

function rewriteAction(uri, title, range, newText) {
  return {
    title,
    kind: "refactor.rewrite",
    edit: {
      changes: {
        [uri]: [
          { range, newText }
        ]
      }
    }
  };
}

function truncateHoverValue(value, limit) {
  if (value.length <= limit) {
    return { pretty: value, notice: "" };
  }

  const keptLines = [];
  let length = 0;

  for (const line of value.split("\n")) {
    const addedLength = line.length + (keptLines.length > 0 ? 1 : 0);

    if (length + addedLength > limit) {
      break;
    }

    keptLines.push(line);
    length += addedLength;
  }

  return {
    pretty: keptLines.join("\n"),
    notice: "\n\n… truncated"
  };
}

function symbolKind(valueKind) {
  return {
    object: 19,
    array: 18,
    string: 15,
    number: 16,
    boolean: 17,
    null: 21
  }[valueKind];
}

function toLspDiagnostic(diagnostic, lines) {
  const line = diagnostic.line - 1;
  const lineLength = lines[line]?.length ?? 0;
  const character = Math.min(diagnostic.column - 1, lineLength);
  const endCharacter = Math.min(character + 1, lineLength);

  return {
    range: {
      start: { line, character },
      end: { line, character: Math.max(endCharacter, character) }
    },
    severity: 1,
    source: "jsonl",
    message: diagnostic.message
  };
}

function fullDocumentRange(text) {
  const lines = text.split(/\r\n|\r|\n/);
  const lastLine = Math.max(lines.length - 1, 0);

  return {
    start: { line: 0, character: 0 },
    end: {
      line: lastLine,
      character: lines[lastLine]?.length ?? 0
    }
  };
}

function offsetAt(text, position) {
  let line = 0;
  let character = 0;

  for (let index = 0; index < text.length; index += 1) {
    if (line === position.line && character === position.character) {
      return index;
    }

    const char = text[index];

    if (char === "\r") {
      if (text[index + 1] === "\n") {
        index += 1;
      }

      line += 1;
      character = 0;
      continue;
    }

    if (char === "\n") {
      line += 1;
      character = 0;
      continue;
    }

    character += 1;
  }

  return text.length;
}

function positionAt(text, offset) {
  const target = Math.max(0, Math.min(offset, text.length));
  let line = 0;
  let character = 0;

  for (let index = 0; index < target; index += 1) {
    const char = text[index];

    if (char === "\r") {
      if (text[index + 1] === "\n" && index + 1 < target) {
        index += 1;
      }

      line += 1;
      character = 0;
      continue;
    }

    if (char === "\n") {
      line += 1;
      character = 0;
      continue;
    }

    character += 1;
  }

  return { line, character };
}

function respond(id, result) {
  writeMessage({
    jsonrpc: "2.0",
    id,
    result
  });
}

function respondError(id, code, message) {
  writeMessage({
    jsonrpc: "2.0",
    id,
    error: { code, message }
  });
}

function notify(method, params) {
  writeMessage({
    jsonrpc: "2.0",
    method,
    params
  });
}

function writeMessage(message) {
  const payload = JSON.stringify(message);
  process.stdout.write(`Content-Length: ${Buffer.byteLength(payload, "utf8")}\r\n\r\n${payload}`);
}
