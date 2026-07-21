//	-*- mode: objective-c++; coding: utf-8; -*-

#ifndef BBLMINTERFACE_h
#define BBLMINTERFACE_h 1

#ifndef __ASSERTMACROS__
#include <AssertMacros.h>
#endif

NS_ASSUME_NONNULL_BEGIN

enum
{
	kBBLMCurrentCallbackVersion = 0x00000008
};

typedef NS_ENUM(UInt32, BBLMFunctionKinds)
{
	kBBLMFunctionMark,
	kBBLMTypedef,
	kBBLMPragmaMark,
	kBBLMInclude,
	kBBLMSysInclude,
	
	//
	//	the following collection of function types is for comments with specific
	//	"callout" formations. If you have a formation that doesn't fit one of these,
	//	use kBBLMNoteCallout.
	//
	kBBLMFixMeCallout,		//	example: /* FIXME: this won't work in Y2K */
	kBBLMToDoCallout,		//	example: /* TODO: add support for blargh */
	kBBLMReviewCallout,		//	example: /* REVIEW for correctness */
	kBBLMQuestionCallout,	//	example: /* ???:correia:20080717 what should the final value really be here? */
	kBBLMWarningCallout,	//	example: /* !!!:siegel: this looks wrong to me */
	kBBLMNoteCallout,		//	example: /* NOTE: You should always check for NULL here */
	
	kBBLMURLInclude,
	kBBLMSiteRelativeInclude,
	
	kBBLMFunctionEnumDeclaration,
	kBBLMFunctionStructDeclaration,
	kBBLMFunctionUnionDeclaration,
	kBBLMFunctionClassDeclaration,
	kBBLMFunctionProtocolDeclaration,
	kBBLMFunctionClassInterface,
	kBBLMFunctionClassImplementation,
	kBBLMFunctionInstanceVariable,
	kBBLMFunctionMethod,
	kBBLMFunctionPropertyDeclaration,
	kBBLMFunctionPropertySynthesis,
	kBBLMFunctionSGMLNamedID,
	kBBLMFunctionHTMLNamedAnchor,
	kBBLMFunctionHTMLHeading1,
	kBBLMFunctionHTMLHeading2,
	kBBLMFunctionHTMLHeading3,
	kBBLMFunctionHTMLHeading4,
	kBBLMFunctionHTMLHeading5,
	kBBLMFunctionHTMLHeading6,
	
	kBBLMReservedFunctionKind	=	32,		//	do not generate any function entries with this kind!
	kBBLMFirstUserFunctionKind,
    kBBLMLastUserFunctionKind	= 126,
};

#ifndef DECLARE_GLOBAL_STRING_NS
#define	DECLARE_GLOBAL_STRING_NS(name) extern NSString* _Nonnull const name
#endif

#ifndef DECLARE_GLOBAL_STRING_CF
#define	DECLARE_GLOBAL_STRING_CF(name) extern const CFStringRef _Nonnull name
#endif

//	The values for these and other named string constants are in this file's counterpart
//	(BBLMInterface.mm)
DECLARE_GLOBAL_STRING_NS(kBBLMFunctionTypeGeneral);
DECLARE_GLOBAL_STRING_NS(kBBLMFunctionTypeTypedef);
DECLARE_GLOBAL_STRING_NS(kBBLMFunctionTypeNamedMark);
DECLARE_GLOBAL_STRING_NS(kBBLMFunctionTypeInclude);
DECLARE_GLOBAL_STRING_NS(kBBLMFunctionTypeSystemInclude);
DECLARE_GLOBAL_STRING_NS(kBBLMFunctionTypeSiteRelativeInclude);
DECLARE_GLOBAL_STRING_NS(kBBLMFunctionTypeURLInclude);
DECLARE_GLOBAL_STRING_NS(kBBLMFunctionTypeFIXMECallout);
DECLARE_GLOBAL_STRING_NS(kBBLMFunctionTypeTODOCallout);
DECLARE_GLOBAL_STRING_NS(kBBLMFunctionTypeREVIEWCallout);
DECLARE_GLOBAL_STRING_NS(kBBLMFunctionTypeQuestionCallout);
DECLARE_GLOBAL_STRING_NS(kBBLMFunctionTypeWarningCallout);
DECLARE_GLOBAL_STRING_NS(kBBLMFunctionTypeNoteCallout);
DECLARE_GLOBAL_STRING_NS(kBBLMFunctionTypeClassDeclaration);
DECLARE_GLOBAL_STRING_NS(kBBLMFunctionTypeProtocolDeclaration);
DECLARE_GLOBAL_STRING_NS(kBBLMFunctionTypeClassInterface);
DECLARE_GLOBAL_STRING_NS(kBBLMFunctionTypeClassImplementation);
DECLARE_GLOBAL_STRING_NS(kBBLMFunctionTypeInstanceVariable);
DECLARE_GLOBAL_STRING_NS(kBBLMFunctionTypeMethod);
DECLARE_GLOBAL_STRING_NS(kBBLMFunctionTypePropertyDeclaration);
DECLARE_GLOBAL_STRING_NS(kBBLMFunctionTypePropertySynthesis);
DECLARE_GLOBAL_STRING_NS(kBBLMFunctionTypeEnumeration);
DECLARE_GLOBAL_STRING_NS(kBBLMFunctionTypeStructureDeclaration);
DECLARE_GLOBAL_STRING_NS(kBBLMFunctionTypeUnionDeclaration);
DECLARE_GLOBAL_STRING_NS(kBBLMFunctionTypeSGMLNamedID);
DECLARE_GLOBAL_STRING_NS(kBBLMFunctionTypeHTMLNamedAnchor);
DECLARE_GLOBAL_STRING_NS(kBBLMFunctionTypeHTMLHeading1);
DECLARE_GLOBAL_STRING_NS(kBBLMFunctionTypeHTMLHeading2);
DECLARE_GLOBAL_STRING_NS(kBBLMFunctionTypeHTMLHeading3);
DECLARE_GLOBAL_STRING_NS(kBBLMFunctionTypeHTMLHeading4);
DECLARE_GLOBAL_STRING_NS(kBBLMFunctionTypeHTMLHeading5);
DECLARE_GLOBAL_STRING_NS(kBBLMFunctionTypeHTMLHeading6);

typedef	enum
{
	kBBLMIsPrototype		=	0x00000001,
	kBBLMIsForwardDecl		=	0x00000002
} BBLMFunctionFlags;

typedef	enum
{
	//
	//	Beginning with BBEdit 9.2, these three bits are always set;
	//	you should always generate entries for prototypes, includes,
	//	and callouts when appropriate.
	//
	
	kBBLMShowPrototypes		=	0x00000001,
	kBBLMShowIncludes		=	0x00000002,
	kBBLMShowCommentCallouts=	0x00000004
} BBLMFcnOptionFlags;

//
//    You are encouraged to generate runs with these run kinds wherever
//    possible. Do *not* add your own run kinds that begin with
//    "com.barebones"; instead, use your own reverse-domain-name space
//    (starting with your bundle ID) for your custom run kinds. The
//    language module documentation contains complete information.
//

