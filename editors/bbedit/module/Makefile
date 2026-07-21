MODULE   := JSONL
BUILDDIR := build
BUNDLE   := $(BUILDDIR)/$(MODULE).bblm
BINARY   := $(BUNDLE)/Contents/MacOS/$(MODULE)
INSTALL_DIR := $(HOME)/Library/Application Support/BBEdit/Language Modules

SRCS := src/JSONL.mm src/SDKConstants.mm
HDRS := sdk/BBLMInterface.h sdk/BBLMTextIterator.h

ARCHS    := -arch arm64 -arch x86_64
CXXFLAGS := -std=gnu++17 -O2 -Wall -Wextra -Wno-four-char-constants \
            -fno-objc-arc $(ARCHS) -mmacosx-version-min=11.0 -Isdk
LDFLAGS  := -bundle -framework Foundation -framework CoreServices

all: $(BINARY)

$(BINARY): $(SRCS) $(HDRS) sdk/BBLMInterface.mm Info.plist Makefile
	mkdir -p $(BUNDLE)/Contents/MacOS
	clang++ $(CXXFLAGS) $(LDFLAGS) $(SRCS) -o $(BINARY)
	cp Info.plist $(BUNDLE)/Contents/Info.plist
	codesign --force --sign - $(BUNDLE)

install: $(BINARY)
	mkdir -p "$(INSTALL_DIR)"
	rm -rf "$(INSTALL_DIR)/$(MODULE).bblm"
	cp -R $(BUNDLE) "$(INSTALL_DIR)/"

test: $(BUILDDIR)/harness
	$(BUILDDIR)/harness
	@node ../../../packages/jsonl-cli/bin/jsonl.js format test/fixtures/parity.jsonl > $(BUILDDIR)/parity-cli.out
	@$(BUILDDIR)/harness reformat test/fixtures/parity.jsonl > $(BUILDDIR)/parity-module.out
	@diff $(BUILDDIR)/parity-cli.out $(BUILDDIR)/parity-module.out && echo "ok: reformat parity with jsonl-cli"
	@$(BUILDDIR)/harness titles test/fixtures/summaries.jsonl > $(BUILDDIR)/summaries-module.out
	@sed 's/^[0-9][0-9]* · //' $(BUILDDIR)/summaries-module.out > $(BUILDDIR)/summaries-module-names.out
	@node --input-type=module -e 'import { readFileSync } from "node:fs"; import { summarizeJsonLines } from "../../../packages/jsonl-core/src/index.js"; const text = readFileSync("test/fixtures/summaries.jsonl", "utf8"); for (const summary of summarizeJsonLines(text)) console.log(summary.name);' > $(BUILDDIR)/summaries-jsonl-core-names.out
	@diff $(BUILDDIR)/summaries-module-names.out $(BUILDDIR)/summaries-jsonl-core-names.out && echo "ok: summary parity with jsonl-core"

$(BUILDDIR)/harness: test/harness.mm $(SRCS) $(HDRS) sdk/BBLMInterface.mm Makefile
	mkdir -p $(BUILDDIR)
	clang++ -std=gnu++17 -g -Wall -Wno-four-char-constants -fno-objc-arc \
		-mmacosx-version-min=11.0 -Isdk \
		-framework Foundation -framework CoreServices \
		test/harness.mm $(SRCS) -o $(BUILDDIR)/harness

clean:
	rm -rf $(BUILDDIR)

.PHONY: all install clean test
