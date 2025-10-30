import os
import json
import re
import asyncio
import google.generativeai as genai
from typing import Dict, Any, List, Optional
from datetime import datetime
from parsing.parsing_utils import extract_email, extract_mobile_number

async def initialize_gemini(api_key: Optional[str] = None, model_name: str = "gemini-2.5-flash"): 
    def _init_sync():
        final_api_key = api_key or os.getenv("GEMINI_API_KEY")
        if not final_api_key:
            raise Exception("No Gemini API key provided and GEMINI_API_KEY environment variable not set")
        genai.configure(api_key=final_api_key)
        return genai.GenerativeModel(model_name)

    # Run the sync initialization in a thread
    return await asyncio.to_thread(_init_sync)



# ---------- MAIN ANALYSIS ----------
async def analyze_resume_comprehensive(
    resume_text: str,
    jd_data: Dict[str, Any],
    model,
    api_key: Optional[str] = None
) -> Dict[str, Any]:
    today = datetime.now().strftime("%m/%Y")

    prompt = f"""
    Perform a comprehensive analysis of this resume against the job description with the following components:
    CANDIDATE IDENTIFICATION:
        - Extract candidate_name (full name from resume header section)
        - If no name can be identified, return "Not specified"
    1. SKILL MATCH ANALYSIS:
        - Calculate match_score (0-100) **based ONLY on primary skill matches**
        - List matching_skills (only primary skills that are found)
        - List missing_primary_skills (primary skills not found)
        - List matching_secondary_skills (secondary skills found — NOT used for match_score)
        - List missing_secondary_skills (secondary skills not found)

        Note: Do NOT include secondary skills in match_score calculation. They are only for profile feedback.
    
    2. EXPERIENCE ANALYSIS:
       - Extract all work positions with:
         * company
         * title
         * duration (normalized to MM/YYYY-MM/YYYY format)
         * duration_length (calculated precisely in X years Y months format)
         * domain
         * internship flag
         * employment_type (full-time, contract, freelance, internship)
       - For positions missing dates: mark with "duration_missing": true
       - Calculate total_experience by summing duration_length of all non-internship positions
       - If no companies found, mark as fresher
       - Determine experience_match (boolean if meets JD requirements)
       - Detect frequent_hopper (true if any position duration is between 1-11 months)
    
    3. PROFILE FEEDBACK:
       - freelancer_status: true if any position is freelance/contract (mention in summary)
       - has_linkedin: true if LinkedIn URL found (show URL if available)
       - has_email: true if email found (show email if available)
       - has_mobile: true if mobile number found (show mobile if available)
    
    4. IMPROVEMENT SUGGESTIONS:
       - List specific suggestions for improving resume
    
    5. SUMMARY:
       - Provide overall assessment including:
         * Experience status
         * If any matching secondary skills are found, mention them as "Additional Advantage: [skill1, skill2,...]"
         * If frequent_hopper is true, mention "Candidate shows frequent job changes"
    
    Rules for Experience Analysis:
    - Normalize all dates to MM/YYYY format
    - Handle "Present" or "Current" as {today}
    - Exclude internships from total experience calculation
    - For total_experience, sum all duration_length values from non-internship positions
    - If multiple "Present" roles, mark the latest one as "Present (Current)"
    - If any position is missing start or end dates, include in analysis but mark as "Dates not available"
    - If no companies found, clearly indicate this is a "Fresher Profile"
    - When displaying experience details, number them sequentially starting from 1
    - Maintain accurate duration values in years and months format
    - Always display durations in the format: "X years Y months" or "Y months" if less than a year
    - Detect frequent_hopper: true if ANY position has duration between 1-11 months (excluding internships)

Continuous and Overlap Month Handling Rules:
    - If the end month of one job is the same as the start month of the next job,
      then add one extra month to the previous role's duration_length 
      (to represent continuous employment without gap)
    - If multiple jobs fall within the same start or end month (overlapping or concurrent),
      use normal duration calculation (no extra month added)
    - Example behavior:
        * Continuous sequence (no gap): 
              07/2021 - 10/2025 → 4 years 4 months
              10/2020 - 06/2021 → 0 years 9 months
              03/2018 - 09/2020 → 2 years 7 months
              06/2015 - 02/2018 → 2 years 8 months
        * Overlapping same month sequence:
              07/2021 - 10/2025 → 4 years 3 months
              10/2020 - 07/2021 → 0 years 9 months
              03/2018 - 10/2020 → 2 years 7 months
              06/2015 - 03/2018 → 2 years 9 months

    
    Required Experience from JD: {jd_data.get('required_experience', 'Not specified')}
    Min Experience: {jd_data.get('min_experience', 0)} years
    Max Experience: {jd_data.get('max_experience', 0)} years
    
    Resume:
    {resume_text}
    
    Job Description Data:
    {json.dumps(jd_data, indent=2)}
    
    Return STRICT JSON format with this structure:
    {{  
        "candidate_info": {{
            "candidate_name": "John Doe"
        }},
        "skill_analysis": {{
            "match_score": 75,
            "matching_skills": ["Python", "ML"],
            "missing_primary_skills": ["AWS"],
            "missing_secondary_skills": ["Docker"]
        }},
        "experience_analysis": {{
            "positions": [
                {{
                    "company": "ABC Corp",
                    "title": "Software Engineer",
                    "duration": "01/2020 - 06/2022",
                    "duration_length": "2 years 5 months",
                    "domain": "IT",
                    "is_internship": false,
                    "employment_type": "full-time",
                    "duration_missing": false
                }}
            ],
            "total_experience": "2 years 5 months",
            "experience_match": true,
            "frequent_hopper": false,
            "is_fresher": false,
            "positions_with_missing_dates": 1,
            "experience_status": "Partial dates available (1 position missing dates)"
        }},
        "profile_feedback": {{
            "freelancer_status": false,
            "has_linkedin": true,
            "linkedin_url": "https://linkedin.com/in/example",
            "has_email": true,
            "candidate_email": "example@email.com",
            "has_mobile": true,
            "candidate_mobile": "+911234567890"
        }},
        "suggestions": ["Add AWS certification", "Add missing employment dates"],
        "summary": "Strong technical skills but lacks cloud experience. Partial work history available."
    }}
    
    Return ONLY valid JSON with no additional text or formatting.
    """

    try:
        # Run Gemini generation in a background thread (blocking call)
        response = await asyncio.to_thread(model.generate_content, prompt)
        result = await parse_gemini_response(response.text)

        # Ensure candidate info section exists
        result.setdefault("candidate_info", {"candidate_name": "Not specified"})
        result.setdefault(
            "profile_feedback",
            {
                "freelancer_status": False,
                "has_linkedin": False,
                "linkedin_url": "",
                "has_email": False,
                "candidate_email": "",
                "has_mobile": False,
                "candidate_mobile": "",
            },
        )

        # Extract LinkedIn/email/mobile if missing
        if not result["profile_feedback"]["has_linkedin"]:
            linkedin_url = await extract_linkedin_url(resume_text)
            if linkedin_url:
                result["profile_feedback"]["has_linkedin"] = True
                result["profile_feedback"]["linkedin_url"] = linkedin_url

        if not result["profile_feedback"]["has_email"]:
            email = extract_email(resume_text)
            if email:
                result["profile_feedback"]["has_email"] = True
                result["profile_feedback"]["candidate_email"] = email

        # Extract mobile number
        if not result["profile_feedback"]["has_mobile"]:
            mobile = extract_mobile_number(resume_text)
            if mobile:
                result["profile_feedback"]["has_mobile"] = True
                result["profile_feedback"]["candidate_mobile"] = mobile

        # Check freelance status
        if not result["profile_feedback"].get("freelancer_status", False):
            if "experience_analysis" in result:
                positions = result["experience_analysis"].get("positions", [])
                for position in positions:
                    employment_type = position.get("employment_type", "")
                    if isinstance(employment_type, str) and employment_type.lower() in ["freelance", "contract"]:
                        result["profile_feedback"]["freelancer_status"] = True
                        break

        # Add to summary
        summary_additions = []
        pf = result["profile_feedback"]
        if pf.get("freelancer_status"): summary_additions.append("Has freelance/contract experience")
        if pf.get("has_linkedin"): summary_additions.append("LinkedIn profile available")
        else: summary_additions.append("LinkedIn missing")
        

        if summary_additions:
            if "summary" in result:
                result["summary"] += " " + ". ".join(summary_additions) + "."
            else:
                result["summary"] = ". ".join(summary_additions) + "."

        # Experience processing (same logic, async safe)
        result = await asyncio.to_thread(_process_experience_analysis, result, jd_data)
        result["analysis_type"] = "comprehensive"
        return result

    except Exception as e:
        raise Exception(f"Comprehensive analysis failed: {str(e)}")

