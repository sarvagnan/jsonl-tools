//
//	JSONL.mm - BBEdit language module for JSON Lines / NDJSON.
//
//	One JSON record per physical line; the scanner state resets at every
//	line break, so coloring and function scanning stay correct no matter
//	how broken any individual record is.
//

#include <objc/objc.h>

#define __ASSERT_MACROS_DEFINE_VERSIONS_WITHOUT_UNDERSCORES 1
#include <AssertMacros.h>

#import <Foundation/Foundation.h>
#include <CoreServices/CoreServices.h>

#include <vector>
#include <string>
#include <algorithm>

#include "BBLMInterface.h"
#include "BBLMTextIterator.h"

static const DescType kJSONLLanguageCode = 'JsnL';

#pragma mark - Character helpers

static inline bool IsJSONWhitespace(const UniChar c)
{
	return (' ' == c) || ('\t' == c);
}

static inline bool IsDigit(const UniChar c)
{
	return (c >= '0') && (c <= '9');
}

static inline bool IsHexDigit(const UniChar c)
{
	return IsDigit(c) || ((c >= 'a') && (c <= 'f')) || ((c >= 'A') && (c <= 'F'));
}

static inline bool IsLetter(const UniChar c)
{
	return ((c >= 'a') && (c <= 'z')) || ((c >= 'A') && (c <= 'Z'));
}

static inline bool IsStructuralChar(const UniChar c)
{
	return ('{' == c) || ('}' == c) || ('[' == c) || (']' == c) || (':' == c) || (',' == c);
}

//	Validate a complete lexeme against the JSON number grammar. CharAt is
//	any indexable source of UniChars, so this works over both contiguous
//	buffers and gap-aware text iterators.
template <typename CharAt>
static bool ValidateJSONNumber(CharAt chars, const size_t length)
{
	size_t	i = 0;

	if ((i < length) && ('-' == chars[i]))
		i++;

	if (i >= length)
		return false;

	if ('0' == chars[i])
	{
		i++;
	}
	else if (IsDigit(chars[i]))
	{
		while ((i < length) && IsDigit(chars[i]))
			i++;
	}
	else
	{
		return false;
	}

	if ((i < length) && ('.' == chars[i]))
	{
		i++;
		if ((i >= length) || (! IsDigit(chars[i])))
			return false;

		while ((i < length) && IsDigit(chars[i]))
			i++;
	}

	if ((i < length) && (('e' == chars[i]) || ('E' == chars[i])))
	{
		i++;
		if ((i < length) && (('+' == chars[i]) || ('-' == chars[i])))
			i++;

		if ((i >= length) || (! IsDigit(chars[i])))
			return false;

		while ((i < length) && IsDigit(chars[i]))
			i++;
	}

	return (i == length);
}

static bool IsValidJSONNumber(const UniChar *chars, const size_t length)
{
	return ValidateJSONNumber(chars, length);
}

#pragma mark - Per-line JSON parser

//
//	A strict single-line JSON parser mirroring the grammar used by the
//	companion jsonl-core package: it validates a record, can rebuild it in
//	fully compact form (lexemes preserved, whitespace removed), and captures
//	top-level object keys for function-menu summaries.
//

struct LineParseResult
{
	bool			valid;
	bool			topIsObject;
	bool			sawFirstMember;

	//	first top-level key, and the best "summary" key from the preferred list
	std::u16string	firstKey;
	std::u16string	firstValue;			//	scalar lexeme, empty if value is object/array
	int				summaryPriority;	//	lower is better; INT_MAX if none found
	std::u16string	summaryKey;
	std::u16string	summaryValue;

	std::u16string	compact;			//	built only when requested

	LineParseResult()
		: valid(false), topIsObject(false), sawFirstMember(false), summaryPriority(INT_MAX)
	{ /*...*/ }
};

//	keys whose values make good one-line record summaries, best first
static const char * const kSummaryKeys[] =
{
	"name", "title", "type", "event", "kind", "role",
	"method", "id", "status", "level", "msg", "message", "url"
};

