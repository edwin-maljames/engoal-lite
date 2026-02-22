"""Unit tests for the INR formatting utility."""

from decimal import Decimal

import pytest

from app.services.formatting import format_inr


class TestFormatInr:
    @pytest.mark.parametrize(
        "amount, expected",
        [
            # Sub-lakh: plain number with commas
            (Decimal("0"), "0"),
            (Decimal("1000"), "1,000"),
            (Decimal("45000"), "45,000"),
            (Decimal("99999"), "99,999"),
            # Lakhs (>= 1,00,000)
            (Decimal("100000"), "1.00 L"),
            (Decimal("150000"), "1.50 L"),
            (Decimal("2500000"), "25.00 L"),
            (Decimal("9500000"), "95.00 L"),
            # Crores (>= 1,00,00,000)
            (Decimal("10000000"), "1.00 Cr"),
            (Decimal("50000000"), "5.00 Cr"),
            (Decimal("123456789"), "12.35 Cr"),
        ],
    )
    def test_positive_amounts(self, amount: Decimal, expected: str) -> None:
        assert format_inr(amount) == expected

    @pytest.mark.parametrize(
        "amount, expected",
        [
            (Decimal("-250000"), "-2.50 L"),
            (Decimal("-50000000"), "-5.00 Cr"),
            (Decimal("-45000"), "-45,000"),
        ],
    )
    def test_negative_amounts(self, amount: Decimal, expected: str) -> None:
        assert format_inr(amount) == expected

    def test_rounding_to_two_decimal_places(self) -> None:
        # 123456789.456 crore = 12.35 Cr (rounded)
        result = format_inr(Decimal("123456789"))
        assert result == "12.35 Cr"

    def test_exactly_one_crore(self) -> None:
        assert format_inr(Decimal("10000000")) == "1.00 Cr"

    def test_exactly_one_lakh(self) -> None:
        assert format_inr(Decimal("100000")) == "1.00 L"
