#ifndef BBLMTEXTITERATOR_h
#define BBLMTEXTITERATOR_h 1

#include <stddef.h>
#include <ctype.h>
#include <string.h>
#include <iterator>

#include "BBLMInterface.h"

class BBLMTextIterator : std::iterator<std::random_access_iterator_tag, UniChar>
{
	private:
		
		const UniChar *         fTextPtr;
		const size_t            fTextLen;
		const UniChar * const 	fGapLoc;
		const size_t            fGapLen;
		const UniChar * const   fTextStart;
		const UniChar * const   fTextEnd;
		
		const UniChar* AddOffset(const ssize_t offset) const
			{
				if (0 == fGapLen)	//	fast path
					return fTextPtr + offset;
					
				const bool		wasPreGap	= (fTextPtr < fGapLoc);
				const UniChar*	result		= fTextPtr + offset;
				
				if (offset < 0)
				{
					if (!wasPreGap && result < (fGapLoc + fGapLen))
						result -= fGapLen;
				}
				else
				{
					if (wasPreGap && result >= fGapLoc)
						result += fGapLen;
				}
				
				return result;
			}
		
		BBLMTextIterator();
		
	public:
		
		BBLMTextIterator(const BBLMParamBlock& params)
            :
                fTextLen(params.fTextLength),
                fGapLoc(params.fText + params.fTextGapLocation),
                fGapLen(params.fTextGapLength),
                fTextStart(params.fText
                        + (params.fTextGapLocation == 0 ? fGapLen : 0)),
                fTextEnd(params.fText + fTextLen
                        + (params.fTextGapLocation <= fTextLen ? fGapLen : 0))
			{
				fTextPtr = (UniChar*)fTextStart;
			}

		BBLMTextIterator(const BBLMParamBlock& params, const ssize_t offset)
            :
                fTextLen(params.fTextLength),
                fGapLoc(params.fText + params.fTextGapLocation),
                fGapLen(params.fTextGapLength),
                fTextStart(params.fText
                           + (params.fTextGapLocation == 0 ? fGapLen : 0)),
                fTextEnd(params.fText + fTextLen
                         + (params.fTextGapLocation <= fTextLen ? fGapLen : 0))
			{
                fTextPtr = (UniChar*)fTextStart;
				fTextPtr = AddOffset(offset);
			}
		
		BBLMTextIterator(const BBLMParamBlock& params, const ssize_t offset, const ssize_t textLength)
            :
                fTextLen(textLength),
                fGapLoc(params.fText + params.fTextGapLocation),
                fGapLen(params.fTextGapLength),
                fTextStart(params.fText
                           + (params.fTextGapLocation == 0 ? fGapLen : 0)),
                fTextEnd(params.fText + textLength + offset
                         + ((textLength + offset) >= params.fTextGapLocation ? fGapLen : 0))
			{
                fTextPtr = (UniChar*)fTextStart;
				fTextPtr = AddOffset(offset);
			}
		
		BBLMTextIterator(const BBLMTextIterator& iter)
			: fTextPtr  (iter.fTextPtr),   fTextLen(iter.fTextLen),
			  fGapLoc   (iter.fGapLoc),    fGapLen    (iter.fGapLen),
			  fTextStart(iter.fTextStart), fTextEnd   (iter.fTextEnd)
			{ /*...*/ }
		
		BBLMTextIterator(const BBLMTextIterator& iter, const ssize_t offset)
			: fTextPtr  (iter.fTextPtr),   fTextLen(iter.fTextLen),
			  fGapLoc   (iter.fGapLoc),    fGapLen    (iter.fGapLen),
			  fTextStart(iter.fTextStart), fTextEnd   (iter.fTextEnd)
			{ fTextPtr = AddOffset(offset); }

		inline
		UniChar operator*() const
			{
				if ((fTextPtr >= fTextEnd) || (fTextPtr < fTextStart))
					return 0;

				return(*fTextPtr);
			}

		inline
		UniChar operator[](const ssize_t index) const
			{
				const UniChar*	result = AddOffset(index);
				
				if ((result >= fTextEnd) || (result < fTextStart))
					return 0;
				
				return(*result);
			}
		
		BBLMTextIterator& operator++(void)
			{
				fTextPtr++;
				if (fTextPtr == fGapLoc)
					fTextPtr += fGapLen;
				return *this;
			}

		BBLMTextIterator operator++(int)
			{
			    BBLMTextIterator old(*this);
			    operator++();
				return old;
			}
		
		inline
		BBLMTextIterator& operator +=(const ptrdiff_t delta)
			{ fTextPtr = AddOffset(delta); return *this; }
		
		inline
		BBLMTextIterator operator +(const ptrdiff_t delta)
			{ return BBLMTextIterator(*this, delta); }
		
		inline
		BBLMTextIterator& operator--(void)
			{
				if (fTextPtr == (fGapLoc + fGapLen))
					fTextPtr -= fGapLen;
					
				fTextPtr--;
				return *this;
			}

		BBLMTextIterator operator--(int)
			{
			    BBLMTextIterator old(*this);
			    operator--();
				return old;
			}
		
		inline
		BBLMTextIterator& operator -=(const ptrdiff_t delta)
			{ fTextPtr = AddOffset(-delta); return *this; }
		
		inline
		BBLMTextIterator operator -(const ptrdiff_t delta)
			{ return BBLMTextIterator(*this, -delta); }
		
