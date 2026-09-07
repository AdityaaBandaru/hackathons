"""Integer-cents money handling (CLAUDE.md rule 4).

Money never becomes a float in application code. These helpers exist so that
the one place floats are allowed -- formatting a value for display -- is
explicit and easy to audit.
"""

from __future__ import annotations

CENTS_PER_DOLLAR = 100


class MoneyError(ValueError):
    """Raised when a value that must be integer cents is not."""


def as_cents(value: object, field: str = "value") -> int:
    """Return ``value`` as integer cents, refusing floats and ``None``.

    ``None`` is rejected rather than coerced: a missing amount is missing, not
    zero (CLAUDE.md rule 6). Callers that legitimately allow a null amount must
    check for it before calling this.
    """
    if value is None:
        raise MoneyError(f"{field} is missing; refusing to coerce null money to zero")
    if isinstance(value, bool) or not isinstance(value, int):
        raise MoneyError(f"{field} must be integer cents, got {type(value).__name__}: {value!r}")
    return value


def is_cents(value: object) -> bool:
    """True if ``value`` is a usable integer-cents amount."""
    return isinstance(value, int) and not isinstance(value, bool)


def dollars_str(cents: int) -> str:
    """Format integer cents as a dollar string. Display only."""
    cents = as_cents(cents, "cents")
    sign = "-" if cents < 0 else ""
    whole, rem = divmod(abs(cents), CENTS_PER_DOLLAR)
    return f"{sign}${whole:,}.{rem:02d}"


def sum_cents(values: object, field: str = "value") -> int:
    """Sum an iterable of integer cents, refusing any non-integer member."""
    total = 0
    for index, value in enumerate(values):  # type: ignore[call-overload]
        total += as_cents(value, f"{field}[{index}]")
    return total
