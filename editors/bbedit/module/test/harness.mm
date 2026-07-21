//
//	harness.mm - out-of-process test rig for the JSONL language module.
//
//	Fakes BBEdit's callback block, drives the module entry point with the
//	same messages BBEdit sends, and asserts on the results. Run with no
//	arguments for the unit tests, `harness reformat <file>` to print the
//	module's document reformat of a file, or `harness titles <file>` to print
//	its function-menu titles (for diffing against jsonl-core).
//

#include <objc/objc.h>

#define __ASSERT_MACROS_DEFINE_VERSIONS_WITHOUT_UNDERSCORES 1
#include <AssertMacros.h>

#import <Foundation/Foundation.h>
#include <CoreServices/CoreServices.h>

#include <vector>
#include <string>
#include <cstdio>
#include <cstdlib>

#include "BBLMInterface.h"

extern "C" OSErr JSONLMachO(BBLMParamBlock &params, const BBLMCallbackBlock &bblmCallbacks);

#define CHECK(cond, ...)											\
	do {															\
		if (! (cond))												\
		{															\
			fprintf(stderr, "FAIL %s:%d: ", __FILE__, __LINE__);	\
			fprintf(stderr, __VA_ARGS__);							\
			fprintf(stderr, "\n");									\
			exit(1);												\
		}															\
	} while (0)

#pragma mark - Fake callback state

struct FakeRun
{
	NSString	*kind;
	SInt32		start;
	SInt32		length;
};

static std::vector<FakeRun>			sRuns;
static std::vector<NSString *>		sTokens;
static std::vector<BBLMProcInfo>	sFunctions;

static OSErr FakeResetTokenBuffer(void *)		{ sTokens.clear(); return noErr; }
static OSErr FakeResetProcList(void *)			{ sFunctions.clear(); return noErr; }

static OSErr FakeAddTokenToBuffer(void *, const UniChar *token, const UInt32 length, UInt32 *offset)
{
	*offset = (UInt32)sTokens.size();
	sTokens.push_back([[NSString alloc] initWithCharacters: token length: length]);
	return noErr;
}

static OSErr FakeAddCFStringTokenToBuffer(void *, CFStringRef string, UInt32 *offset)
{
	*offset = (UInt32)sTokens.size();
	sTokens.push_back([(NSString *)string copy]);
	return noErr;
}

static OSErr FakeAddFunctionToList(void *, BBLMProcInfo &info, UInt32 *index)
{
	*index = (UInt32)sFunctions.size();
	sFunctions.push_back(info);
	return noErr;
}

static OSErr FakeGetFunctionEntry(void *, UInt32 index, BBLMProcInfo &info)
{
	if (index >= sFunctions.size())
		return paramErr;
	info = sFunctions[index];
	return noErr;
}

static OSErr FakeUpdateFunctionEntry(void *, UInt32 index, BBLMProcInfo &info)
{
	if (index >= sFunctions.size())
		return paramErr;
	sFunctions[index] = info;
	return noErr;
}

static SInt32 FakeRunCount(void)	{ return (SInt32)sRuns.size(); }

static Boolean FakeGetRun(SInt32 index, DescType &language, NSString *&kind,
							SInt32 &charPos, SInt32 &length)
{
	if ((index < 0) || (index >= (SInt32)sRuns.size()))
		return false;

	language = 'JsnL';
	kind = sRuns[index].kind;
	charPos = sRuns[index].start;
	length = sRuns[index].length;
	return true;
}

static SInt32 FakeFindRun(SInt32 offset)
{
	for (size_t i = 0; i < sRuns.size(); i++)
	{
		if ((offset >= sRuns[i].start) && (offset < (sRuns[i].start + sRuns[i].length)))
			return (SInt32)i;
	}

	return -1;
}

static Boolean FakeAddRun(DescType, NSString *kind, SInt32 startPos, SInt32 length, bool)
{
	FakeRun	run = { kind, startPos, length };
	sRuns.push_back(run);
	return true;
}

static void FakeFlushRuns(void)	{ /* nothing buffered */ }