DECLARE_GLOBAL_STRING_NS(kBBLMCodeRunKind);
DECLARE_GLOBAL_STRING_NS(kBBLMPreprocessorRunKind);
DECLARE_GLOBAL_STRING_NS(kBBLMCommentRunKind);				//	use for languages that don't distinguish between...
DECLARE_GLOBAL_STRING_NS(kBBLMLineCommentRunKind);			//		...a "rest of line" comment, e.g. "//" in C or "#" in Ruby
DECLARE_GLOBAL_STRING_NS(kBBLMBlockCommentRunKind);			//		...a begin/end delimited comment, e.g. /*...*/ in C
DECLARE_GLOBAL_STRING_NS(kBBLMStringRunKind);					//	use for languages that don't distinguish between...
DECLARE_GLOBAL_STRING_NS(kBBLMSingleQuotedStringRunKind);		//		...a single-quoted string, e.g. 'a' in C
DECLARE_GLOBAL_STRING_NS(kBBLMDoubleQuotedStringRunKind);		//		...a double-quoted string, e.g. "hello world" in C
DECLARE_GLOBAL_STRING_NS(kBBLMHereDocStringRunKind);			//		...a "here doc" string as used in many scripting languages
DECLARE_GLOBAL_STRING_NS(kBBLMNumberRunKind);
DECLARE_GLOBAL_STRING_NS(kBBLMFileIncludeRunKind);
DECLARE_GLOBAL_STRING_NS(kBBLMVariableRunKind);
DECLARE_GLOBAL_STRING_NS(kBBLMKeywordRunKind);
DECLARE_GLOBAL_STRING_NS(kBBLMSyntaxErrorRunKind);
DECLARE_GLOBAL_STRING_NS(kBBLMPredefinedSymbolRunKind);
DECLARE_GLOBAL_STRING_NS(kBBLMKeywordArgumentNameRunKind);
DECLARE_GLOBAL_STRING_NS(kBBLMIndexedSymbolRunKind);			//	ctags catchall
DECLARE_GLOBAL_STRING_NS(kBBLMIndexedClassNameRunKind);		//	ctags "c"
DECLARE_GLOBAL_STRING_NS(kBBLMIndexedDefineRunKind);			//	ctags "d"
DECLARE_GLOBAL_STRING_NS(kBBLMIndexedEnumerationRunKind);		//	ctags "e"
DECLARE_GLOBAL_STRING_NS(kBBLMIndexedFunctionNameRunKind);	//	ctags "f"
DECLARE_GLOBAL_STRING_NS(kBBLMIndexedFileNameRunKind);		//	ctags "F"
DECLARE_GLOBAL_STRING_NS(kBBLMIndexedEnumNameRunKind);		//	ctags "g"
DECLARE_GLOBAL_STRING_NS(kBBLMIndexedMemberRunKind);			//	ctags "m"
DECLARE_GLOBAL_STRING_NS(kBBLMIndexNamedConstantRunKind);
DECLARE_GLOBAL_STRING_NS(kBBLMIndexedPrototypeRunKind);		//	ctags "p"
DECLARE_GLOBAL_STRING_NS(kBBLMIndexedStructureNameRunKind);	//	ctags "s"
DECLARE_GLOBAL_STRING_NS(kBBLMIndexedTypeNameRunKind);		//	ctags "t"
DECLARE_GLOBAL_STRING_NS(kBBLMIndexedUnionNameRunKind);		//	ctags "u"
DECLARE_GLOBAL_STRING_NS(kBBLMIndexedVariableNameRunKind);	//	ctags "v"
DECLARE_GLOBAL_STRING_NS(kBBLMSGMLCDATARunKind);				//	SGML unparsed character data (i.e. inside of a <![CDATA...]> block)
DECLARE_GLOBAL_STRING_NS(kBBLMSGMLPCDATARunKind);				//	SGML parsed character data (i.e. things not in tags)
DECLARE_GLOBAL_STRING_NS(kBBLMSGMLEntityRunKind);				//	an SGML/HTML/XML entity (named or numeric)
DECLARE_GLOBAL_STRING_NS(kBBLMSGMLDeclarationRunKind);		//	<! ... > (not including comments)
DECLARE_GLOBAL_STRING_NS(kBBLMSGMLTagRunKind);				//	singleton SGML/HTML tags, e.g. <br>
DECLARE_GLOBAL_STRING_NS(kBBLMSGMLOpenTagRunKind);			//	openers such as <ul>
DECLARE_GLOBAL_STRING_NS(kBBLMSGMLCloseTagRunKind);			//	closers for openers (e.g. </ul>)
DECLARE_GLOBAL_STRING_NS(kBBLMURLRunKind);					//	URL text
DECLARE_GLOBAL_STRING_NS(kBBLMXMLPIRunKind);					//	processing instructions: <?...>
DECLARE_GLOBAL_STRING_NS(kBBLMXMLEmptyTagRunKind);			//	empty XML tags e.g. <hr />

enum
{
	//
	//	these are values for the result from
	//	kBBLMGuessLanguageMessage. Note that you should not return a
	//	value greater than kBBLMGuessDefiniteYes, or else guessing
	//	will not work correctly.
	//
	
	kBBLMGuessDefiniteNo,
	kBBLMGuessMaybe			=	127,
	kBBLMGuessDefiniteYes	=	255
};

enum
{
	kBBLMManualFold				=  0,
	kBBLMGenericAutoFold		=  1,
	kBBLMModuleAutoFold			=  2,
	kBBLMClassAutoFold			=  3,
	kBBLMFunctionAutoFold		=  4,
	kBBLMDataAutoFold			=  5,
	kBBLMBlockCommentAutoFold	=  6,
	kBBLMHereDocAutoFold		=  7,
	
	kBBLMLastFoldKind			= 31
};

typedef	UInt32	BBLMFoldKind;

typedef	SInt8	BBLMCategoryTable[256];
typedef	SInt8	BBLMUnicodeCategoryTable[65536];

