"""INR formatting utilities — Lakhs / Crores notation."""

from decimal import ROUND_HALF_UP, Decimal


def format_inr(amount: Decimal) -> str:
    """
    Format an INR amount using compact Lakhs/Crores notation.

    Examples:
        45_000       -> "45,000"
        1_50_000     -> "1.50 L"
        25_00_000    -> "25.00 L"
        5_00_00_000  -> "5.00 Cr"
        12_34_56_789 -> "12.35 Cr"
        -2_50_000    -> "-2.50 L"
    """
    abs_amount = abs(amount)
    sign = "-" if amount < 0 else ""

    crore_threshold = Decimal("10000000")  # 1 Cr = 1,00,00,000
    lakh_threshold = Decimal("100000")  # 1 L  = 1,00,000

    if abs_amount >= crore_threshold:
        crores = (abs_amount / crore_threshold).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        return f"{sign}{crores} Cr"
    if abs_amount >= lakh_threshold:
        lakhs = (abs_amount / lakh_threshold).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        return f"{sign}{lakhs} L"
    # Use integer formatting (no decimal places for small amounts)
    rounded = abs_amount.quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    return f"{sign}{rounded:,}"