static OSErr FakeAddFoldRange(SInt32, SInt32, BBLMFoldKind)	{ return noErr; }

static BBLMCallbackBlock MakeCallbacks(void)
{
	BBLMCallbackBlock	callbacks;

	memset(&callbacks, 0, sizeof(callbacks));

	callbacks.fSignature = kBBLMParamBlockSignature;
	callbacks.fVersion = kBBLMCurrentCallbackVersion;
	callbacks.fResetTokenBuffer = FakeResetTokenBuffer;
	callbacks.fResetProcList = FakeResetProcList;
	callbacks.fAddTokenToBuffer = FakeAddTokenToBuffer;
	callbacks.fAddCFStringTokenToBuffer = FakeAddCFStringTokenToBuffer;
	callbacks.fAddFunctionToList = FakeAddFunctionToList;
	callbacks.fGetFunctionEntry = FakeGetFunctionEntry;
	callbacks.fUpdateFunctionEntry = FakeUpdateFunctionEntry;
	callbacks.fRunCount = FakeRunCount;
	callbacks.fGetRun = FakeGetRun;
	callbacks.fFindRun = FakeFindRun;
	callbacks.fAddRun = FakeAddRun;
	callbacks.fFlushRuns = FakeFlushRuns;
	callbacks.fAddFoldRange = FakeAddFoldRange;

	return callbacks;
}

#pragma mark - Param block setup

static std::vector<UniChar> ToUTF16(NSString *text)
{
	std::vector<UniChar>	chars([text length]);

	if ([text length] > 0)
		[text getCharacters: chars.data() range: NSMakeRange(0, [text length])];

	return chars;
}

static BBLMParamBlock MakeParams(std::vector<UniChar> &text, const UInt8 message)
{
	BBLMParamBlock	params;

	memset(&params, 0, sizeof(params));

	params.fSignature = kBBLMParamBlockSignature;
	params.fVersion = kBBLMParamBlockVersion;
	params.fLength = sizeof(params);
	params.fMessage = message;
	params.fLanguage = 'JsnL';
	params.fText = text.data();
	params.fTextLength = (UInt32)text.size();
	params.fTextGapLocation = 0;
	params.fTextGapLength = 0;

	//	the SDK's inline helpers reject NULL buffer/list pointers; the fake
	//	callbacks never dereference these
	params.fFcnParams.fTokenBuffer = (void *)&sTokens;
	params.fFcnParams.fFcnList = (void *)&sFunctions;

	return params;
}

#pragma mark - Tests

static NSString *RunKindAt(const SInt32 offset)
{
	const SInt32	index = FakeFindRun(offset);

	return (index >= 0) ? sRuns[index].kind : nil;
}

