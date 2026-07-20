from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.db.database import get_db
from app.db.models import User
from app.records.schemas import (
    MonthRecordsResponse,
    RecordCreateRequest,
    RecordItem,
    RecordUpdateRequest,
    TodayInfoResponse,
)
from app.records.service import (
    create_record,
    delete_record,
    get_today_info,
    list_day_records,
    list_month_records,
    update_record,
)

router = APIRouter(prefix="/records", tags=["records"])


@router.get("", response_model=MonthRecordsResponse)
def get_month_records(
    year: int = Query(ge=1970, le=2100),
    month: int = Query(ge=1, le=12),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_month_records(db, user, year, month)


@router.get("/today", response_model=TodayInfoResponse)
def get_today(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_today_info(db, user)


@router.get("/{record_date}", response_model=list[RecordItem])
def get_day_records(
    record_date: date,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_day_records(db, user, record_date)


@router.post("", response_model=RecordItem)
def post_record(
    body: RecordCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return create_record(db, user, body)


@router.put("/{record_id}", response_model=RecordItem)
def put_record(
    record_id: int,
    body: RecordUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return update_record(db, user, record_id, body)


@router.delete("/{record_id}")
def remove_record(
    record_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    delete_record(db, user, record_id)
    return {"ok": True}
