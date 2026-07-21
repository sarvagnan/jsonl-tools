#!/bin/sh
set -eu

DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
CLI=${JSONL_CLI:-"$DIR/../../../packages/jsonl-cli/bin/jsonl.js"}

if [ -x "$CLI" ]; then
  exec node "$CLI" pretty-record -
fi

exec jsonl pretty-record -