typedef	enum
{
	kBBLMNullMessage,						//	reserved
	
	kBBLMInitMessage,						//	the language module should perform any global initializations
	kBBLMDisposeMessage,					//	the language module is being shut down forever; time to clean up

	kBBLMScanForFunctionsMessage,			//	generate a list of functions in the supplied text.
											//	relevant parameters are in fFcnParams of the BBLMParamBlock
											
	kBBLMAdjustRangeMessage,				//	adjust indices of first and last language run to be rescanned
	
	kBBLMCalculateRunsMessage,				//	generate a list of language runs in the supplied text
											//	relevant parameters are in fCalcRunParams of the BBLMParamBlock
											
	kBBLMAdjustEndMessage,					//	adjust offset to last character in text that needs to be redrawn
	
	kBBLMSetCategoriesMessage,				//	configure character categories
	
	kBBLMEscapeStringMessage,				//	escape a string
		
	kBBLMGuessLanguageMessage,				//	figure out whether the provided text is in our language
	
	kBBLMWordLeftStringMessage,				// 	return a PCRE pattern C-string ptr for a word-left search
	
	kBBLMWordRightStringMessage,			// 	return a PCRE pattern C-string ptr for a word-right search
	
	kBBLMScanForFoldRangesMessage,			//	generate a list of text ranges that may be of interest
											//	for folding purposes

	kBBLMCanSpellCheckRunMessage,			//	return whether the given run of text can be spell checked

	kBBLMScanSubrangeForFunctionsMessage,	//	like kBBLMScanForFunctionsMessage, but takes a range of text
											//	to scan rather than requiring examination of the whole file

	kBBLMCreateSupportedLanguagesDictionary,//	if the module has a skeleton bblm info that indicates that it
											//	should be asked for the supported languages dictionary, it
											//	will get called with this message. Note that this call is
											//	a "create"; your module should either return a copy or retain
											//	the value that it's about to return, because the application will
											//	release it when it's done.

	kBBLMFindEndOfEmbeddedLanguageMessage,	//	ask a "parent" language's module to find the end of an embedded
											//	language (essentially, the start of the "closing" delimiter)
											//	so that we'll know how to set the fTextLength when we send the 
											//	kBBLMCalculateRunsMessage to the embedded language's module
											
	kBBLMAdjustRangeForTextCompletion,		//	if kBBLMSupportsTextCompletion is set, this message may
											//	be sent to ask the module to adjust the proposed character
											//	range prior to being sent a kBBLMCreateTextCompletionArray
											//	message

	kBBLMFilterRunForTextCompletion,		//	if kBBLMSupportsTextCompletion is set, this message may
											//	be sent to ask the module if tokens in the given run of
											//	text may be considered for completion (based on the run
											//	kind and any other contextual information that the module
											//	cares to use).
											
	kBBLMSetCategoriesForTextCompletionMessage,
											//	if kBBLMSupportsTextCompletion is set, this message may
											//	be sent to return a custom category table to be used for
											//	computing tokens during text completion. If you receive
											//	this message, you may either handle it as though you had
											//	received a kBBLMSetCategoriesMessage, or you may return
											//	a custom category table.
											//
											
	kBBLMCreateTextCompletionArray,			//	if kBBLMSupportsTextCompletion is set, this message may
											//	be sent to ask the module to return an array of possible
											//	completions

	kBBLMCreateURLByResolvingIncludeFileMessage,
											//	if kBBLMCanResolveIncludeFiles is set, this message will be
											//	sent to ask the module to return a URL to the included
											//	file on disk (or elsewhere)
	
	kBBLMRunKindForWordMessage,				//	If the module has BBLMSupportsWordLookup = YES, this
											//	message will be sent to ask the module for the run kind
											//	corresponding to a particular word. (This replaces
											//	kBBLMMatchKeywordWithCFStringMessage and 
											//	kBBLMMatchPredefinedNameMessage from the old API.)

	kBBLMAutoPairMessage,					//	When called, the editor is considering auto-pairing
											//	a typed character.

	kBBLMInitParseDataMessage,				//	When called, the module should create any document-
											//	specific parser data based on the provided information.

	kBBLMDisposeParseDataMessage,			//	When called, the module should clean up any non-reference-
											//	counted data encapsulated by fDocumentParseData.

	kBBLMRecalculateParseDataMessage,		//	When called, the document should regenerate from scratch
											//	any document-specific parse data.

	kBBLMUpdateParseDataMessage,			//	When called, the document should incrementally update
											//	its internal parse data based on the indicated insertion
											//	or deletion.

	kBBLMGetCommandDictionary,				//	when called, the language module should return a dictionary
											//	describing the mechanism for performing the requested operation
											//	(see the possible operations at bblmGetCommandDictionaryParams).

	kBBLMCalculateWordForSymbolLookupMessage,
											//	when called, the language module should inspect the range of
											//	text at the provided word, and if desired return an alternative
											//	word and selection range. The results are used to guide symbol
											//	index searches (in ctags and other data sources). The gap is
											//	removed before calling. The proposed word and selection ranges
											//	are BBEdit's best guess. If they are sufficient, the module
											//	can return without doing anything. Returning NIL in fOutCalculatedWord
											//	will abort the lookup process.

	kBBLMCreateReformattedDocumentTextMessage,
											//	when called, the language module should create a reformatted
											//	copy of the provided text, which is the entire text of the document.
											//	See bblmReformatParams for inputs and outputs.

	kBBLMCreateReformattedSelectionTextMessage,
											//	when called, the language module should create a reformatted,
											//	copy of the provided text, which is the text contained by the
											//	current selection range. See bblmReformatParams for inputs
											//	and outputs.
											
	kBBLMLastMessage
} BBLMMessage;

//	BBLMProcInfo - generated and used by the function scanner

typedef	struct BBLMProcInfo
{
	UInt32	fFunctionStart;	//	char offset in file of first character of function
	UInt32	fFunctionEnd;	//	char offset of last character of function
	
	UInt32	fSelStart;		//	first character to select when choosing function
	UInt32	fSelEnd;		//	last character to select when choosing function
	
	UInt32	fFirstChar;		//	first character to make visible when choosing function
	
	UInt32	fIndentLevel;	//	indentation level of token
	UInt32	fKind;			//	token kind (see BBLMFunctionKinds for core kinds)
	UInt32	fFlags;			//	token flags (see BBLMFunctionFlags)
	UInt32	fNameStart;		//	char offset in token buffer of token name
	SInt32	fNameLength;	//	length of token name
} BBLMProcInfo;

//
//	BBLMRunRec - generated and used by the syntax coloring machinery
//

typedef struct
{
	OSType			language;
	NSString		* _Nullable runKind /* this value is neither retained nor released */;
	SInt32			startPos;
	SInt32			length;
	UInt16			depth;
} BBLMRunRec;

//
//	Dictionary keys for the array returned by kBBLMCreateSymbolCompletionArray message
//