		inline
		bool operator ==(const BBLMTextIterator& alter)
			{ return fTextPtr == alter.fTextPtr; }

		inline
		bool operator !=(const BBLMTextIterator& alter)
			{ return fTextPtr != alter.fTextPtr; }

		inline
		bool operator >(const BBLMTextIterator& alter)
			{ return fTextPtr > alter.fTextPtr; }

		inline
		bool operator >=(const BBLMTextIterator& alter)
			{ return fTextPtr >= alter.fTextPtr; }

		inline
		bool operator <(const BBLMTextIterator& alter)
			{ return fTextPtr > alter.fTextPtr; }

		inline
		bool operator <=(const BBLMTextIterator& alter)
			{ return fTextPtr >= alter.fTextPtr; }

		inline
		BBLMTextIterator& operator =(const BBLMTextIterator & alter)
			{ fTextPtr = alter.fTextPtr; return *this; }

        // Special operator to allow iter = 0 expressions.
        inline
		BBLMTextIterator& operator =(const ptrdiff_t newPos)
			{ SetOffset(newPos); return *this; }

		inline
		const UniChar* Address(void) const
			{ return fTextPtr; }
		
		inline
		int32_t Offset(void) const
			{
				ptrdiff_t result = (fTextPtr - fTextStart);
				
				if (fTextPtr >= fGapLoc && fTextStart < fGapLoc)
					result -= fGapLen;
				
				//	really we should declare and return ssize_t, but that'll
				//	upset a lot of client code...
				return static_cast<int32_t>(result);
			}
		
		inline
		void SetOffset(const ssize_t newPos)
			{
				ssize_t delta = (0 - Offset()) + newPos;
				
				fTextPtr = AddOffset(delta);
			}
		
		void MoveToBegin(void)
		    {
		        fTextPtr = (UniChar*)fTextStart;
		    }

		void MoveToEnd(void)
		    {
		        fTextPtr = (UniChar*)fTextEnd;
		    }

		inline
		size_t CharsLeft(void) const
			{
				//
				//	NB: we can't use fTextLen here because that's the length of the
				//	text in the container. We have to rely on the specified bounds
				//	of the iterator (fTextEnd and fTextStart) and account for the gap
				//	when we do the math.
				//
				ptrdiff_t	len = (fTextEnd - fTextStart);
				ssize_t		result = 0;
				
				if ((fTextEnd >= fGapLoc) && (fTextStart < fGapLoc))
					len -= fGapLen;
				
				result = len - Offset();
				if (result < 0)
					result = 0;
				
				return result;
			}
		
		inline
		bool InBounds() const
			{ return (fTextPtr >= fTextStart && fTextPtr < fTextEnd); }
		
		inline
		UniChar GetNextChar()
			{
				if (fTextPtr >= fTextEnd)
					return 0;
				
				UniChar result = **this;
				
				++(*this);
				
				return result;
			}
		
		inline
		UniChar GetPrevChar()
			{
				--(*this);
				
				if (fTextPtr <= fTextStart)
					return '\r';
				
				return (*this)[-1];
			}
		
		template <class CharXX>
		inline
		size_t strlen(const CharXX *str)
			{
				size_t len = 0;
				
				str--;
				
				while (*++str != 0)
					len++;
				
				return(len);
			}

		// DRSWAT: function for sanitizing comparison results down to an int that is precisely -1, 0, or 1.
		// Necessary for 64-bit to deal with precision loss compiler errors.
		template <class _signedIntT>
		static inline int MakeComparisonResult(_signedIntT inDelta)
		{
			return (static_cast<int>(inDelta > 0) - static_cast<int>(inDelta < 0));
		}

		template <class CharXX>
		inline int strcmp(const CharXX *str, size_t n)
			{
				BBLMTextIterator	p = *this;
				unsigned long			c1, c2;
				
				//
				//	edge case here: if we're at the end, but there are
				//	characters left in the string, then we are done.
				//	Otherwise we'll return a false match.
				//
				
				if ((0 == *p) && (0 != n))
					return -1;
					
				str--;
				n++;
				
				while (--n && fTextPtr < fTextEnd)
				{
					c1 = p.GetNextChar();
					c2 = *++str;
					
					if (c1 != c2)
						return MakeComparisonResult(c1 - c2);
				}
				
				return(0);
			}

		template <class CharXX>
		inline int strcmp(const CharXX *str)
			{
				return strcmp(str, strlen(str));
			}
		
		template <class CharXX>
		inline int stricmp(const CharXX *str, size_t n)
			{
				BBLMTextIterator	p = *this;
				unsigned long			c1, c2;
				
				//
				//	edge case here: if we're at the end, but there are
				//	characters left in the string, then we are done.
				//	Otherwise we'll return a false match.
				//
				
				if ((0 == *p) && (0 != n))
					return -1;
					
				str--;
				n++;
				
				while (--n && fTextPtr < fTextEnd)
				{
					c1 = p.GetNextChar();
					c2 = *++str;
					
					if ((c1 & ~0x7FU) == 0)
						c1 = tolower(static_cast<int>(c1));
					
					if ((c2 & ~0x7FU) == 0)
						c2 = tolower(static_cast<int>(c2));
					
					if (c1 != c2)
						return MakeComparisonResult(c1 - c2);
				}
				
				return(0);
			}
		
		template <class CharXX>
		inline int stricmp(const CharXX *str)
			{
				return stricmp(str, strlen(str));
			}
};

#endif	// BBLMTEXTITERATOR_h