# ---------- EXPERIENCE POST-PROCESSING ----------
def _process_experience_analysis(result: Dict[str, Any], jd_data: Dict[str, Any]) -> Dict[str, Any]:
    if "experience_analysis" not in result:
        return result

    exp_analysis = result["experience_analysis"]
    positions = exp_analysis.get("positions", [])
    missing_dates_count = sum(1 for p in positions if p.get("duration_missing", False))
    exp_analysis["positions_with_missing_dates"] = missing_dates_count
    exp_analysis["required_experience"] = jd_data.get("required_experience", "Not specified")

    # Frequent hopper detection
    frequent_hopper = False
    for position in positions:
        if not position.get("is_internship", False) and not position.get("duration_missing", False):
            duration = position.get("duration_length", "")
            if duration and duration != "N/A":
                # Extract months from duration string
                months_match = re.search(r"(\d+)\s*month", duration)
                years_match = re.search(r"(\d+)\s*year", duration)
                
                months = int(months_match.group(1)) if months_match else 0
                years = int(years_match.group(1)) if years_match else 0
                total_months = years * 12 + months
                
                # Check if duration is between 1-11 months
                if 1 <= total_months <= 11:
                    frequent_hopper = True
                    break
    
    exp_analysis["frequent_hopper"] = frequent_hopper

    if not positions:
        exp_analysis.update({
            "is_fresher": True,
            "experience_status": "Fresher (no work experience found)",
            "total_experience": "0 years",
            "frequent_hopper": False
        })
    else:
        exp_analysis["is_fresher"] = False
        if missing_dates_count == 0:
            exp_analysis["experience_status"] = "Complete dates available"
        elif missing_dates_count == len(positions):
            exp_analysis["experience_status"] = "No dates available for any position"
        else:
            exp_analysis["experience_status"] = f"Partial dates available ({missing_dates_count} positions missing dates)"

        total_months = 0
        valid_positions = 0
        for position in positions:
            if not position.get("is_internship", False) and not position.get("duration_missing", False):
                duration = position.get("duration_length", "")
                if duration and duration != "N/A":
                    years_match = re.search(r"(\d+)\s*year", duration)
                    months_match = re.search(r"(\d+)\s*month", duration)
                    years = int(years_match.group(1)) if years_match else 0
                    months = int(months_match.group(1)) if months_match else 0
                    total_months += years * 12 + months
                    valid_positions += 1

        if valid_positions > 0:
            years = total_months // 12
            months = total_months % 12
            total_exp_str = f"{years} years {months} months" if months else f"{years} years"
            exp_analysis["total_experience"] = total_exp_str
        else:
            exp_analysis["total_experience"] = "Unable to Calculate (Missing Duration)"

        # Experience match calculation
        required_exp_str = jd_data.get("required_experience", "").strip()
        total_years = total_months / 12
        experience_match = False

        try:
            if "+" in required_exp_str:
                min_exp = int(required_exp_str.replace("+", "").strip())
                experience_match = total_years >= min_exp
            elif "-" in required_exp_str:
                parts = required_exp_str.split("-")
                min_exp = int(parts[0].strip())
                max_exp = int(parts[1].strip())
                experience_match = min_exp <= total_years <= max_exp
            elif required_exp_str.isdigit():
                experience_match = total_years >= int(required_exp_str)
        except:
            experience_match = False

        exp_analysis["experience_match"] = experience_match

    if missing_dates_count > 0:
        result.setdefault("suggestions", [])
        result["suggestions"].append(f"Add missing employment dates for {missing_dates_count} position(s)")

    if exp_analysis.get("is_fresher", False):
        result["summary"] = "Fresher profile. " + result.get("summary", "Fresher profile with no prior work experience.")
    
    # Add frequent hopper note to summary
    if frequent_hopper:
        if "summary" in result:
            result["summary"] += " Candidate shows frequent job changes."
        
    return result