DECLARE_GLOBAL_STRING_CF(	kBBLMCompletionSymbolType);		//	CFStringRef; describes the kind of symbol
//	Recommended values for kBBLMCompletionSymbolType. If you define your own, they should
//	begin with your language module's bundle identifier to eliminate the possibility of
//	conflicts. (Using your bundle ID will also make future UI enhancements possible.)
//	Use kBBLMSymbolTypeGenericIdentifier if all else fails.
DECLARE_GLOBAL_STRING_CF(		kBBLMSymbolTypeArray);
DECLARE_GLOBAL_STRING_CF(		kBBLMSymbolTypeBoolean);
DECLARE_GLOBAL_STRING_CF(		kBBLMSymbolTypeCallout);
DECLARE_GLOBAL_STRING_CF(		kBBLMSymbolTypeClass);
DECLARE_GLOBAL_STRING_CF(		kBBLMSymbolTypeClassImplementation);	//	e.g. @"implementation"
DECLARE_GLOBAL_STRING_CF(		kBBLMSymbolTypeClassInterface);		//	e.g. "@interface"
DECLARE_GLOBAL_STRING_CF(		kBBLMSymbolTypeColorSpecification);
DECLARE_GLOBAL_STRING_CF(		kBBLMSymbolTypeConstructor);
DECLARE_GLOBAL_STRING_CF(		kBBLMSymbolTypeEnumerationName);
DECLARE_GLOBAL_STRING_CF(		kBBLMSymbolTypeEnumerationValue);
DECLARE_GLOBAL_STRING_CF(		kBBLMSymbolTypeEvent);
DECLARE_GLOBAL_STRING_CF(		kBBLMSymbolTypeExternVariable);
DECLARE_GLOBAL_STRING_CF(		kBBLMSymbolTypeFile);
DECLARE_GLOBAL_STRING_CF(		kBBLMSymbolTypeFunction);
DECLARE_GLOBAL_STRING_CF(		kBBLMSymbolTypeFunctionPrototype);
DECLARE_GLOBAL_STRING_CF(		kBBLMSymbolTypeGenericIdentifier);
DECLARE_GLOBAL_STRING_CF(		kBBLMSymbolTypeGlobalVariable);
DECLARE_GLOBAL_STRING_CF(		kBBLMSymbolTypeIVar);
DECLARE_GLOBAL_STRING_CF(		kBBLMSymbolTypeIncludeFile);
DECLARE_GLOBAL_STRING_CF(		kBBLMSymbolTypeKey);
DECLARE_GLOBAL_STRING_CF(		kBBLMSymbolTypeLanguageKeyword);
DECLARE_GLOBAL_STRING_CF(		kBBLMSymbolTypeLocalVariable);
DECLARE_GLOBAL_STRING_CF(		kBBLMSymbolTypeMacro);
DECLARE_GLOBAL_STRING_CF(		kBBLMSymbolTypeMember);
DECLARE_GLOBAL_STRING_CF(		kBBLMSymbolTypeMethod);
DECLARE_GLOBAL_STRING_CF(		kBBLMSymbolTypeModule);
DECLARE_GLOBAL_STRING_CF(		kBBLMSymbolTypeNamedConstant);
DECLARE_GLOBAL_STRING_CF(		kBBLMSymbolTypeNamespace);
DECLARE_GLOBAL_STRING_CF(		kBBLMSymbolTypeNull);
DECLARE_GLOBAL_STRING_CF(		kBBLMSymbolTypeNumber);
DECLARE_GLOBAL_STRING_CF(		kBBLMSymbolTypeObject);
DECLARE_GLOBAL_STRING_CF(		kBBLMSymbolTypeOperator);
DECLARE_GLOBAL_STRING_CF(		kBBLMSymbolTypePackage);
DECLARE_GLOBAL_STRING_CF(		kBBLMSymbolTypeParameter);
DECLARE_GLOBAL_STRING_CF(		kBBLMSymbolTypePredefinedSymbol);
DECLARE_GLOBAL_STRING_CF(		kBBLMSymbolTypeProperty);
DECLARE_GLOBAL_STRING_CF(		kBBLMSymbolTypeProtocolDeclaration);	// e.g. "@protocol"
DECLARE_GLOBAL_STRING_CF(		kBBLMSymbolTypeSGMLAttributeName);
DECLARE_GLOBAL_STRING_CF(		kBBLMSymbolTypeSGMLAttributeValue);
DECLARE_GLOBAL_STRING_CF(		kBBLMSymbolTypeSGMLElement);
DECLARE_GLOBAL_STRING_CF(		kBBLMSymbolTypeStaticType);
DECLARE_GLOBAL_STRING_CF(		kBBLMSymbolTypeString);
DECLARE_GLOBAL_STRING_CF(		kBBLMSymbolTypeStruct);
DECLARE_GLOBAL_STRING_CF(		kBBLMSymbolTypeTextTemplate);
DECLARE_GLOBAL_STRING_CF(		kBBLMSymbolTypeUnion);
DECLARE_GLOBAL_STRING_CF(		kBBLMSymbolTypeUnit);

DECLARE_GLOBAL_STRING_CF(	kBBLMSymbolCompletionDisplayString);	//	CFStringRef; used in the presentation UI

DECLARE_GLOBAL_STRING_CF(	kBBLMSymbolCompletionText);			//	CFStringRef; inserted upon acceptance
															//	(and may contain placeholders)

DECLARE_GLOBAL_STRING_CF(	kBBLMSymbolCompletionSortName);		//	CFStringRef; Optional: if present, is used for sorting the
															//	list in the GUI. If absent, the display string
															//	is used for sorting.

DECLARE_GLOBAL_STRING_CF(	kBBLMSymbolCompletionSymbolOffset);	//	CFNumberRef; Optional: integer (zero-based) specifying
															//	the character offset in the text of where this symbol
															//	was found.

DECLARE_GLOBAL_STRING_CF(	kBBLMSymbolCompletionAutoIndent);	//	CFBooleanRef; Optional: if present and YES, indicates
															//	that the completion text is multi-line and should be
															//	auto-indented to match the surrounding document content.

DECLARE_GLOBAL_STRING_CF(	kBBLMCompletionColorSpecColor);		//	NSColor; used *only* if kBBLMCompletionSymbolType 
															//	is kBBLMSymbolTypeColorSpecification. This will
															//	color the badge using the provided color.
															
//	Flag values for bblmCreateSymbolArrayParams.fOutAdditionalLookupFlags
typedef NS_OPTIONS(uint32_t, BBLMCompletionSymbolLookupFlags)
{
	kBBLMSymbolLookupNoFlags			=	0x00000000,
	
	kBBLMSymbolLookupPredefinedNames	=	0x00000001,
	kBBLMSymbolLookupCurrentFileCtags	=	0x00000002,
	kBBLMSymbolLookupNearbyCtags		=	0x00000004,
	kBBLMSymbolLookupClippings			=	0x00000008,
	kBBLMSymbolLookupWordsInFrontWindow	=	0x00000010,
	kBBLMSymbolLookupWordsInSystemDict	=	0x00000020,
	kBBLMSymbolLookupTagMaker			=	0x00000040,
	kBBLMSymbolLookupTextReplacements	=	0x00000080,
	
	kBBLMSymbolLookupReservedFlags		=	0xFF000000,
	kBBLMSymbolLookupEverywherePossible	=	0x00FFFFFF
};

//
//	Union members for the BBLMParamBlock structure
//

typedef	struct
{
	void	*fTokenBuffer;					//	token buffer for callbacks
	void	*fFcnList;						//	function list for callbacks
	
	UInt32	fOptionFlags;					//	option flags (see BBLMFcnOptionFlags)
} bblmFcnParams;

typedef	struct
{
	UInt32	fScanStart;						//	where to start scanning (relative to fText)
	UInt32	fScanEnd;						//	where to stop scanning (relative to fText)
	
	void	*fTokenBuffer;					//	token buffer for callbacks
	void	*fFcnList;						//	function list for callbacks
	
	UInt32	fOptionFlags;					//	option flags (see BBLMFcnOptionFlags)
} bblmScanSubrangeForFcnParams;

typedef struct
{
	CFDictionaryRef	fDictionary;			//	fully qualified "com.barebones.bblminfo" dictionary
											//	instance to be returned to the application.
											//	Your module should either return a copy or retain
											//	the value that it's about to return, because the
											//	application will release it when it's done.
} bblmCreateLanguageDictParams;

