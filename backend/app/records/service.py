from calendar import monthrange
from datetime import date

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.db.models import DailyRecord, User
from app.records.schemas import (
    DaySummary,
    MonthRecordsResponse,
    RecordCreateRequest,
    RecordItem,
    RecordUpdateRequest,
)

PREVIEW_MAX = 12


def _preview(text: str) -> str:
    text = text.strip()
    if len(text) <= PREVIEW_MAX:
        return text
    return text[:PREVIEW_MAX] + "..."


def list_month_records(db: Session, user: User, year: int, month: int) -> MonthRecordsResponse:
    start = date(year, month, 1)
    end = date(year, month, monthrange(year, month)[1])
    rows = (
        db.query(DailyRecord)
        .filter(
            DailyRecord.user_id == user.id,
            DailyRecord.record_date >= start,
            DailyRecord.record_date <= end,
        )
        .order_by(DailyRecord.record_date, DailyRecord.sort_order, DailyRecord.id)
        .all()
    )

    grouped: dict[str, list[RecordItem]] = {}
    for row in rows:
        key = row.record_date.isoformat()
        grouped.setdefault(key, []).append(RecordItem.model_validate(row))

    days: list[DaySummary] = []
    for key, items in grouped.items():
        preview = _preview(items[0].content)
        if len(items) > 1 and len(preview) < PREVIEW_MAX:
            preview = _preview(" / ".join(i.content for i in items[:2]))
        days.append(
            DaySummary(
                record_date=date.fromisoformat(key),
                preview=preview,
                count=len(items),
            )
        )

    days.sort(key=lambda d: d.record_date)
    return MonthRecordsResponse(year=year, month=month, days=days, records_by_date=grouped)


def list_day_records(db: Session, user: User, record_date: date) -> list[RecordItem]:
    rows = (
        db.query(DailyRecord)
        .filter(DailyRecord.user_id == user.id, DailyRecord.record_date == record_date)
        .order_by(DailyRecord.sort_order, DailyRecord.id)
        .all()
    )
    return [RecordItem.model_validate(r) for r in rows]


def create_record(db: Session, user: User, body: RecordCreateRequest) -> RecordItem:
    count = (
        db.query(DailyRecord)
        .filter(DailyRecord.user_id == user.id, DailyRecord.record_date == body.record_date)
        .count()
    )
    row = DailyRecord(
        user_id=user.id,
        record_date=body.record_date,
        content=body.content.strip(),
        sort_order=count,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return RecordItem.model_validate(row)


def update_record(db: Session, user: User, record_id: int, body: RecordUpdateRequest) -> RecordItem:
    row = db.query(DailyRecord).filter(DailyRecord.id == record_id, DailyRecord.user_id == user.id).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")
    row.content = body.content.strip()
    db.commit()
    db.refresh(row)
    return RecordItem.model_validate(row)


def delete_record(db: Session, user: User, record_id: int) -> None:
    row = db.query(DailyRecord).filter(DailyRecord.id == record_id, DailyRecord.user_id == user.id).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")
    db.delete(row)
    db.commit()