# ---------- HELPERS ----------
async def extract_linkedin_url(text: str) -> str:
    return await asyncio.to_thread(_extract_linkedin_url_sync, text)

def _extract_linkedin_url_sync(text: str) -> str:
    linkedin_pattern = r"(https?:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9\-_]+\/?)"
    match = re.search(linkedin_pattern, text)
    return match.group(0) if match else ""


async def parse_gemini_response(response_text: str) -> Dict[str, Any]:
    return await asyncio.to_thread(_parse_gemini_response_sync, response_text)

def _parse_gemini_response_sync(response_text: str) -> Dict[str, Any]:
    try:
        clean_text = response_text.strip()
        if clean_text.startswith("```json"):
            clean_text = clean_text[7:-3].strip()
        elif clean_text.startswith("```"):
            clean_text = clean_text[3:-3].strip()
        return json.loads(clean_text)
    except json.JSONDecodeError:
        return {
            "skill_analysis": {
                "match_score": extract_value(response_text, "match_score", int),
                "matching_skills": extract_list(response_text, "matching_skills"),
                "missing_primary_skills": extract_list(response_text, "missing_primary_skills"),
                "missing_secondary_skills": extract_list(response_text, "missing_secondary_skills")
            },
            "experience_analysis": {
                "positions": extract_experience_positions(response_text),
                "total_experience": extract_value(response_text, "total_experience", str),
                "experience_match": extract_value(response_text, "experience_match", bool)
            },
            "suggestions": extract_list(response_text, "suggestions"),
            "summary": extract_value(response_text, "summary", str)
        }


# ---------- REGEX PARSERS ----------
def extract_experience_positions(text: str) -> List[Dict]:
    positions = []
    position_blocks = re.findall(r'\{(.*?)\}', text, re.DOTALL)
    for block in position_blocks:
        positions.append({
            "company": extract_value(block, "company", str),
            "title": extract_value(block, "title", str),
            "duration": extract_value(block, "duration", str),
            "domain": extract_value(block, "domain", str),
            "is_internship": extract_value(block, "is_internship", bool)
        })
    return positions

def extract_value(text: str, key: str, type_func) -> Any:
    match = re.search(f'"{key}":\s*([^,\n}}]+)', text)
    if match:
        try:
            return type_func(match.group(1).strip(' "\''))
        except:
            return type_func()
    return type_func()

def extract_list(text: str, key: str) -> List[str]:
    match = re.search(f'"{key}":\s*\[([^\]]+)\]', text)
    if match:
        return [item.strip(' "\'') for item in match.group(1).split(",") if item.strip()]
    return []