static int SummaryKeyPriority(const std::u16string &key)
{
	for (size_t i = 0; i < (sizeof(kSummaryKeys) / sizeof(kSummaryKeys[0])); i++)
	{
		const char	*candidate = kSummaryKeys[i];
		size_t		len = strlen(candidate);

		if (key.size() != len)
			continue;

		bool	match = true;

		for (size_t j = 0; j < len; j++)
		{
			if (key[j] != (UniChar)candidate[j])
			{
				match = false;
				break;
			}
		}

		if (match)
			return (int)i;
	}

	return INT_MAX;
}

class JSONLineParser
{
	public:

		JSONLineParser(const UniChar *chars, const size_t length, const bool buildCompact)
			: fChars(chars), fLength(length), fIndex(0), fBuildCompact(buildCompact)
		{ /*...*/ }

		//	Returns false for a line that is not exactly one valid JSON value
		//	(surrounding whitespace allowed). Blank lines are the caller's business.
		bool	Parse(LineParseResult &result)
		{
			fResult = &result;

			SkipWhitespace();

			if (! ParseValue(0))
				return false;

			SkipWhitespace();

			if (fIndex != fLength)
				return false;

			result.valid = true;
			return true;
		}

	private:

		const UniChar	*fChars;
		const size_t	fLength;
		size_t			fIndex;
		const bool		fBuildCompact;
		LineParseResult	*fResult;

		bool	AtEnd() const					{ return fIndex >= fLength; }
		UniChar	Peek() const					{ return AtEnd() ? 0 : fChars[fIndex]; }

		void	SkipWhitespace()
		{
			while ((! AtEnd()) && IsJSONWhitespace(Peek()))
				fIndex++;
		}

		void	Emit(const UniChar c)
		{
			if (fBuildCompact)
				fResult->compact.push_back(c);
		}

		void	EmitRange(const size_t start, const size_t end)
		{
			if (fBuildCompact)
				fResult->compact.append(fChars + start, fChars + end);
		}

		bool	ParseValue(const unsigned depth)
		{
			if (AtEnd())
				return false;

			const UniChar	c = Peek();

			if ('{' == c)
				return ParseObject(depth);

			if ('[' == c)
				return ParseArray(depth);

			if ('"' == c)
			{
				size_t	start = 0, end = 0;
				return ParseString(start, end);
			}

			if (('-' == c) || IsDigit(c))
				return ParseNumber();

			return ParseLiteral();
		}

		bool	ParseObject(const unsigned depth)
		{
			fIndex++;	//	consume '{'
			Emit('{');
			SkipWhitespace();

			if ('}' == Peek())
			{
				fIndex++;
				Emit('}');
				if (0 == depth)
					fResult->topIsObject = true;
				return true;
			}

			bool	first = true;

			for (;;)
			{
				if ('"' != Peek())
					return false;

				if (! first)
					Emit(',');
				first = false;

				size_t	keyStart = 0, keyEnd = 0;

				if (! ParseString(keyStart, keyEnd))
					return false;

				SkipWhitespace();

				if (':' != Peek())
					return false;

				fIndex++;
				Emit(':');
				SkipWhitespace();

				const size_t	valueStart = fIndex;

				if (! ParseValue(depth + 1))
					return false;

				if (0 == depth)
					RecordTopLevelMember(keyStart, keyEnd, valueStart, fIndex);

				SkipWhitespace();

				if ('}' == Peek())
				{
					fIndex++;
					Emit('}');
					if (0 == depth)
						fResult->topIsObject = true;
					return true;
				}

				if (',' != Peek())
					return false;

				fIndex++;
				SkipWhitespace();

				if ('}' == Peek())
					return false;	//	trailing comma
			}
		}