static void TestCalculateRuns(const BBLMCallbackBlock &callbacks)
{
	NSString	*source =
		@"{\"type\": \"assistant\", \"id\": 42, \"ok\": true}\n"		//	line 1
		 "{\"name\": \"he \\\"llo\\\"\", \"n\": -1.5e+3, \"v\": null}\n"	//	line 2
		 "nonsense @@ {\"x\": 00}\n"									//	line 3: junk + bad number
		 "{\"unterminated\": \"oops\n"									//	line 4: unterminated string
		 "{\"after\": \"fine\"}\n";										//	line 5: must recover

	std::vector<UniChar>	text = ToUTF16(source);
	BBLMParamBlock			params = MakeParams(text, kBBLMCalculateRunsMessage);

	sRuns.clear();
	params.fCalcRunParams.fStartOffset = 0;

	CHECK(noErr == JSONLMachO(params, callbacks), "CalculateRuns returned an error");
	CHECK(! sRuns.empty(), "no runs generated");

	//	runs must tile the text exactly: contiguous, no overlap, full coverage
	SInt32	expected = 0;

	for (const FakeRun &run : sRuns)
	{
		CHECK(run.start == expected, "run gap/overlap at %d (expected %d)", run.start, expected);
		CHECK(run.length > 0, "empty run at %d", run.start);
		expected = run.start + run.length;
	}

	CHECK(expected == (SInt32)text.size(), "runs do not cover text (%d of %zu)", expected, text.size());

	//	runs never span a line break
	for (const FakeRun &run : sRuns)
	{
		for (SInt32 i = run.start; i < (run.start + run.length - 1); i++)
		{
			const UniChar	c = text[i];

			CHECK(! (('\r' == c) || ('\n' == c)),
					"run [%d,%d) continues past a line break", run.start, run.start + run.length);
		}
	}

	NSUInteger	offset;

	//	line 1: "type" is a key, "assistant" a value, 42 a number, true a keyword
	offset = [source rangeOfString: @"\"type\""].location;
	CHECK([RunKindAt((SInt32)offset) isEqualToString: kBBLMKeywordArgumentNameRunKind], "key not colored as key");
	offset = [source rangeOfString: @"\"assistant\""].location;
	CHECK([RunKindAt((SInt32)offset) isEqualToString: kBBLMDoubleQuotedStringRunKind], "string value not colored");
	offset = [source rangeOfString: @"42"].location;
	CHECK([RunKindAt((SInt32)offset) isEqualToString: kBBLMNumberRunKind], "number not colored");
	offset = [source rangeOfString: @"true"].location;
	CHECK([RunKindAt((SInt32)offset) isEqualToString: kBBLMKeywordRunKind], "true not colored as keyword");

	//	line 2: escaped quotes stay inside the string; -1.5e+3 is one number; null keyword
	offset = [source rangeOfString: @"llo"].location;
	CHECK([RunKindAt((SInt32)offset) isEqualToString: kBBLMDoubleQuotedStringRunKind], "escape broke string run");
	offset = [source rangeOfString: @"-1.5e+3"].location;
	{
		const SInt32	index = FakeFindRun((SInt32)offset);

		CHECK([sRuns[index].kind isEqualToString: kBBLMNumberRunKind], "signed exponent number not colored");
		CHECK(7 == sRuns[index].length, "number lexeme split (length %d)", sRuns[index].length);
	}
	offset = [source rangeOfString: @"null"].location;
	CHECK([RunKindAt((SInt32)offset) isEqualToString: kBBLMKeywordRunKind], "null not colored as keyword");

	//	line 3: bare word, junk characters, and 00 are all errors
	offset = [source rangeOfString: @"nonsense"].location;
	CHECK([RunKindAt((SInt32)offset) isEqualToString: kBBLMSyntaxErrorRunKind], "bare word not an error");
	offset = [source rangeOfString: @"@@"].location;
	CHECK([RunKindAt((SInt32)offset) isEqualToString: kBBLMSyntaxErrorRunKind], "junk chars not an error");
	offset = [source rangeOfString: @"00"].location;
	CHECK([RunKindAt((SInt32)offset) isEqualToString: kBBLMSyntaxErrorRunKind], "leading-zero number not an error");

	//	line 4: unterminated string is an error...
	offset = [source rangeOfString: @"\"oops"].location;
	CHECK([RunKindAt((SInt32)offset) isEqualToString: kBBLMSyntaxErrorRunKind], "unterminated string not an error");

	//	...and line 5 recovers completely
	offset = [source rangeOfString: @"\"after\""].location;
	CHECK([RunKindAt((SInt32)offset) isEqualToString: kBBLMKeywordArgumentNameRunKind], "no recovery after bad line");
	offset = [source rangeOfString: @"\"fine\""].location;
	CHECK([RunKindAt((SInt32)offset) isEqualToString: kBBLMDoubleQuotedStringRunKind], "no recovery after bad line");

	printf("ok: CalculateRuns (%zu runs)\n", sRuns.size());
}

