import json
import logging
import os
import pandas as pd
from rapidfuzz import process, fuzz
from typing import Optional

logger = logging.getLogger(__name__)

DATASET_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "insurance_network.json")
# Hospital threshold: lower because users type short partial names (e.g. 'apollo mumbai')
HOSPITAL_THRESHOLD = 60
# Insurer threshold: for partial_ratio on normalized strings
INSURER_THRESHOLD = 60


class InsuranceMatcher:
    def __init__(self):
        self.df = self._load_dataset()
        self.hospital_names = self.df["hospital_name"].unique().tolist()
        self.insurer_names = self.df["insurance_company"].unique().tolist()
        logger.info(
            f"InsuranceMatcher loaded: {len(self.hospital_names)} hospitals, "
            f"{len(self.insurer_names)} insurers."
        )

    def _load_dataset(self) -> pd.DataFrame:
        path = os.path.normpath(DATASET_PATH)
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return pd.DataFrame(data)

    def _fuzzy_match_hospital(self, query: str, choices: list[str], threshold: int = HOSPITAL_THRESHOLD):
        """
        Match hospital names using token_set_ratio.
        Good for: 'apollo mumbai' -> 'Apollo Hospitals Mumbai'
        Cross-validated with partial_ratio to reject false positives.
        """
        result = process.extractOne(
            query.lower(), [c.lower() for c in choices], scorer=fuzz.token_set_ratio
        )
        if result and result[1] >= threshold:
            # Cross-check: compute meaningful word overlap, ignoring common stopwords
            # This prevents 'xyz hospital' from matching 'Fortis Hospital Bangalore'
            # via the shared word 'hospital'
            stopwords = {"hospital", "hospitals", "clinic", "centre", "center", "the", "and", "of"}
            query_words = {w for w in query.lower().split() if w not in stopwords}
            choice_words = {w for w in choices[result[2]].lower().split() if w not in stopwords}
            # Require at least one non-stopword to overlap OR allow if token_set_ratio is very high
            has_overlap = bool(query_words & choice_words) or any(
                qw in cw or cw in qw for qw in query_words for cw in choice_words
            )
            if has_overlap or result[1] >= 90:
                return choices[result[2]], result[1]
        return None, result[1] if result else 0

    def _fuzzy_match_insurer(self, query: str, choices: list[str], threshold: int = INSURER_THRESHOLD):
        """
        Match insurer names using partial_ratio on uppercased strings.
        Good for: 'hdfc' -> 'HDFC ERGO', 'star' -> 'Star Health', 'icici' -> 'ICICI Lombard'
        """
        q_upper = query.upper()
        choices_upper = [c.upper() for c in choices]
        result = process.extractOne(q_upper, choices_upper, scorer=fuzz.partial_ratio)
        if result and result[1] >= threshold:
            return choices[result[2]], result[1]
        return None, result[1] if result else 0

    def _get_alternatives(self, query: str, choices: list[str], limit: int = 3) -> list[dict]:
        """Return top-N similar hospitals (below match threshold but above 35%)."""
        results = process.extract(
            query.lower(), [c.lower() for c in choices],
            scorer=fuzz.token_set_ratio, limit=limit + 5
        )
        return [
            {"name": choices[r[2]], "score": round(r[1], 1)}
            for r in results
            if 35 <= r[1] < HOSPITAL_THRESHOLD
        ][:limit]

    def check_insurance(self, hospital_query: str, insurance_query: str) -> dict:
        """
        Check if a hospital-insurance pair supports cashless treatment.

        Returns a structured dict with:
            - status: 'YES' or 'NO'
            - hospital: normalized hospital name (or None)
            - insurance: normalized insurer name (or None)
            - hospital_score: fuzzy match confidence
            - insurance_score: fuzzy match confidence
            - suggestions: list of similar hospitals if hospital not found
            - message: human-readable explanation
        """
        # Step 1: Fuzzy-match hospital name against full hospital list
        matched_hospital, h_score = self._fuzzy_match_hospital(hospital_query, self.hospital_names)

        if not matched_hospital:
            alternatives = self._get_alternatives(hospital_query, self.hospital_names)
            logger.warning(f"Hospital not found: '{hospital_query}' (best score: {h_score:.1f}%)")
            return {
                "status": "NO",
                "hospital": None,
                "insurance": None,
                "hospital_score": round(h_score, 1),
                "insurance_score": 0,
                "message": f"Hospital '{hospital_query}' not found in our network.",
                "suggestions": alternatives,
            }

        # Step 2: Filter dataset to rows for the matched hospital
        hospital_df = self.df[self.df["hospital_name"] == matched_hospital]
        available_insurers = hospital_df["insurance_company"].tolist()

        # Step 3: Fuzzy-match insurer name within that hospital's insurer list
        matched_insurer, i_score = self._fuzzy_match_insurer(
            insurance_query, available_insurers, threshold=INSURER_THRESHOLD
        )

        if not matched_insurer:
            # Try against full insurer list for a better suggestion name
            global_insurer, _ = self._fuzzy_match_insurer(insurance_query, self.insurer_names, threshold=40)
            logger.warning(
                f"Insurer not found for '{matched_hospital}': '{insurance_query}' (score: {i_score:.1f}%)"
            )
            return {
                "status": "NO",
                "hospital": matched_hospital,
                "insurance": global_insurer,
                "hospital_score": round(h_score, 1),
                "insurance_score": round(i_score, 1),
                "message": (
                    f"'{insurance_query}' does not have a cashless tie-up with '{matched_hospital}'."
                ),
                "suggestions": [],
            }

        # Step 4: Check cashless availability in the dataset
        row = hospital_df[hospital_df["insurance_company"] == matched_insurer].iloc[0]
        cashless = bool(row["cashless_available"])

        logger.info(
            f"Query: hospital='{hospital_query}' -> '{matched_hospital}' ({h_score:.1f}%), "
            f"insurance='{insurance_query}' -> '{matched_insurer}' ({i_score:.1f}%), "
            f"cashless={cashless}"
        )

        return {
            "status": "YES" if cashless else "NO",
            "hospital": matched_hospital,
            "insurance": matched_insurer,
            "hospital_score": round(h_score, 1),
            "insurance_score": round(i_score, 1),
            "message": (
                "Cashless treatment is available ✅"
                if cashless
                else "Cashless treatment is NOT available for this combination ❌"
            ),
            "suggestions": [],
        }


# Singleton instance — loaded once at module import time
matcher = InsuranceMatcher()