		bool	ParseArray(const unsigned depth)
		{
			fIndex++;	//	consume '['
			Emit('[');
			SkipWhitespace();

			if (']' == Peek())
			{
				fIndex++;
				Emit(']');
				return true;
			}

			bool	first = true;

			for (;;)
			{
				if (! first)
					Emit(',');
				first = false;

				if (! ParseValue(depth + 1))
					return false;

				SkipWhitespace();

				if (']' == Peek())
				{
					fIndex++;
					Emit(']');
					return true;
				}

				if (',' != Peek())
					return false;

				fIndex++;
				SkipWhitespace();

				if (']' == Peek())
					return false;	//	trailing comma
			}
		}

		//	On success, contentStart/contentEnd delimit the string's contents
		//	(without the surrounding quotes).
		bool	ParseString(size_t &contentStart, size_t &contentEnd)
		{
			if ('"' != Peek())
				return false;

			const size_t	lexemeStart = fIndex;

			fIndex++;
			contentStart = fIndex;

			while (! AtEnd())
			{
				const UniChar	c = fChars[fIndex];

				if ('"' == c)
				{
					contentEnd = fIndex;
					fIndex++;
					EmitRange(lexemeStart, fIndex);
					return true;
				}

				if ('\\' == c)
				{
					if (! ParseEscape())
						return false;
					continue;
				}

				if (c < ' ')
					return false;	//	unescaped control character

				fIndex++;
			}

			return false;	//	unterminated
		}

		bool	ParseEscape()
		{
			fIndex++;	//	consume backslash

			if (AtEnd())
				return false;

			const UniChar	c = fChars[fIndex];

			switch (c)
			{
				case '"': case '\\': case '/': case 'b':
				case 'f': case 'n': case 'r': case 't':
					fIndex++;
					return true;

				case 'u':
					fIndex++;
					for (int i = 0; i < 4; i++)
					{
						if (AtEnd() || (! IsHexDigit(fChars[fIndex])))
							return false;
						fIndex++;
					}
					return true;

				default:
					return false;
			}
		}

		bool	ParseNumber()
		{
			const size_t	start = fIndex;

			while ((! AtEnd()) &&
					(IsDigit(Peek()) || ('-' == Peek()) || ('+' == Peek()) ||
					 ('.' == Peek()) || ('e' == Peek()) || ('E' == Peek())))
			{
				fIndex++;
			}

			if (! IsValidJSONNumber(fChars + start, fIndex - start))
				return false;

			EmitRange(start, fIndex);
			return true;
		}

		bool	ParseLiteral()
		{
			static const char * const	literals[] = { "true", "false", "null" };

			for (size_t i = 0; i < 3; i++)
			{
				const char		*literal = literals[i];
				const size_t	len = strlen(literal);

				if ((fIndex + len) > fLength)
					continue;

				bool	match = true;

				for (size_t j = 0; j < len; j++)
				{
					if (fChars[fIndex + j] != (UniChar)literal[j])
					{
						match = false;
						break;
					}
				}

				if (match)
				{
					EmitRange(fIndex, fIndex + len);
					fIndex += len;
					return true;
				}
			}

			return false;
		}

		void	RecordTopLevelMember(const size_t keyStart, const size_t keyEnd,
										const size_t valueStart, const size_t valueEnd)
		{
			std::u16string	key(fChars + keyStart, fChars + keyEnd);

			//	scalar values keep their lexeme for display; containers don't
			std::u16string	value;

			if ((valueEnd > valueStart) &&
				('{' != fChars[valueStart]) && ('[' != fChars[valueStart]))
			{
				size_t	start = valueStart;
				size_t	end = valueEnd;

				//	strip quotes from string values for display
				if (('"' == fChars[start]) && ((end - start) >= 2))
				{
					start++;
					end--;
				}

				value.assign(fChars + start, fChars + end);
			}

			if (! fResult->sawFirstMember)
			{
				fResult->sawFirstMember = true;
				fResult->firstKey = key;
				fResult->firstValue = value;
			}

			const int	priority = SummaryKeyPriority(key);

			if ((priority < fResult->summaryPriority) && (! value.empty()))
			{
				fResult->summaryPriority = priority;
				fResult->summaryKey = key;
				fResult->summaryValue = value;
			}
		}
};