static void TestStrictTokenColoring(const BBLMCallbackBlock &callbacks)
{
	NSString	*source =
		@"{\"ok\": \"a\\u0041b\"}\n"						//	valid unicode escape
		 "{\"bad\": \"a\\x\"}\n"							//	invalid escape
		 "{\"badu\": \"\\u12Z4\"}\n"						//	malformed unicode escape
		 "{\"big\": 1234567890123456789012345678901234567890123456789012345678901234567890}\n";

	std::vector<UniChar>	text = ToUTF16(source);
	BBLMParamBlock			params = MakeParams(text, kBBLMCalculateRunsMessage);

	sRuns.clear();
	params.fCalcRunParams.fStartOffset = 0;

	CHECK(noErr == JSONLMachO(params, callbacks), "CalculateRuns returned an error");

	NSUInteger	offset;

	offset = [source rangeOfString: @"\"a\\u0041b\""].location;
	CHECK([RunKindAt((SInt32)offset) isEqualToString: kBBLMDoubleQuotedStringRunKind],
			"valid unicode escape wrongly flagged");

	offset = [source rangeOfString: @"\"a\\x\""].location;
	CHECK([RunKindAt((SInt32)offset) isEqualToString: kBBLMSyntaxErrorRunKind],
			"invalid escape not flagged");

	offset = [source rangeOfString: @"\"\\u12Z4\""].location;
	CHECK([RunKindAt((SInt32)offset) isEqualToString: kBBLMSyntaxErrorRunKind],
			"malformed unicode escape not flagged");

	offset = [source rangeOfString: @"1234567890"].location;
	{
		const SInt32	index = FakeFindRun((SInt32)offset);

		CHECK([sRuns[index].kind isEqualToString: kBBLMNumberRunKind],
				"70-digit number wrongly flagged (undocumented length cap?)");
		CHECK(70 == sRuns[index].length, "long number lexeme split (length %d)", sRuns[index].length);
	}

	printf("ok: StrictTokenColoring\n");
}

static void TestAdjustRange(const BBLMCallbackBlock &callbacks, std::vector<UniChar> &text)
{
	//	sRuns still holds the run list from TestCalculateRuns; pick a run that
	//	does not start at a line start and confirm the adjusted index does.
	SInt32	victim = -1;

	for (size_t i = 0; i < sRuns.size(); i++)
	{
		const SInt32	start = sRuns[i].start;

		if ((start > 0) && ('\n' != text[start - 1]) && ('\r' != text[start - 1]))
		{
			victim = (SInt32)i;
		}
	}

	CHECK(victim > 0, "no mid-line run to test with");

	BBLMParamBlock	params = MakeParams(text, kBBLMAdjustRangeMessage);

	params.fAdjustRangeParams.fStartIndex = victim;
	params.fAdjustRangeParams.fEndIndex = victim;
	params.fAdjustRangeParams.fOrigStartIndex = victim;

	CHECK(noErr == JSONLMachO(params, callbacks), "AdjustRange returned an error");

	const SInt32	adjusted = params.fAdjustRangeParams.fStartIndex;
	const SInt32	start = sRuns[adjusted].start;

	CHECK(adjusted <= victim, "AdjustRange moved forward");
	CHECK((0 == start) || ('\n' == text[start - 1]) || ('\r' == text[start - 1]),
			"adjusted run %d does not start at a line start (offset %d)", adjusted, start);

	printf("ok: AdjustRange (%d -> %d)\n", victim, adjusted);
}

static void TestScanForFunctions(const BBLMCallbackBlock &callbacks)
{
	NSString	*source =
		@"{\"type\":\"assistant\",\"id\":7}\n"
		 "\n"
		 "{\"ts\":\"2026-07-21\",\"payload\":{\"a\":1}}\n"
		 "this is not json\n"
		 "[1,2,3]\n";

	std::vector<UniChar>	text = ToUTF16(source);
	BBLMParamBlock			params = MakeParams(text, kBBLMScanForFunctionsMessage);

	CHECK(noErr == JSONLMachO(params, callbacks), "ScanForFunctions returned an error");
	CHECK(4 == sFunctions.size(), "expected 4 entries (blank line skipped), got %zu", sFunctions.size());

	NSString	*name0 = sTokens[sFunctions[0].fNameStart];
	NSString	*name1 = sTokens[sFunctions[1].fNameStart];
	NSString	*name2 = sTokens[sFunctions[2].fNameStart];
	NSString	*name3 = sTokens[sFunctions[3].fNameStart];

	CHECK([name0 isEqualToString: @"1 · type: assistant"], "bad title: %s", [name0 UTF8String]);
	CHECK([name1 isEqualToString: @"3 · ts: 2026-07-21"], "bad title: %s", [name1 UTF8String]);
	CHECK([name2 hasPrefix: @"4 · ✗"], "bad invalid-line title: %s", [name2 UTF8String]);
	CHECK([name3 isEqualToString: @"5 · [1,2,3]"], "bad array title: %s", [name3 UTF8String]);

	//	choosing an entry selects the whole record
	NSRange	line3 = [source rangeOfString: @"{\"ts\""];

	CHECK(sFunctions[1].fSelStart == line3.location, "selection start wrong");
	CHECK(sFunctions[1].fSelEnd == [source rangeOfString: @"\nthis"].location, "selection end wrong");

	printf("ok: ScanForFunctions (%zu records)\n", sFunctions.size());
}

