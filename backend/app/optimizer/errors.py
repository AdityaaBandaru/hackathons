"""Structured optimizer failures.

An impossible scenario is a normal outcome of a well-formed request, not a
crash. These exceptions carry enough detail for the caller to see which
constraint made the portfolio impossible and what the achievable range was.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class Diagnostic:
    """One reason a scenario could not be solved."""

    code: str
    message: str
    detail: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        return {"code": self.code, "message": self.message, "detail": dict(self.detail)}


class OptimizerError(Exception):
    """Base class for optimizer failures that must not surface as a 500."""

    error_code = "optimizer_error"

    def __init__(self, message: str, diagnostics: list[Diagnostic] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.diagnostics = diagnostics or []

    def as_dict(self) -> dict[str, Any]:
        return {
            "error": self.error_code,
            "message": self.message,
            "diagnostics": [d.as_dict() for d in self.diagnostics],
        }


class InvalidScenarioError(OptimizerError):
    """The request is well-formed JSON but asks for something incoherent.

    For example an unknown intervention ID, or an assumption override key the
    model does not support. Distinct from infeasibility: nothing was solved
    because the scenario could not be built.
    """

    error_code = "invalid_scenario"


class InfeasibleScenarioError(OptimizerError):
    """No portfolio satisfies the requested constraints simultaneously."""

    error_code = "infeasible_scenario"