#pragma mark - Line extraction

//	Copy the line starting at startPos into lineChars (line break excluded).
//	Returns the offset just past the line's last character; afterLineBreak
//	gets the offset of the first character of the next line (or text end).
static UInt32 ExtractLine(const BBLMParamBlock &params, const UInt32 startPos,
							std::vector<UniChar> &lineChars, UInt32 &afterLineBreak)
{
	const UInt32	textLength = params.fTextLength;
	BBLMTextIterator	iter(params, startPos);
	UInt32			pos = startPos;

	lineChars.clear();

	while ((pos < textLength) && (! BBLMCharacterIsLineBreak(*iter)))
	{
		lineChars.push_back(*iter);
		++iter;
		pos++;
	}

	const UInt32	lineEnd = pos;

	if (pos < textLength)
	{
		const UniChar	c = *iter;

		++iter;
		pos++;

		if (('\r' == c) && (pos < textLength) && ('\n' == *iter))
			pos++;
	}

	afterLineBreak = pos;
	return lineEnd;
}

static bool LineIsBlank(const std::vector<UniChar> &lineChars)
{
	for (const UniChar c : lineChars)
	{
		if (! IsJSONWhitespace(c))
			return false;
	}

	return true;
}

#pragma mark - Syntax coloring

static OSErr CalculateRuns(BBLMParamBlock &params, const BBLMCallbackBlock &callbacks)
{
	const SInt32	textLength = (SInt32)params.fTextLength;
	SInt32			pos = params.fCalcRunParams.fStartOffset;
	SInt32			codeStart = pos;
	BBLMTextIterator	iter(params, pos);
	bool			keepGoing = true;

	//	flush the pending "code" run (structural characters and whitespace)
	//	covering [codeStart, endPos)
	auto	flushCode = [&](const SInt32 endPos) -> bool
	{
		if (endPos > codeStart)
			return bblmAddRun(&callbacks, kJSONLLanguageCode, kBBLMCodeRunKind,
								codeStart, endPos - codeStart);
		return true;
	};

	while (keepGoing && (pos < textLength))
	{
		const UniChar	c = *iter;

		if (BBLMCharacterIsLineBreak(c))
		{
			//	runs never span a line break: absorb the break into the
			//	pending code run and cut it, so that every line begins a
			//	fresh run and AdjustRange can restart scans at line starts
			++iter;
			pos++;

			if (('\r' == c) && (pos < textLength) && ('\n' == *iter))
			{
				++iter;
				pos++;
			}

			keepGoing = flushCode(pos);
			codeStart = pos;
			continue;
		}

		if (IsStructuralChar(c) || IsJSONWhitespace(c))
		{
			++iter;
			pos++;
			continue;
		}

		if ('"' == c)
		{
			keepGoing = flushCode(pos);
			if (! keepGoing)
				break;

			const SInt32	stringStart = pos;
			bool			terminated = false;
			bool			contentsValid = true;

			++iter;
			pos++;

			while (pos < textLength)
			{
				const UniChar	sc = *iter;

				if (BBLMCharacterIsLineBreak(sc))
					break;

				if ('\\' == sc)
				{
					++iter;
					pos++;

					if ((pos >= textLength) || BBLMCharacterIsLineBreak(*iter))
					{
						contentsValid = false;
						continue;
					}

					const UniChar	ec = *iter;

					++iter;
					pos++;

					if ('u' == ec)
					{
						for (int i = 0; i < 4; i++)
						{
							if ((pos >= textLength) || (! IsHexDigit(*iter)))
							{
								contentsValid = false;
								break;
							}

							++iter;
							pos++;
						}
					}
					else if (('"' != ec) && ('\\' != ec) && ('/' != ec) &&
							 ('b' != ec) && ('f' != ec) && ('n' != ec) &&
							 ('r' != ec) && ('t' != ec))
					{
						contentsValid = false;
					}

					continue;
				}

				if (sc < ' ')
					contentsValid = false;	//	unescaped control character

				++iter;
				pos++;

				if ('"' == sc)
				{
					terminated = true;
					break;
				}
			}

			NSString	*kind = nil;

			if ((! terminated) || (! contentsValid))
			{
				kind = kBBLMSyntaxErrorRunKind;
			}
			else
			{
				//	a string followed by ':' is an object key
				BBLMTextIterator	lookahead(iter);
				SInt32				laPos = pos;

				while ((laPos < textLength) && IsJSONWhitespace(*lookahead))
				{
					++lookahead;
					laPos++;
				}

				if ((laPos < textLength) && (':' == *lookahead))
					kind = kBBLMKeywordArgumentNameRunKind;
				else
					kind = kBBLMDoubleQuotedStringRunKind;
			}

			keepGoing = bblmAddRun(&callbacks, kJSONLLanguageCode, kind,
									stringStart, pos - stringStart);
			codeStart = pos;
			continue;
		}

		if (('-' == c) || IsDigit(c))
		{
			keepGoing = flushCode(pos);
			if (! keepGoing)
				break;

			const SInt32		numberStart = pos;
			BBLMTextIterator	numberIter(iter);

			while (pos < textLength)
			{
				const UniChar	nc = *iter;

				if (IsDigit(nc) || ('-' == nc) || ('+' == nc) ||
					('.' == nc) || ('e' == nc) || ('E' == nc))
				{
					++iter;
					pos++;
				}
				else
				{
					break;
				}
			}

			const bool	valid = ValidateJSONNumber(numberIter, (size_t)(pos - numberStart));

			keepGoing = bblmAddRun(&callbacks, kJSONLLanguageCode,
									valid ? kBBLMNumberRunKind : kBBLMSyntaxErrorRunKind,
									numberStart, pos - numberStart);
			codeStart = pos;
			continue;
		}

		if (IsLetter(c))
		{
			keepGoing = flushCode(pos);
			if (! keepGoing)
				break;

			const SInt32	wordStart = pos;
			UniChar			word[8] = { 0 };
			size_t			wordLength = 0;

			while ((pos < textLength) && IsLetter(*iter))
			{
				if (wordLength < 7)
					word[wordLength++] = *iter;
				else
					wordLength = 8;	//	too long to be a JSON literal

				++iter;
				pos++;
			}

			bool	isLiteral = false;

			if (wordLength <= 5)
			{
				NSString	*token = [[[NSString alloc] initWithCharacters: word
																	length: wordLength] autorelease];

				isLiteral = ([token isEqualToString: @"true"] ||
								[token isEqualToString: @"false"] ||
								[token isEqualToString: @"null"]);
			}

			keepGoing = bblmAddRun(&callbacks, kJSONLLanguageCode,
									isLiteral ? kBBLMKeywordRunKind : kBBLMSyntaxErrorRunKind,
									wordStart, pos - wordStart);
			codeStart = pos;
			continue;
		}

		//	anything else can't appear outside a string in JSON
		{
			keepGoing = flushCode(pos);
			if (! keepGoing)
				break;

			const SInt32	junkStart = pos;

			while ((pos < textLength) &&
					(! BBLMCharacterIsLineBreak(*iter)) &&
					(! IsStructuralChar(*iter)) &&
					(! IsJSONWhitespace(*iter)) &&
					('"' != *iter) &&
					(! IsDigit(*iter)) &&
					(! IsLetter(*iter)) &&
					('-' != *iter))
			{
				++iter;
				pos++;
			}

			keepGoing = bblmAddRun(&callbacks, kJSONLLanguageCode, kBBLMSyntaxErrorRunKind,
									junkStart, pos - junkStart);
			codeStart = pos;
		}
	}

	if (keepGoing)
		flushCode(std::min(pos, textLength));

	bblmFlushRuns(&callbacks);

	return noErr;
}