static SInt16 GuessFor(NSString *source, const BBLMCallbackBlock &callbacks)
{
	std::vector<UniChar>	text = ToUTF16(source);
	BBLMParamBlock			params = MakeParams(text, kBBLMGuessLanguageMessage);

	CHECK(noErr == JSONLMachO(params, callbacks), "GuessLanguage returned an error");
	return params.fGuessLanguageParams.fGuessResult;
}

static void TestGuessLanguage(const BBLMCallbackBlock &callbacks)
{
	CHECK(kBBLMGuessDefiniteYes == GuessFor(@"{\"a\":1}\n{\"b\":2}\n", callbacks), "two records should be a definite yes");
	CHECK(kBBLMGuessDefiniteYes == GuessFor(@"[1]\n[2]\n", callbacks), "array records should be a definite yes");
	CHECK(kBBLMGuessMaybe == GuessFor(@"{\"a\":1}\n", callbacks), "single record should be a maybe (could be JSON)");
	CHECK(kBBLMGuessDefiniteNo == GuessFor(@"# A markdown heading\n\nSome prose.\n", callbacks), "prose should be a definite no");
	CHECK(kBBLMGuessDefiniteNo == GuessFor(@"", callbacks), "empty text should be a definite no");

	printf("ok: GuessLanguage\n");
}

static void TestWordLookup(const BBLMCallbackBlock &callbacks)
{
	std::vector<UniChar>	text = ToUTF16(@"true");

	BBLMParamBlock	params = MakeParams(text, kBBLMRunKindForWordMessage);

	params.fWordLookupParams.fToken = @"true";
	CHECK(noErr == JSONLMachO(params, callbacks), "RunKindForWord returned an error");
	CHECK([params.fWordLookupParams.fRunKind isEqualToString: kBBLMKeywordRunKind], "true not a keyword");

	params.fWordLookupParams.fToken = @"banana";
	CHECK(noErr == JSONLMachO(params, callbacks), "RunKindForWord returned an error");
	CHECK(nil == params.fWordLookupParams.fRunKind, "banana should not match");

	printf("ok: RunKindForWord\n");
}

static NSString *ReformatWithModule(NSString *input, const UInt8 message,
									const bool newlineAtEnd, const BBLMCallbackBlock &callbacks)
{
	std::vector<UniChar>	text = ToUTF16(input);
	BBLMParamBlock			params = MakeParams(text, message);

	params.fReformatParams.fInTextToFormat = input;
	params.fReformatParams.fInSelectionRange = NSMakeRange(0, [input length]);
	params.fReformatParams.fInSpacesPerTab = 4;
	params.fReformatParams.fInPreferSpaces = false;
	params.fReformatParams.fInNewlineAtEnd = newlineAtEnd;
	params.fReformatParams.fOutAdjustedSelectionRange = NSMakeRange(NSNotFound, 0);

	CHECK(noErr == JSONLMachO(params, callbacks), "Reformat returned an error");
	CHECK(nil != params.fReformatParams.fOutFormattedText, "no reformatted text produced");

	return params.fReformatParams.fOutFormattedText;
}