typedef struct
{
	SInt32		fStartIndex;
	SInt32		fEndIndex;
	SInt32		fOrigStartIndex;
	BBLMRunRec	fOrigStartRun;
}
bblmAdjustRangeParams;

typedef	struct
{
	SInt32		fStartOffset;
	DescType	fLanguage;
} bblmCalcRunParams;

typedef struct
{
	SInt32		fStartOffset;				//	where it should start looking
	SInt32		fLanguageStartOffset;		//	where the embedded language starts
	SInt32		fLanguageEndOffset;			//	where the language ends
	DescType	fLanguage;					//	what language we're checking
	DescType	fParentLanguage;			//	the parent language whose module we're talking to
} bblmFindLanguageEndParams;

typedef struct
{
	SInt32		fEndOffset;
}
bblmAdjustEndParams;

typedef	struct
{
	BBLMCategoryTable	fCategoryTable;
} bblmCategoryParams;

typedef	struct
{
	SInt8		*fToken;
	SInt16		fTokenLength;
	Boolean		fKeywordMatched;
} bblmKeywordParams;

typedef	struct
{
	NSString	*fToken;		//	guaranteed to be non-NIL and non-empty
	NSString	* _Nullable fRunKind;		//	return NIL if there is no match
} bblmWordLookupParams;

typedef	struct
{
	UInt8		*fOutputString;
	UInt8		fOutputStringSize;
} bblmEscCharParams;

typedef struct
{
	SInt16		fGuessResult;
} bblmGuessLanguageParams;

typedef const UInt8 *BBLMPatternPtr;

typedef	struct
{
	DescType		fLanguage;
	Boolean			fDeleting;
	BBLMPatternPtr	fPatternString;
} bblmWordLeftRightStringParams;

typedef struct
{
	UInt32			fRunLanguage;
	NSString		*fRunKind;
	UInt32			fRunStart;
	UInt32			fRunLength;
	Boolean			fRunCanBeSpellChecked;
} bblmCanSpellCheckRunParams;

typedef struct
{
	CFURLRef		_Nullable fInDocumentURL;
	CFStringRef		_Nullable fInPartialSymbol;
	CFRange			fInSelectionRange;
	CFRange			fInProposedCompletionRange;
	BBLMRunRec		fInCompletionRangeStartRun;
	CFRange			fOutAdjustedCompletionRange;
} bblmAdjustCompletionRangeParams;

typedef struct
{
	CFURLRef		fInDocumentURL;
	CFStringRef		fInPartialSymbol;
	CFRange			fInCompletionRange;
	BBLMRunRec		fInCompletionRangeStartRun;
	CFArrayRef		fOutSymbolCompletionArray;
	SInt32			fOutPreferredCompletionIndex;
	BBLMCompletionSymbolLookupFlags
					fOutAdditionalLookupFlags;
} bblmCreateCompletionArrayParams;

typedef struct
{
	BBLMRunRec		fInRunInfo;
	bool			fOutCanCompleteTokensInRun;
} bblmFilterCompletionRunParams;

typedef struct
{
	CFURLRef		_Nullable fInDocumentURL;				//	may be NULL
	CFStringRef		fInIncludeFileString;
	CFURLRef		_Nullable fOutIncludedItemURL;
} bblmResolveIncludeParams;

typedef struct
{
	UniChar			fInTypedCharacter;			//	the character that the user typed
	CFRange			fInSelectionRange;			//	the current selection range
	BBLMRunRec		fInRunInfo;					//	if its runKind is not NIL, this is the run in which
												//	typing is occurring
												
	UniChar			fOutPairingCharacter;		//	when called, its value is the proposed pairing character;
												//	change it to zero to suppress auto-pairing, or change its
												//	value to something else to pair with an alternative character
} bblmAutoPairParams;

typedef struct
{
	NSString		*fInCommandName;			//	one of the values below

	NSDictionary	* _Nullable fInPreferenceSettings;		//	any language-specific custom values from user defaults

					//	call this to find out whether a tool is in $PATH,
					//	to help make appropriate decisions at runtime.
	bool			(^fInFindToolByName)(NSString *);
										
	NSDictionary	* _Nullable fOutCommandDictionary;		//	a populated command dictionary (see documentation for the
												//	command-appropriate format), or nil. If nil, BBEdit
												//	will do its best from information specified in the
												//	language module's info.plist.
} bblmGetCommandDictionaryParams;

typedef struct
{
	NSString		*fInProposedWord;
	NSUInteger		fInWordStartOffset;
	NSUInteger		fInWordEndOffset;
	
	NSString		*fOutCalculatedWord;
	NSUInteger		fOutWordStartOffset;
	NSUInteger		fOutWordEndOffset;
} bblmWordForLookupParams;

typedef struct
{
	NSString		*fInTextToFormat;	//	the text to be formatted
	NSRange			fInSelectionRange;	//	the current selection range in the document; for
										//	kBBLMCreateReformattedDocumentTextMessage this is within
										//	fInTextToFormat, for kBBLMCreateReformattedSelectionTextMessage this is 
										//	within the entire document text (fTextPtr/fTextLength).
	uint32_t		fInSpacesPerTab;	//	the tab width of the input, based on current editor settings
	bool			fInPreferSpaces;	//	if true, use spaces for indentation; otherwise use tabs
	bool			fInNewlineAtEnd;	//	if true, ensure that the formatted text ends with a line break.
										//		(this does not apply to kBBLMCreateReformattedSelectionTextMessage,
										//		in which the formatter will have to determine that from context).
	NSString		*fOutFormattedText;	//	the formatted text. This is created; the application *will*
										//		release it
	NSRange			fOutAdjustedSelectionRange;
										//	If you are able to calculate an updated selection range while
										//	formatting, set this to the range of text that should be selected
										//	after formatting. Otherwise, leave this alone (it defaults to
										//	{ NSNotFound, 0 }).
	bool			fOutFormattedTextNeedsEntabbing;
										//	if true, the pretty printer used spaces for indentation.
										//	In that case, BBEdit will convert space runs to tabs based
										//	on the current tab width after the output is returned.
} bblmReformatParams;

//	keys and values for command dictionary
DECLARE_GLOBAL_STRING_NS(kBBLMCommandNameKey);							//	values are also used for fInCommandName
DECLARE_GLOBAL_STRING_NS(kBBLMCommandOperationCheckSyntax);
DECLARE_GLOBAL_STRING_NS(kBBLMCommandOperationRun);
DECLARE_GLOBAL_STRING_NS(kBBLMCommandOperationDebug);
DECLARE_GLOBAL_STRING_NS(kBBLMCommandOperationShowDoc);
DECLARE_GLOBAL_STRING_NS(kBBLMCommandOperationGenerateHTML);

DECLARE_GLOBAL_STRING_NS(kBBLMCommandTypeKey);
DECLARE_GLOBAL_STRING_NS(kBBLMCommandTypeUnixCommand);
DECLARE_GLOBAL_STRING_NS(kBBLMCommandTypeScriptInBundleResource);