//	Back the rescan start up to a run that begins at a line start, since the
//	scanner state is only valid from the beginning of a line.
static void AdjustRange(BBLMParamBlock &params, const BBLMCallbackBlock &callbacks)
{
	SInt32				index = params.fAdjustRangeParams.fStartIndex;
	BBLMTextIterator	text(params);

	while (index > 0)
	{
		BBLMRunRec	run;

		if (! bblmGetRun(&callbacks, index, run))
			break;

		if (0 == run.startPos)
			break;

		if (BBLMCharacterIsLineBreak(text[run.startPos - 1]))
			break;

		index--;
	}

	params.fAdjustRangeParams.fStartIndex = index;
}

#pragma mark - Function scanner

static NSString *StringFromU16(const std::u16string &s)
{
	return [[[NSString alloc] initWithCharacters: (const UniChar *)s.data()
										  length: s.size()] autorelease];
}

static NSString *TruncateForDisplay(NSString *s, const NSUInteger maxLength)
{
	if ([s length] <= maxLength)
		return s;

	//	never cut a surrogate pair in half
	NSUInteger	cut = maxLength;

	if (CFStringIsSurrogateHighCharacter([s characterAtIndex: cut - 1]))
		cut--;

	return [[s substringToIndex: cut] stringByAppendingString: @"…"];
}

