from pydantic import BaseModel
from typing import List


class RankedDriverSchema(BaseModel):
    tanker_id: int
    score: float


class DriverScoreBreakdownSchema(BaseModel):
    tanker_id: int
    proximity: float
    reliability: float
    responsiveness: float
    area_affinity: float
    fairness: float
    penalty: float
    availability_confidence: float
    final_score: float


class AssignmentResultSchema(BaseModel):
    assigned_tanker_id: int
    score_breakdown: DriverScoreBreakdownSchema
    ranked_candidates: List[RankedDriverSchema]