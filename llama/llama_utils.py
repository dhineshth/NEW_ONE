import os
from llama_parse import LlamaParse
from typing import Optional

# def initialize_llama_parser(result_type: str = "json", api_key: str = None) -> Optional[LlamaParse]:
#     """
#     Initializes LlamaParse with the given result type and API key.
#     :param result_type: 'json' or 'text'
#     :param api_key: Company-specific API key or None to use environment variable
#     :return: LlamaParse object or None
#     """
#     try:
#         # Use provided API key or fall back to environment variable
#         final_api_key = api_key or os.getenv("LLAMA_CLOUD_API_KEY")
#         if not final_api_key:
#             raise ValueError("No Llama API key provided and LLAMA_CLOUD_API_KEY environment variable not set.")
        
#         return LlamaParse(
#             api_key=final_api_key,
#             result_type=result_type,
#             verbose=True
#         )
#     except Exception as e:
#         raise Exception(f"LlamaParse initialization failed: {str(e)}")

# def parse_resume_with_llama(file_path: str, parser: LlamaParse) -> Optional[str]:
#     """
#     Parse the resume using a given LlamaParse parser.
#     :param file_path: Path to resume PDF
#     :param parser: LlamaParse instance
#     :return: Extracted text
#     """
#     try:
#         documents = parser.load_data(file_path)
#         if documents:
#             return documents[0].text
#         else:
#             raise Exception("No documents returned from parser.")
#     except Exception as e:
#         raise Exception(f"LlamaParse failed: {str(e)}")
import os
import asyncio
from llama_parse import LlamaParse
from typing import Optional

# ---------- ASYNC INITIALIZATION ----------
async def initialize_llama_parser(result_type: str = "json", api_key: str = None) -> Optional[LlamaParse]:
    """
    Initializes LlamaParse asynchronously with the given result type and API key.
    :param result_type: 'json' or 'text'
    :param api_key: Company-specific API key or None to use environment variable
    :return: LlamaParse object or None
    """
    def _init_sync():
        final_api_key = api_key or os.getenv("LLAMA_CLOUD_API_KEY")
        if not final_api_key:
            raise ValueError("No Llama API key provided and LLAMA_CLOUD_API_KEY environment variable not set.")
        return LlamaParse(
            api_key=final_api_key,
            result_type=result_type,
            verbose=True
        )
    
    try:
        return await asyncio.to_thread(_init_sync)
    except Exception as e:
        raise Exception(f"LlamaParse initialization failed: {str(e)}")


# ---------- ASYNC PARSING ----------
async def parse_resume_with_llama(file_path: str, parser: LlamaParse) -> Optional[str]:
    """
    Parse the resume asynchronously using a given LlamaParse parser.
    :param file_path: Path to resume PDF
    :param parser: LlamaParse instance
    :return: Extracted text
    """
    def _parse_sync():
        documents = parser.load_data(file_path)
        if documents:
            return documents[0].text
        else:
            raise Exception("No documents returned from parser.")
    
    try:
        return await asyncio.to_thread(_parse_sync)
    except Exception as e:
        raise Exception(f"LlamaParse failed: {str(e)}")