static NSString *RecordMenuTitle(const UInt32 lineNumber,
									const std::vector<UniChar> &lineChars,
									const LineParseResult &parse)
{
	if (! parse.valid)
		return [NSString stringWithFormat: @"%u · ✗ invalid JSON", (unsigned)lineNumber];

	if (parse.topIsObject)
	{
		if (INT_MAX != parse.summaryPriority)
		{
			return [NSString stringWithFormat: @"%u · %@: %@",
						(unsigned)lineNumber,
						StringFromU16(parse.summaryKey),
						TruncateForDisplay(StringFromU16(parse.summaryValue), 48)];
		}

		if (parse.sawFirstMember)
		{
			NSString	*value = parse.firstValue.empty()
								? @"…"
								: TruncateForDisplay(StringFromU16(parse.firstValue), 48);

			return [NSString stringWithFormat: @"%u · %@: %@",
						(unsigned)lineNumber, StringFromU16(parse.firstKey), value];
		}

		return [NSString stringWithFormat: @"%u · {}", (unsigned)lineNumber];
	}

	//	array or scalar record: show a prefix of the raw text
	size_t	start = 0;

	while ((start < lineChars.size()) && IsJSONWhitespace(lineChars[start]))
		start++;

	size_t	end = lineChars.size();

	while ((end > start) && IsJSONWhitespace(lineChars[end - 1]))
		end--;

	NSString	*raw = [[[NSString alloc] initWithCharacters: lineChars.data() + start
													 length: end - start] autorelease];
	NSString	*preview = TruncateForDisplay(raw, 48);

	return [NSString stringWithFormat: @"%u · %@", (unsigned)lineNumber, preview];
}

