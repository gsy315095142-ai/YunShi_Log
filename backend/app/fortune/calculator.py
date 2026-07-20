"""命理推算纯函数模块，不依赖数据库。"""

from dataclasses import dataclass
from datetime import date, datetime, time

from zhdate import ZhDate

STEMS = "甲乙丙丁戊己庚辛壬癸"
BRANCHES = "子丑寅卯辰巳午未申酉戌亥"
ANIMALS = "鼠牛虎兔龙蛇马羊猴鸡狗猪"
STEM_ELEMENT = {
    "甲": "木", "乙": "木",
    "丙": "火", "丁": "火",
    "戊": "土", "己": "土",
    "庚": "金", "辛": "金",
    "壬": "水", "癸": "水",
}

# 纳音五行：六十甲子两两一组，共 30 组，按六十甲子序号 // 2 索引
NAYIN = [
    "海中金", "炉中火", "大林木", "路旁土", "剑锋金",
    "山头火", "涧下水", "城头土", "白蜡金", "杨柳木",
    "泉中水", "屋上土", "霹雳火", "松柏木", "长流水",
    "沙中金", "山下火", "平地木", "壁上土", "金箔金",
    "覆灯火", "天河水", "大驿土", "钗钏金", "桑柘木",
    "大溪水", "沙中土", "天上火", "石榴木", "大海水",
]

ZODIAC_RANGES = [
    ((1, 20), (2, 18), "水瓶座"),
    ((2, 19), (3, 20), "双鱼座"),
    ((3, 21), (4, 19), "白羊座"),
    ((4, 20), (5, 20), "金牛座"),
    ((5, 21), (6, 21), "双子座"),
    ((6, 22), (7, 22), "巨蟹座"),
    ((7, 23), (8, 22), "狮子座"),
    ((8, 23), (9, 22), "处女座"),
    ((9, 23), (10, 23), "天秤座"),
    ((10, 24), (11, 22), "天蝎座"),
    ((11, 23), (12, 21), "射手座"),
    ((12, 22), (1, 19), "摩羯座"),
]


@dataclass
class FortuneResult:
    lunar: str | None
    zodiac_sign: str | None
    chinese_zodiac: str | None
    five_element: str | None
    nayin: str | None
    birth_time_display: str | None


def _in_range(month: int, day: int, start: tuple[int, int], end: tuple[int, int]) -> bool:
    sm, sd = start
    em, ed = end
    if sm > em:
        return (month == sm and day >= sd) or (month == em and day <= ed) or month > sm or month < em
    return (month > sm or (month == sm and day >= sd)) and (month < em or (month == em and day <= ed))


def calc_zodiac_sign(birth_date: date) -> str:
    m, d = birth_date.month, birth_date.day
    for start, end, name in ZODIAC_RANGES:
        if _in_range(m, d, start, end):
            return name
    return "摩羯座"


def _lunar_year_pillar(lunar_year: int) -> tuple[str, str]:
    stem = STEMS[(lunar_year - 4) % 10]
    branch = BRANCHES[(lunar_year - 4) % 12]
    return stem, branch


def calc_chinese_zodiac(lunar_year: int) -> str:
    return ANIMALS[(lunar_year - 4) % 12]


def calc_five_element(lunar_year: int) -> str:
    stem, _ = _lunar_year_pillar(lunar_year)
    return STEM_ELEMENT[stem]


def calc_nayin(lunar_year: int) -> str:
    """纳音五行（完整名称，如「大林木」）：按农历年六十甲子序号两两一组取纳音。"""
    jiazi_index = (lunar_year - 4) % 60
    return NAYIN[jiazi_index // 2]


MONTH_NAMES = {
    1: "正月", 2: "二月", 3: "三月", 4: "四月", 5: "五月", 6: "六月",
    7: "七月", 8: "八月", 9: "九月", 10: "十月", 11: "冬月", 12: "腊月",
}


def _lunar_day_text(day: int) -> str:
    if day <= 10:
        return "初" + "一二三四五六七八九十"[day - 1]
    if day < 20:
        return "十" + "一二三四五六七八九"[day - 11]
    if day == 20:
        return "二十"
    if day < 30:
        return "廿" + "一二三四五六七八九"[day - 21]
    return "三十"


def format_lunar(birth_date: date, birth_time: time | None) -> str:
    dt = datetime.combine(birth_date, birth_time or time(12, 0))
    lunar = ZhDate.from_datetime(dt)
    stem, branch = _lunar_year_pillar(lunar.lunar_year)
    month_num = abs(lunar.lunar_month)
    month_str = MONTH_NAMES.get(month_num, f"{month_num}月")
    if lunar.lunar_month < 0:
        month_str = "闰" + month_str
    base = f"{stem}{branch}年 {month_str}{_lunar_day_text(lunar.lunar_day)}"
    if birth_time is None:
        return base
    shichen_index = ((birth_time.hour + 1) // 2) % 12
    return f"{base} {BRANCHES[shichen_index]}时"


def compute_fortune(birth_date: date | None, birth_time: time | None) -> FortuneResult:
    if birth_date is None:
        return FortuneResult(
            lunar=None,
            zodiac_sign=None,
            chinese_zodiac=None,
            five_element=None,
            nayin=None,
            birth_time_display="未填" if birth_time is None else birth_time.strftime("%H:%M"),
        )

    dt = datetime.combine(birth_date, birth_time or time(12, 0))
    lunar_obj = ZhDate.from_datetime(dt)
    lunar_year = lunar_obj.lunar_year

    return FortuneResult(
        lunar=format_lunar(birth_date, birth_time),
        zodiac_sign=calc_zodiac_sign(birth_date),
        chinese_zodiac=calc_chinese_zodiac(lunar_year),
        five_element=calc_five_element(lunar_year),
        nayin=calc_nayin(lunar_year),
        birth_time_display="未填" if birth_time is None else birth_time.strftime("%H:%M"),
    )
