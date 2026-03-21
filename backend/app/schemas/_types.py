"""Shared Pydantic type aliases for API response schemas."""

from decimal import Decimal
from typing import Annotated

from pydantic import PlainSerializer

# Serialize Decimal as float in JSON responses for numeric field compatibility.
# Use this in response schemas only; keep plain Decimal in request schemas
# so validation retains full precision.
JSONDecimal = Annotated[Decimal, PlainSerializer(float, return_type=float)]