static OSErr ScanForFunctions(BBLMParamBlock &params, const BBLMCallbackBlock &callbacks)
{
	OSErr	result = noErr;

	__Require_Action(0 == params.fTextGapLength, EXIT, result = paramErr);

	__Require_noErr(result = bblmResetTokenBuffer(&callbacks, params.fFcnParams.fTokenBuffer), EXIT);
	__Require_noErr(result = bblmResetProcList(&callbacks, params.fFcnParams.fFcnList), EXIT);

	{
		const UInt32		textLength = params.fTextLength;
		UInt32				pos = 0;
		UInt32				lineNumber = 1;
		std::vector<UniChar>	lineChars;

		lineChars.reserve(512);

		while (pos < textLength)
		{
			const UInt32	lineStart = pos;
			UInt32			nextLine = 0;
			const UInt32	lineEnd = ExtractLine(params, lineStart, lineChars, nextLine);

			if (! LineIsBlank(lineChars))
			{
				LineParseResult	parse;

				JSONLineParser(lineChars.data(), lineChars.size(), false).Parse(parse);

				NSString		*title = RecordMenuTitle(lineNumber, lineChars, parse);
				BBLMProcInfo	info;
				UInt32			index = 0;

				memset(&info, 0, sizeof(info));

				info.fFunctionStart = lineStart;
				info.fFunctionEnd = lineEnd;
				info.fSelStart = lineStart;
				info.fSelEnd = lineEnd;
				info.fFirstChar = lineStart;
				info.fIndentLevel = 0;
				info.fKind = kBBLMFunctionMark;
				info.fFlags = 0;
				info.fNameLength = (SInt32)[title length];

				__Require_noErr(result = bblmAddFunctionToList(&callbacks,
																params.fFcnParams.fTokenBuffer,
																params.fFcnParams.fFcnList,
																title, info, &index),
								EXIT);
			}

			pos = nextLine;
			lineNumber++;
		}
	}

EXIT:
	return result;
}

#pragma mark - Language guessing

static void GuessLanguage(BBLMParamBlock &params)
{
	const UInt32		textLength = std::min<UInt32>(params.fTextLength, 8192);
	BBLMTextIterator	iter(params);
	UInt32				pos = 0;
	unsigned			objectLines = 0;
	unsigned			examinedLines = 0;
	bool				sawForeignLine = false;

	while ((pos < textLength) && (examinedLines < 20))
	{
		//	find the first and last non-whitespace characters of this line
		UniChar	firstChar = 0;
		UniChar	lastChar = 0;

		while ((pos < textLength) && (! BBLMCharacterIsLineBreak(*iter)))
		{
			const UniChar	c = *iter;

			if (! IsJSONWhitespace(c))
			{
				if (0 == firstChar)
					firstChar = c;
				lastChar = c;
			}

			++iter;
			pos++;
		}

		//	skip the line break
		if (pos < textLength)
		{
			const UniChar	c = *iter;

			++iter;
			pos++;

			if (('\r' == c) && (pos < textLength) && ('\n' == *iter))
			{
				++iter;
				pos++;
			}
		}

		if (0 == firstChar)
			continue;	//	blank line

		examinedLines++;

		//	JSONL records are usually objects, but arrays are valid too
		if ((('{' == firstChar) && ('}' == lastChar)) ||
			(('[' == firstChar) && (']' == lastChar)))
			objectLines++;
		else if (('{' != firstChar) && ('[' != firstChar))
			sawForeignLine = true;
	}

	if (sawForeignLine || (0 == objectLines))
		params.fGuessLanguageParams.fGuessResult = kBBLMGuessDefiniteNo;
	else if (objectLines >= 2)
		params.fGuessLanguageParams.fGuessResult = kBBLMGuessDefiniteYes;
	else
		params.fGuessLanguageParams.fGuessResult = kBBLMGuessMaybe;
}

#pragma mark - Word lookup

static void RunKindForWord(BBLMParamBlock &params)
{
	NSString	*token = params.fWordLookupParams.fToken;

	if ([token isEqualToString: @"true"] ||
		[token isEqualToString: @"false"] ||
		[token isEqualToString: @"null"])
	{
		params.fWordLookupParams.fRunKind = kBBLMKeywordRunKind;
	}
	else
	{
		params.fWordLookupParams.fRunKind = nil;
	}
}

#pragma mark - Reformatting

//
//	"Reformat Document" normalizes every valid record to the same fully
//	compact form produced by jsonl-core / the jsonl CLI: lexemes preserved
//	byte for byte, all inter-token whitespace removed. Invalid and blank
//	lines pass through untouched.
//

