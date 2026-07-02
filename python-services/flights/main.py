"""
TripWise flights microservice.

Thin FastAPI wrapper over fast-flights (AWeirdDev/flights), which scrapes
Google Flights so we get real prices without a paid GDS. Returns offers
normalized to the shape our Next.js FlightProvider expects.

Run in dev (from python-services/flights, inside a virtualenv with
requirements.txt installed):
    python -m uvicorn main:app --port 8001 --reload
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import List, Literal, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Import lazily so the app can still start and expose /health if the
# library ever fails to load.
try:
    from fast_flights import FlightData, Passengers, get_flights  # type: ignore
except ImportError as e:  # pragma: no cover
    FlightData = None  # type: ignore
    Passengers = None  # type: ignore
    get_flights = None  # type: ignore
    _import_error = str(e)
else:
    _import_error = None


app = FastAPI(title="TripWise flights", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


class SearchRequest(BaseModel):
    origin: str = Field(..., min_length=3, max_length=3, description="IATA airport code, e.g. TLV")
    destination: str = Field(..., min_length=3, max_length=3, description="IATA airport code, e.g. PRG")
    depart_date: str = Field(..., description="YYYY-MM-DD")
    return_date: Optional[str] = Field(None, description="YYYY-MM-DD; None for one-way")
    adults: int = Field(1, ge=1, le=10)
    children: int = Field(0, ge=0, le=10)
    cabin: Literal["economy", "premium-economy", "business", "first"] = "economy"
    limit: int = Field(20, ge=1, le=100)


class Offer(BaseModel):
    id: str
    total_price_usd: float
    currency: str
    total_duration_minutes: int
    layover_count: int
    carriers: List[str]
    departure: Optional[str]
    arrival: Optional[str]
    is_best: bool = False
    source: str = "fast-flights"
    checked_at: str
    raw_price: Optional[str] = None


class SearchResponse(BaseModel):
    origin: str
    destination: str
    depart_date: str
    return_date: Optional[str]
    price_hint: Optional[str] = None  # "typical" / "high" / "low"
    offer_count: int
    offers: List[Offer]
    source: str = "fast-flights"
    checked_at: str


# ------- helpers -------

_PRICE_RE = re.compile(r"[\d,]+\.?\d*")


def parse_price_to_usd(raw: str, from_currency_guess: str = "USD") -> tuple[float, str]:
    """
    fast-flights returns prices like '₪1,234', '$789', or '€560' depending
    on the market. Extract the numeric value; report the detected currency
    for the client. Currency conversion should happen client-side against
    a live FX quote — for now we return the number + detected currency
    and let the frontend format it as-is.
    """
    if raw is None:
        return 0.0, from_currency_guess

    text = str(raw)
    match = _PRICE_RE.search(text)
    if not match:
        return 0.0, from_currency_guess

    value = float(match.group(0).replace(",", ""))
    if "₪" in text or "ILS" in text.upper():
        currency = "ILS"
    elif "€" in text or "EUR" in text.upper():
        currency = "EUR"
    elif "£" in text or "GBP" in text.upper():
        currency = "GBP"
    elif "$" in text or "USD" in text.upper():
        currency = "USD"
    else:
        currency = from_currency_guess
    return value, currency


def parse_duration_to_minutes(raw: object) -> int:
    """
    fast-flights returns durations like '3 hr 45 min', '11 hr', or an int
    of minutes. Normalize to minutes.
    """
    if raw is None:
        return 0
    if isinstance(raw, int):
        return raw
    s = str(raw).lower()
    hours = 0
    minutes = 0
    h_match = re.search(r"(\d+)\s*hr", s)
    if h_match:
        hours = int(h_match.group(1))
    m_match = re.search(r"(\d+)\s*min", s)
    if m_match:
        minutes = int(m_match.group(1))
    if hours == 0 and minutes == 0:
        # Try plain number of minutes.
        n_match = re.search(r"\d+", s)
        if n_match:
            minutes = int(n_match.group(0))
    return hours * 60 + minutes


def parse_stops(raw: object) -> int:
    if raw is None:
        return 0
    if isinstance(raw, int):
        return raw
    s = str(raw).lower()
    if "non" in s or "direct" in s:
        return 0
    match = re.search(r"\d+", s)
    return int(match.group(0)) if match else 0


# ------- routes -------

@app.get("/health")
def health():
    return {
        "ok": True,
        "provider": "fast-flights",
        "import_error": _import_error,
    }


@app.post("/search", response_model=SearchResponse)
def search(req: SearchRequest) -> SearchResponse:
    if get_flights is None or FlightData is None or Passengers is None:
        raise HTTPException(
            status_code=503,
            detail=f"fast-flights not available: {_import_error}",
        )

    flight_data = [
        FlightData(
            date=req.depart_date,
            from_airport=req.origin.upper(),
            to_airport=req.destination.upper(),
        )
    ]
    if req.return_date:
        flight_data.append(
            FlightData(
                date=req.return_date,
                from_airport=req.destination.upper(),
                to_airport=req.origin.upper(),
            )
        )

    passengers = Passengers(
        adults=req.adults,
        children=req.children,
        infants_in_seat=0,
        infants_on_lap=0,
    )

    try:
        result = get_flights(
            flight_data=flight_data,
            trip="round-trip" if req.return_date else "one-way",
            seat=req.cabin,
            passengers=passengers,
            fetch_mode="fallback",
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Upstream failure: {e}") from e

    flights = list(getattr(result, "flights", []) or [])
    now = datetime.utcnow().isoformat() + "Z"

    offers: list[Offer] = []
    for i, f in enumerate(flights[: req.limit]):
        raw_price = getattr(f, "price", None)
        value, currency = parse_price_to_usd(raw_price)
        offers.append(
            Offer(
                id=f"ff-{req.origin}-{req.destination}-{req.depart_date}-{i}",
                total_price_usd=value,  # NOTE: not converted yet; currency in field below
                currency=currency,
                total_duration_minutes=parse_duration_to_minutes(getattr(f, "duration", None)),
                layover_count=parse_stops(getattr(f, "stops", None)),
                carriers=[str(getattr(f, "name", "")).strip() or "unknown"],
                departure=str(getattr(f, "departure", "")).strip() or None,
                arrival=str(getattr(f, "arrival", "")).strip() or None,
                is_best=bool(getattr(f, "is_best", False)),
                checked_at=now,
                raw_price=str(raw_price) if raw_price is not None else None,
            )
        )

    return SearchResponse(
        origin=req.origin.upper(),
        destination=req.destination.upper(),
        depart_date=req.depart_date,
        return_date=req.return_date,
        price_hint=str(getattr(result, "current_price", None) or "") or None,
        offer_count=len(offers),
        offers=offers,
        checked_at=now,
    )