DECLARE_GLOBAL_STRING_NS(kBBLMCommandPathKey);							//	file name or path to executable
DECLARE_GLOBAL_STRING_NS(kBBLMCommandArgumentsKey);						//	array of arguments passed to the command
DECLARE_GLOBAL_STRING_NS(kBBLMCommandOptionsKey);							//	options to modify the command's behavior:
DECLARE_GLOBAL_STRING_NS(kBBLMCommandOptionUseSTDIOKey);					//	if present and YES, command reads from stdin
																		//		and writes to stdout (i.e. a filter)
DECLARE_GLOBAL_STRING_NS(kBBLMCommandOptionRunInTerminalKey);				//	if present and YES, run this command using Terminal
DECLARE_GLOBAL_STRING_NS(kBBLMCommandOptionParseErrorsFromSTDERRKey);		//	if present and YES, parse errors from stderr
DECLARE_GLOBAL_STRING_NS(kBBLMCommandOptionParseErrorsFromSTDOUTKey); 	//	if present and YES, parse errors from
																		//		stdout (instead of stderr)
DECLARE_GLOBAL_STRING_NS(kBBLMCommandOptionErrorParsePatternKey);			//	error parse pattern (see bbresults(1) docs)
DECLARE_GLOBAL_STRING_NS(kBBLMCommandOptionOutputWarningsByDefaultKey);	//	if present and YES, generate warnings if
																		//		the type of error result isn't parseable
DECLARE_GLOBAL_STRING_NS(kBBLMCommandOptionAlwaysRunWholeDocumentKey);	//	if present and YES, run the entire document even
																		//		if only a subrange is selected
																		//		(applies only if using stdin/out)
typedef struct
{
	UInt32	fCharsDeleted;
	UInt32	fCharsInserted;
	UInt32	fChangePosition;
} bblmUpdateParseDataParams;

#define	kBBLMParamBlockSignature	'R*ch'		//	parameter block signature
#define	kBBLMParamBlockVersion		11			//	current parameter block version (BBEdit 14.7+)
#define	kBBLMMinimumCompatibleParamBlockVersion \
									8			//	minimum parameter block version
												//	that is compatible with these APIs.
												//	Version 8 corresponds to BBEdit 11.0.
class	CTextStorage;

typedef	struct
{
	OSType					fSignature;			//	must always be kBBLMParamBlockSignature
	UInt32					fVersion;			//	parameter block version
	UInt32					fLength;			//	must always be >= sizeof(BBLMParamBlock)
	
	UInt8					fMessage;			//	input message (see BBLMMessage)
	UInt32					fLanguage;			//	language code
	
	UniChar					* _Nullable fText;				//	pointer to text to be scanned
	UInt32					fTextLength;		//	length of text to be scanned
	UInt32					fTextGapLocation;	//	location of "gap" in text (zero if text is contiguous)
	UInt32					fTextGapLength;		//	length of text gap (zero if text is contiguous)
	
	union
	{
		bblmFcnParams					fFcnParams;
		bblmAdjustRangeParams			fAdjustRangeParams;
		bblmCalcRunParams				fCalcRunParams;
		bblmAdjustEndParams				fAdjustEndParams;
		bblmCategoryParams				fCategoryParams;
		bblmKeywordParams				fMatchKeywordParams;
		bblmEscCharParams				fEscapeCharParams;
		bblmGuessLanguageParams			fGuessLanguageParams;
		bblmWordLeftRightStringParams	fWordLeftRightStringParams;
		bblmCanSpellCheckRunParams		fCanSpellCheckRunParams;
		bblmWordLookupParams			fWordLookupParams;
		bblmScanSubrangeForFcnParams	fScanSubrangeForFcnParams;
		bblmCreateLanguageDictParams	fCreateLanguageDictParams;
		bblmFindLanguageEndParams		fFindLanguageEndParams;
		bblmAdjustCompletionRangeParams	fAdjustCompletionRangeParams;
		bblmFilterCompletionRunParams	fFilterCompletionRunParams;
		bblmCreateCompletionArrayParams	fCreateCompletionArrayParams;
		bblmResolveIncludeParams		fResolveIncludeParams;
		bblmAutoPairParams				fAutoPairParams;
		bblmUpdateParseDataParams		fUpdateParseDataParams;
		bblmGetCommandDictionaryParams	fGetCommandDictionaryParams;
		bblmWordForLookupParams			fWordForLookupParams;
		bblmReformatParams				fReformatParams;
	};
	
	//	These are to create space for future expansion. They are a third rail.
	UInt32					_reserved0;
	UInt32					_reserved1[54];
	
	//	for storing and managing document-specific parse data
	NSObject				* _Nullable fDocumentParseData;
	bool					fOutDocumentParseDataIsNew;
	NSUUID					* _Nullable fDocumentIdentifier;
	NSURL					* _Nullable fDocumentLocation;

	//	used internally.
	CTextStorage			*fPrivateTextStorage;

	//	Fields here are not available before version 11, so check the parameter block
	//	version before attempting to access them.
	
	//	for convenience in obtaining data out of the language module
	//	properties
	NSDictionary			* _Nullable fLanguageModuleProperties;
} BBLMParamBlock;

typedef struct _OpaqueBBLMFoldList	BBLMFoldList;
typedef struct _BBLMFoldTuple
{
	int64_t			start;
	int64_t			end;
	BBLMFoldKind	kind;
	BBLMFoldList	* _Nullable children;
} BBLMFoldTuple;