static NSString *NormalizeLines(NSString *input, const bool ensureFinalNewline)
{
	const NSUInteger		length = [input length];
	NSMutableString			*output = [NSMutableString stringWithCapacity: length];
	std::vector<UniChar>	buffer;
	NSUInteger				pos = 0;

	while (pos < length)
	{
		//	find the end of this physical line
		NSUInteger	lineEnd = pos;

		while (lineEnd < length)
		{
			const unichar	c = [input characterAtIndex: lineEnd];

			if (('\r' == c) || ('\n' == c))
				break;

			lineEnd++;
		}

		//	capture the line's ending verbatim
		NSUInteger	nextStart = lineEnd;

		if (nextStart < length)
		{
			const unichar	c = [input characterAtIndex: nextStart];

			nextStart++;

			if (('\r' == c) && (nextStart < length) && ('\n' == [input characterAtIndex: nextStart]))
				nextStart++;
		}

		const NSRange	lineRange = NSMakeRange(pos, lineEnd - pos);

		buffer.resize(lineRange.length);
		if (lineRange.length > 0)
			[input getCharacters: buffer.data() range: lineRange];

		bool	replaced = false;

		if (! LineIsBlank(buffer))
		{
			LineParseResult	parse;

			if (JSONLineParser(buffer.data(), buffer.size(), true).Parse(parse))
			{
				NSString	*compact = StringFromU16(parse.compact);

				[output appendString: compact];
				replaced = true;
			}
		}

		if (! replaced)
			[output appendString: [input substringWithRange: lineRange]];

		[output appendString: [input substringWithRange: NSMakeRange(lineEnd, nextStart - lineEnd)]];

		pos = nextStart;
	}

	if (ensureFinalNewline && ([output length] > 0))
	{
		const unichar	last = [output characterAtIndex: [output length] - 1];

		if (('\n' != last) && ('\r' != last))
			[output appendString: @"\n"];
	}

	return output;
}

static void ReformatText(BBLMParamBlock &params, const bool isWholeDocument)
{
	bblmReformatParams	&reformat = params.fReformatParams;
	NSString			*formatted = NormalizeLines(reformat.fInTextToFormat,
													isWholeDocument && reformat.fInNewlineAtEnd);

	//	the application releases this
	reformat.fOutFormattedText = [formatted retain];
	reformat.fOutFormattedTextNeedsEntabbing = false;
}

#pragma mark - Entry point

extern "C"
{

OSErr	JSONLMachO(BBLMParamBlock &params, const BBLMCallbackBlock &bblmCallbacks);

OSErr	JSONLMachO(BBLMParamBlock &params, const BBLMCallbackBlock &bblmCallbacks)
{
	OSErr	result = noErr;

	if ((params.fSignature != kBBLMParamBlockSignature) ||
		(params.fVersion < kBBLMMinimumCompatibleParamBlockVersion))
	{
		return paramErr;
	}

	@autoreleasepool
	{
		switch (params.fMessage)
		{
			case kBBLMInitMessage:
			case kBBLMDisposeMessage:
				break;

			case kBBLMCalculateRunsMessage:
				result = CalculateRuns(params, bblmCallbacks);
				break;

			case kBBLMAdjustRangeMessage:
				AdjustRange(params, bblmCallbacks);
				break;

			case kBBLMScanForFunctionsMessage:
				result = ScanForFunctions(params, bblmCallbacks);
				break;

			case kBBLMGuessLanguageMessage:
				GuessLanguage(params);
				break;

			case kBBLMRunKindForWordMessage:
				RunKindForWord(params);
				break;

			case kBBLMCreateReformattedDocumentTextMessage:
				ReformatText(params, true);
				break;

			case kBBLMCreateReformattedSelectionTextMessage:
				ReformatText(params, false);
				break;

			case kBBLMAdjustEndMessage:
			case kBBLMSetCategoriesMessage:
			case kBBLMEscapeStringMessage:
			case kBBLMCanSpellCheckRunMessage:
				result = userCanceledErr;
				break;

			default:
				result = paramErr;
				break;
		}
	}

	return result;
}

}
