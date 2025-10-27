# from typing import Optional

# def to_init_caps(name: Optional[str]) -> Optional[str]:
#     if not name:
#         return name
#     return ' '.join(word.capitalize() for word in name.split())

# from typing import Optional

# def to_init_caps(name: Optional[str]) -> Optional[str]:
#     if not name:
#         return name

#     def format_word(word):
#         # If the word is full uppercase, keep as is
#         if word.isupper():
#             return word
#         # Otherwise, capitalize only the first letter
#         return word[:1].upper() + word[1:].lower()

#     return ' '.join(format_word(word) for word in name.split())

import asyncio
from typing import Optional

async def to_init_caps(name: Optional[str]) -> Optional[str]:
    def _sync_to_init_caps(name_inner: Optional[str]) -> Optional[str]:
        if not name_inner:
            return name_inner

        def format_word(word):
            if word.isupper():
                return word
            return word[:1].upper() + word[1:].lower()

        return ' '.join(format_word(word) for word in name_inner.split())

    return await asyncio.to_thread(_sync_to_init_caps, name)