typedef	struct
{
	OSType		fSignature;			//	must always be BBEdit's application signature ("R*ch")
	UInt32		fVersion;			//	reflects current callback version (see kBBLMCurrentCallbackVersion)
	
//	version 1 callbacks

		//
		//	these callbacks are used when messages == kBBLMScanForFunctionsMessage,
		//	and are NIL at all other times.
		//
		
		//
		//	use these callbacks to make the token buffer and proc list empty.
		//	BBEdit will do this for you when your plug-in is called; these
		//	are just for convenience.
		//
		
		OSErr		(* _Nonnull fResetTokenBuffer)(void *tokenBuffer);			// Available in callback version 1 and later
		OSErr		(* _Nonnull fResetProcList)(void *procList);					// Available in callback version 1 and later
		
		//
		//	these callbacks are used in tandem to add a function to the list. When
		//	you've found a function or other item to be added to the function popup,
		//	call fAddTokenToBuffer() to add its name to the token buffer. If successful, the
		//	"offset" parameter will contain a value which should then be passed
		//	as the second argument to fAddFunctionToList(). If you need to change a
		//	entry after adding it to the list, call fUpdateFunctionEntry(), using the
		//	index obtained from a previous fAddFunctionToList() call.
		//
		
		OSErr		(* _Nonnull fAddTokenToBuffer)(void *tokenBuffer,				//	-> token buffer instance passed in fFcnParams
											const UniChar *token,		//	-> points to identifier text (Unicode characters)
											const UInt32 length,		//	-> length of identifier text (in characters)
											UInt32 *offset);			//	<- offset at which token was inserted
																		//
																		// Available in callback version 1 and later
											
		OSErr		(* _Nonnull fAddFunctionToList)(void *procList,				//	-> function list instance passed in fFcnParams
											BBLMProcInfo &info,			//	-> function info record
											UInt32 *index);				//	<- zero-based index of this function's entry
																		//
																		// Available in callback version 1 and later
		
		OSErr		(* _Nonnull fGetFunctionEntry)(void *procList,				//	-> function list instance passed in fFcnParams
											UInt32 index,				//	-> zero-based index of function entry to fetch
											BBLMProcInfo &new_info);	//	<- function info record from list
																		//
																		// Available in callback version 1 and later
											
		OSErr		(* _Nonnull fUpdateFunctionEntry)(void *procList,				//	-> function list instance passed in fFcnParams
											UInt32 index,				//	-> zero-based index of function entry to change
											BBLMProcInfo &new_info);	//	-> function info record containing new information
																		//
																		// Available in callback version 1 and later
																		
	//
	//	these callbacks are used when fMessage is kBBLMAdjustRangeMessage,
	//	kBBLMCalculateRunsMessage, or kBBLMAdjustEndMessage and are NIL at
	//	all other times.
	//
	
	SInt32		(* _Nonnull fRunCount)(void);							//	current number of runs. zero if no runs yet
															//	defined. negative if run list is undefined
															//	(usually a result of an allocation failure).
	
	Boolean		(* _Nonnull fGetRun)(	SInt32 index,					//	get a run
							DescType& language,				//	language code
							NSString* _Nullable &kind,		//	run kind
							SInt32& charPos,				//	character position of run start
							SInt32& length);				//	number of characters in run
	
	SInt32		(* _Nonnull fFindRun)( SInt32 offset );				//	find run containing char offset
															//	returns -1 if not found
				
	Boolean		(* _Nonnull fAddRun)(									//	add a new run. returns false if no more runs needed
							DescType language,				//	language code
							NSString* kind,					//	run kind
							SInt32 startPos,				//	character position of run start
							SInt32 length,					//	number of characters in run
							bool dontMerge);				//	when updating a run list, don't return false
															//	to stop scanning even if this new run
															//	matches an old one
	
	void		(* _Nonnull fFlushRuns)(void);						//	flush any runs added with fAddRun that may
															//	currently be buffered.

//	version 3 callbacks

	//	this callback is used when messages == kBBLMScanForFunctionsMessage
	
	OSErr		(* _Nonnull fAddCFStringTokenToBuffer)(void *tokenBuffer,	//	-> token buffer instance passed in fFcnParams
											 CFStringRef string,	//	-> string used for identifier text
											 UInt32 *offset);		//	<- offset at which token was inserted
																	//
																	// Available in callback version 3 and later

//	version 4 callbacks

	//	this callback may be used when messages == kBBLMSetCategoriesMessage
	
	void		(* _Nonnull fSetUnicodeCategoryTable)
						(BBLMUnicodeCategoryTable &categoryTable);	//	-> if called, callee makes internal copy of this
																	//		table and ignores table in fCategoryParams
																	//
																	// Available in callback version 4 and later


//	version 5 callbacks

	//	this callback may be used when messages == kBBLMScanForFoldRanges
	//								or messages == kBBLMScanForFunctionsMessage
	
	OSErr		(* _Nonnull fAddFoldRange)(SInt32 startPos,					//	character position of first char to be folded
								 SInt32 length,						//	number of characters to be folded
								 BBLMFoldKind foldKind);			//	type of fold (defaults to kBBLMGenericAutoFold)

//	version 6 callbacks

	//	this callback may be used when messages == kBBLMCalculateRunsMessage
	OSErr		(* _Nonnull fFindEmbeddedLanguageRunsInRange)(const DescType language,
													BBLMParamBlock &myParams,
													const SInt32 startOffset,
													const SInt32 rangeLength,
													bool &continueScanning);
	
	OSErr		(* _Nonnull fFindEmbeddedLanguageFunctionsInRange)(const DescType language,
															BBLMParamBlock &myParams,
															const SInt32 startOffset,
															const SInt32 rangeLength);

//	version 7 callbacks - alternative fold generation

	BBLMFoldList* _Nullable
				(* _Nonnull fCreateFoldList)(void);
	void		(* _Nonnull fDisposeFoldList)(BBLMFoldList * _Nullable foldList);
	
	uint32_t	(* _Nonnull fAddFoldToFoldList)(BBLMFoldList *foldList,
										const int64_t start,
										const int64_t end,
										const BBLMFoldKind kind);
	uint32_t	(*fCountFoldList)(BBLMFoldList *foldList);
	BBLMFoldTuple* _Nullable
				(* _Nonnull fGetFoldTupleByIndex)(BBLMFoldList * _Nonnull foldList, const uint32_t tupleIndex);
	void		(* _Nonnull fIngestFoldList)(BBLMFoldList *foldList);

//	version 8 callbacks

	NSArray<NSDictionary*>* _Nonnull
				(* _Nonnull fGetInstalledLanguages)(void);
	
	DescType	(* _Nonnull fGetLanguageCodeForName)(NSString *languageNameOrEmacsMode);
	
} BBLMCallbackBlock;

#pragma mark -

#ifdef	__cplusplus

//	these inlines should be used in preference to directly accessing the members of the BBLMCallbackBlock

#pragma mark Function Scanner Callbacks

inline	OSErr	bblmResetTokenBuffer(const BBLMCallbackBlock *callbacks, void *tokenBuffer)
					{ return callbacks->fResetTokenBuffer(tokenBuffer); }

inline	OSErr	bblmResetProcList(const BBLMCallbackBlock *callbacks, void *procList)
					{ return callbacks->fResetProcList(procList); }

inline	OSErr	bblmAddTokenToBuffer(const BBLMCallbackBlock *callbacks,
										void *tokenBuffer,
										const UniChar *token,
										const UInt32 length,
										UInt32 *offset)
{
	return callbacks->fAddTokenToBuffer(tokenBuffer, token, length, offset);
}

inline	OSErr	bblmAddCFStringTokenToBuffer(const BBLMCallbackBlock *callbacks,
											 void *tokenBuffer,
											 CFStringRef string,
											 UInt32 *offset)
{
	if (kBBLMCurrentCallbackVersion >= 3)
		return callbacks->fAddCFStringTokenToBuffer(tokenBuffer, string, offset);
	
	return paramErr;
}

inline	OSErr	bblmAddFunctionToList(const BBLMCallbackBlock *callbacks,
										void *procList,
										BBLMProcInfo &info,
										UInt32 *index)
{
	return callbacks->fAddFunctionToList(procList, info, index);
}

inline	OSErr	bblmGetFunctionEntry(const BBLMCallbackBlock *callbacks,
										void *procList,
										UInt32 index,
										BBLMProcInfo &info)
{
	return callbacks->fGetFunctionEntry(procList, index, info);
}

inline	OSErr	bblmUpdateFunctionEntry(const BBLMCallbackBlock *callbacks,
										void *procList,
										UInt32 index,
										BBLMProcInfo &new_info)
{
	return callbacks->fUpdateFunctionEntry(procList, index, new_info);
}

