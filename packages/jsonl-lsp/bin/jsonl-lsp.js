#!/usr/bin/env node

import process from "node:process";
import { normalizeJsonLines, validateJsonLines } from "@sarva/jsonl-core";

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
    handleMessage(JSON.parse(payload));
  }
}

function handleMessage(message) {
  if (message.method) {
    handleRequestOrNotification(message);
    return;
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
          documentRangeFormattingProvider: true
        },
        serverInfo: {
          name: "jsonl-lsp",
          version: "0.1.0"
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
      const change = params.contentChanges.at(-1);

      if (change && typeof change.text === "string") {
        documents.set(uri, {
          text: change.text,
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
  notify("textDocument/publishDiagnostics", {
    uri,
    version: document.version,
    diagnostics: result.diagnostics.map(toLspDiagnostic)
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

function toLspDiagnostic(diagnostic) {
  const line = diagnostic.line - 1;
  const character = diagnostic.column - 1;

  return {
    range: {
      start: { line, character },
      end: { line, character: character + 1 }
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
