from datetime import date

from pydantic import BaseModel, Field


class RecordCreateRequest(BaseModel):
    record_date: date
    content: str = Field(min_length=1, max_length=2000)


class RecordUpdateRequest(BaseModel):
    content: str = Field(min_length=1, max_length=2000)


class RecordItem(BaseModel):
    id: int
    record_date: date
    content: str
    sort_order: int

    model_config = {"from_attributes": True}


class DaySummary(BaseModel):
    record_date: date
    preview: str
    count: int


class MonthRecordsResponse(BaseModel):
    year: int
    month: int
    days: list[DaySummary]
    records_by_date: dict[str, list[RecordItem]]


class TodayInfoResponse(BaseModel):
    date: date
    lunar: str
    count: int
    previews: list[str]