inline	//	this is one-call alternative to using bblmAddCFStringTokenToBuffer() followed by bblmAddFunctionToList().
OSStatus	bblmAddFunctionToList(const BBLMCallbackBlock *callbacks,
									void *tokenBuffer,
									void *procList,
									CFStringRef name,
									BBLMProcInfo &info,
									UInt32 *index)
{
	OSStatus	err = noErr;
	
	//	basic parameter validation
	__Require_Action(nil != callbacks, EXIT, err = paramErr);
	__Require_Action(nil != tokenBuffer, EXIT, err = paramErr);
	__Require_Action(nil != procList, EXIT, err = paramErr);
	__Require_Action(nil != name, EXIT, err = paramErr);
	
	__Require_noErr(err = bblmAddCFStringTokenToBuffer(callbacks,
														tokenBuffer,
														name,
														&info.fNameStart),
					EXIT);
	
	__Require_noErr(err = bblmAddFunctionToList(callbacks,
												procList,
												info,
												index),
					EXIT);
	
EXIT:
	return err;
}

inline	//	this is just the above, with an NSString parameter so that there's no need for a cast.
OSStatus	bblmAddFunctionToList(const BBLMCallbackBlock *callbacks,
									void *tokenBuffer,
									void *procList,
									NSString *name,
									BBLMProcInfo &info,
									UInt32 *index)
{
	return bblmAddFunctionToList(callbacks,
									tokenBuffer,
									procList,
									static_cast<CFStringRef>(name),
									info,
									index);
}

#pragma mark -
#pragma mark Syntax Coloring Callbacks

inline	SInt32		bblmRunCount(const BBLMCallbackBlock *callbacks)
{
	return callbacks->fRunCount();
}										

inline	bool		bblmGetRun(const BBLMCallbackBlock *callbacks,
								SInt32 index,
								DescType& language,
								NSString* _Nullable &kind,
								SInt32& charPos,
								SInt32& length)
{
	return callbacks->fGetRun(index, language, kind, charPos, length);
}										

inline	bool		bblmGetRun(const BBLMCallbackBlock *callbacks,
								SInt32 index,
								BBLMRunRec &runInfo)
{
	SInt32	runLength = 0;

	if (bblmGetRun(callbacks, index, runInfo.language, runInfo.runKind, runInfo.startPos, runLength))
	{
		runInfo.depth = 0;
		runInfo.length = runLength;
		
		return true;
	}
	
	return false;
}

inline	SInt32		bblmFindRun(const BBLMCallbackBlock *callbacks,
								SInt32 offset)
{
	return callbacks->fFindRun(offset);
}										

inline	bool		bblmAddRun(const BBLMCallbackBlock *callbacks,
								DescType language,
								NSString *kind,
								SInt32 charPos,
								SInt32 length,
								bool dontMerge = false)
{
	return callbacks->fAddRun(language, kind, charPos, length, dontMerge);
}										

inline	void		bblmFlushRuns(const BBLMCallbackBlock *callbacks)
{
	callbacks->fFlushRuns();
}										

inline	OSErr		bblmSetUnicodeCategoryTable(const BBLMCallbackBlock *callbacks,
													BBLMUnicodeCategoryTable &categoryTable)
{
	OSErr result = noErr;
	
	if (kBBLMCurrentCallbackVersion >= 4)
		callbacks->fSetUnicodeCategoryTable(categoryTable);
	else
		result = paramErr;
	
	return result;
}										

inline	OSErr		bblmAddFoldRange(const BBLMCallbackBlock *callbacks,
										SInt32 startPos,
										SInt32 length,
										BBLMFoldKind foldKind = kBBLMGenericAutoFold)
{
	return callbacks->fAddFoldRange(startPos, length, foldKind);
}										

inline	OSErr		bblmFindEmbeddedLanguageRunsInRange(const BBLMCallbackBlock *callbacks,
														const DescType language,
														BBLMParamBlock &myParams,
														const SInt32 startOffset,
														const SInt32 rangeLength,
														bool &continueScanning)
{
	return callbacks->fFindEmbeddedLanguageRunsInRange(language,
															myParams,
															startOffset,
															rangeLength,
															continueScanning);
}
	
inline	OSErr		bblmFindEmbeddedLanguageFunctionsInRange(const BBLMCallbackBlock *callbacks,
																const DescType language,
																BBLMParamBlock &myParams,
																const SInt32 startOffset,
																const SInt32 rangeLength)
{
	return callbacks->fFindEmbeddedLanguageFunctionsInRange(language,
															myParams,
															startOffset,
															rangeLength);
}

inline
BBLMFoldList*	bblmCreateFoldList(const BBLMCallbackBlock *callbacks)
{
	return callbacks->fCreateFoldList();
}

inline
void	bblmDisposeFoldList(const BBLMCallbackBlock *callbacks, BBLMFoldList * _Nullable foldList)
{
	callbacks->fDisposeFoldList(foldList);
}

inline
uint32_t	bblmAddFoldToFoldList(const BBLMCallbackBlock *callbacks,
										BBLMFoldList *foldList,
										const int64_t start,
										const int64_t end,
										const BBLMFoldKind kind)
{
	return callbacks->fAddFoldToFoldList(foldList, start, end, kind);
}

inline
BBLMFoldTuple*	bblmGetFoldTupleByIndex(const BBLMCallbackBlock *callbacks,
										BBLMFoldList *foldList,
										const uint32_t tupleIndex)
{
	return callbacks->fGetFoldTupleByIndex(foldList, tupleIndex);
}

inline
UInt32	bblmCountFoldList(const BBLMCallbackBlock *callbacks, BBLMFoldList *foldList)
{
	return callbacks->fCountFoldList(foldList);
}

inline
void	bblmIngestFoldList(const BBLMCallbackBlock *callbacks, BBLMFoldList *foldList)
{
	callbacks->fIngestFoldList(foldList);
}

inline
NSArray<NSDictionary*>*	bblmGetInstalledLanguages(const BBLMCallbackBlock *callbacks)
{
	return callbacks->fGetInstalledLanguages();
}

inline
DescType	bblmGetLanguageCodeForName(const BBLMCallbackBlock *callbacks, NSString *languageNameOrEmacsMode)
{
	return callbacks->fGetLanguageCodeForName(languageNameOrEmacsMode);
}

//
//	Use BBLMCharacterIsLineBreak() instead of explicitly testing against \r or \n.
//	This will ensure compatibility with past and future versions of BBEdit and
//	TextWrangler.
//

inline
bool	BBLMCharacterIsLineBreak(const UniChar ch) __attribute__((const, always_inline));

inline
bool	BBLMCharacterIsLineBreak(const UniChar ch)
{
	return ('\r' == ch) || ('\n' == ch);
}

//
//	Use BBLMCharacterIsBlankOrTab() instead of explicitly testing character values.
//	This will ensure compatibility with past and future versions of BBEdit and
//	TextWrangler.
//

inline
bool	BBLMCharacterIsBlankOrTab(const UniChar ch) __attribute__((const, always_inline));

inline
bool	BBLMCharacterIsBlankOrTab(const UniChar ch)
{
	return (' ' == ch) || ('\t' == ch);
}

#else

#error	"Sorry, there is no callback macro support for C."

#endif

NS_ASSUME_NONNULL_END

#endif // BBLMINTERFACE_h
