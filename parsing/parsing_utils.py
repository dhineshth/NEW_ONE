# import re
# import os
# from PyPDF2 import PdfReader
# import docx2txt
# from pdfminer.high_level import extract_text
# from typing import Optional
# from llama.llama_utils import parse_resume_with_llama
# from llama_parse import LlamaParse

# def extract_email(resume_text: str) -> str:
#     email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
#     match = re.search(email_pattern, resume_text)
#     return match.group(0) if match else "No email found"

# def extract_text_from_pdf(file_path: str) -> str:
#     try:
#         with open(file_path, "rb") as f:
#             reader = PdfReader(f)
#             text = "\n".join([page.extract_text() for page in reader.pages if page.extract_text()])
#         return text
#     except Exception as e:
#         raise Exception(f"Error extracting PDF: {e}")

# def extract_text_from_docx(file_path: str) -> str:
#     try:
#         return docx2txt.process(file_path)
#     except Exception as e:
#         raise Exception(f"Error extracting DOCX: {e}")
    
# import win32com.client
# import os

# def convert_doc_to_docx(doc_path: str) -> str:
#     docx_path = os.path.splitext(doc_path)[0] + ".docx"
#     word = win32com.client.Dispatch("Word.Application")
#     word.Visible = False
#     doc = word.Documents.Open(doc_path)
#     doc.SaveAs(docx_path, FileFormat=16)  # 16 = wdFormatDocumentDefault (.docx)
#     doc.Close()
#     word.Quit()
#     return docx_path

# def parse_resume(file_path: str, parser: LlamaParse) -> str:
#     """
#     Primary parser function. If LlamaParse fails, falls back to pdfminer.
#     :param file_path: Resume path
#     :param parser: LlamaParse instance
#     :return: Resume text
#     """
#     try:
#         if parser:
#             return parse_resume_with_llama(file_path, parser)
#     except Exception:
#         pass
#     return extract_text(file_path)

# def extract_text(file_path: str) -> str:
#     ext = os.path.splitext(file_path)[-1].lower()
#     if ext == ".pdf":
#         return extract_text_from_pdf(file_path)
#     elif ext == ".docx":
#         return extract_text_from_docx(file_path)
#     elif ext == ".doc":
#         # convert .doc → .docx first
#         docx_path = convert_doc_to_docx(file_path)
#         return extract_text_from_docx(docx_path)
#     else:
#         raise Exception("Unsupported file type.")
import re
import os
import asyncio
from PyPDF2 import PdfReader
import docx2txt
from pdfminer.high_level import extract_text as pdfminer_extract_text
from typing import Optional
from llama.llama_utils import parse_resume_with_llama
from llama_parse import LlamaParse
import win32com.client


# ---------- EMAIL EXTRACTION ----------
def extract_email(resume_text: str) -> str:
    email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
    match = re.search(email_pattern, resume_text)
    return match.group(0) if match else "No email found"


# ---------- ASYNC FILE EXTRACTORS ----------
async def extract_text_from_pdf(file_path: str) -> str:
    async def _read_pdf():
        with open(file_path, "rb") as f:
            reader = PdfReader(f)
            return "\n".join([page.extract_text() for page in reader.pages if page.extract_text()])

    try:
        return await asyncio.to_thread(_read_pdf)
    except Exception as e:
        raise Exception(f"Error extracting PDF: {e}")


async def extract_text_from_docx(file_path: str) -> str:
    async def _read_docx():
        return docx2txt.process(file_path)

    try:
        return await asyncio.to_thread(_read_docx)
    except Exception as e:
        raise Exception(f"Error extracting DOCX: {e}")


async def convert_doc_to_docx(doc_path: str) -> str:
    async def _convert():
        docx_path = os.path.splitext(doc_path)[0] + ".docx"
        word = win32com.client.Dispatch("Word.Application")
        word.Visible = False
        doc = word.Documents.Open(doc_path)
        doc.SaveAs(docx_path, FileFormat=16)  # 16 = wdFormatDocumentDefault (.docx)
        doc.Close()
        word.Quit()
        return docx_path

    return await asyncio.to_thread(_convert)


# ---------- FALLBACK TEXT EXTRACTION ----------
async def extract_text(file_path: str) -> str:
    ext = os.path.splitext(file_path)[-1].lower()
    if ext == ".pdf":
        return await extract_text_from_pdf(file_path)
    elif ext == ".docx":
        return await extract_text_from_docx(file_path)
    elif ext == ".doc":
        docx_path = await convert_doc_to_docx(file_path)
        return await extract_text_from_docx(docx_path)
    else:
        raise Exception("Unsupported file type.")


# ---------- PRIMARY PARSER ----------
# async def parse_resume(file_path: str, parser: Optional[LlamaParse] = None) -> str:
#     """
#     Primary async parser. Tries LlamaParse first, falls back to pdfminer if it fails.
#     """
#     try:
#         if parser:
#             # run llama parser in a thread to avoid blocking
#             return await asyncio.to_thread(parse_resume_with_llama, file_path, parser)
#     except Exception:
#         pass

#     # fallback to pdfminer
#     return await asyncio.to_thread(pdfminer_extract_text, file_path)


async def parse_resume(file_path: str, parser: Optional[LlamaParse] = None) -> str:
    """
    Primary async parser. Tries LlamaParse first, falls back to pdfminer if it fails.
    """
    try:
        if parser:
            return await parse_resume_with_llama(file_path, parser)  # <-- await directly
    except Exception:
        pass

    # fallback to pdfminer (sync, run in thread)
    return await asyncio.to_thread(pdfminer_extract_text, file_path)


