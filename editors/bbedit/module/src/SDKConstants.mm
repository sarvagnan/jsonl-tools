//
//	Compiles the SDK's global string constants (run kinds, function types,
//	command dictionary keys) into the module. The SDK source expects
//	Foundation and CoreServices to already be visible.
//

#include <objc/objc.h>

#define __ASSERT_MACROS_DEFINE_VERSIONS_WITHOUT_UNDERSCORES 1
#include <AssertMacros.h>

#import <Foundation/Foundation.h>
#include <CoreServices/CoreServices.h>

#include "BBLMInterface.mm"