static void TestReformat(const BBLMCallbackBlock &callbacks)
{
	NSString	*input =
		@"  { \"b\" : 1 , \"a\" : [ 1 , 2 ] , \"s\" : \"x y\" }  \n"
		 "not json at all\n"
		 "{ \"n\" : -1.50e+2 }\r\n"
		 "{\"already\":\"compact\"}";

	NSString	*expected =
		@"{\"b\":1,\"a\":[1,2],\"s\":\"x y\"}\n"
		 "not json at all\n"
		 "{\"n\":-1.50e+2}\r\n"
		 "{\"already\":\"compact\"}\n";

	NSString	*result = ReformatWithModule(input, kBBLMCreateReformattedDocumentTextMessage, true, callbacks);

	CHECK([result isEqualToString: expected],
			"document reformat mismatch:\n---got---\n%s\n---want---\n%s",
			[result UTF8String], [expected UTF8String]);

	//	key order and number lexemes must be preserved exactly
	NSString	*ordered = ReformatWithModule(@"{\"z\":1.0,\"a\":2}", kBBLMCreateReformattedDocumentTextMessage,
												false, callbacks);

	CHECK([ordered isEqualToString: @"{\"z\":1.0,\"a\":2}"], "key order or lexeme not preserved: %s", [ordered UTF8String]);

	//	selection reformat never appends a trailing newline
	NSString	*selection = ReformatWithModule(@"{ \"a\" : 1 }", kBBLMCreateReformattedSelectionTextMessage,
												true, callbacks);

	CHECK([selection isEqualToString: @"{\"a\":1}"], "selection reformat mismatch: %s", [selection UTF8String]);

	printf("ok: Reformat\n");
}

#pragma mark - Main

int main(int argc, char *argv[])
{
	@autoreleasepool
	{
		BBLMCallbackBlock	callbacks = MakeCallbacks();

		if ((3 == argc) && (0 == strcmp(argv[1], "reformat")))
		{
			NSString	*path = [NSString stringWithUTF8String: argv[2]];
			NSString	*content = [NSString stringWithContentsOfFile: path
															 encoding: NSUTF8StringEncoding
																error: NULL];

			if (nil == content)
			{
				fprintf(stderr, "cannot read %s\n", argv[2]);
				return 1;
			}

			NSString	*result = ReformatWithModule(content, kBBLMCreateReformattedDocumentTextMessage,
														true, callbacks);

			fputs([result UTF8String], stdout);
			return 0;
		}

		if ((3 == argc) && (0 == strcmp(argv[1], "titles")))
		{
			NSString	*path = [NSString stringWithUTF8String: argv[2]];
			NSString	*content = [NSString stringWithContentsOfFile: path
													 encoding: NSUTF8StringEncoding
														error: NULL];

			if (nil == content)
			{
				fprintf(stderr, "cannot read %s\n", argv[2]);
				return 1;
			}

			std::vector<UniChar>	text = ToUTF16(content);
			BBLMParamBlock			params = MakeParams(text, kBBLMScanForFunctionsMessage);

			if (noErr != JSONLMachO(params, callbacks))
			{
				fprintf(stderr, "cannot scan %s\n", argv[2]);
				return 1;
			}

			for (const BBLMProcInfo &info : sFunctions)
				printf("%s\n", [sTokens[info.fNameStart] UTF8String]);

			return 0;
		}

		TestCalculateRuns(callbacks);

		{
			//	re-derive the text TestCalculateRuns used for the AdjustRange test
			NSString	*source =
				@"{\"type\": \"assistant\", \"id\": 42, \"ok\": true}\n"
				 "{\"name\": \"he \\\"llo\\\"\", \"n\": -1.5e+3, \"v\": null}\n"
				 "nonsense @@ {\"x\": 00}\n"
				 "{\"unterminated\": \"oops\n"
				 "{\"after\": \"fine\"}\n";
			std::vector<UniChar>	text = ToUTF16(source);

			TestAdjustRange(callbacks, text);
		}

		TestStrictTokenColoring(callbacks);
		TestScanForFunctions(callbacks);
		TestGuessLanguage(callbacks);
		TestWordLookup(callbacks);
		TestReformat(callbacks);

		printf("ALL MODULE TESTS PASSED\n");
	}

	return 0;
}
