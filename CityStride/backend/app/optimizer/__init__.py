"""Mixed-integer portfolio optimizer for host-region mobility investment."""

from .errors import (
    Diagnostic,
    InfeasibleScenarioError,
    InvalidScenarioError,
    OptimizerError,
)
from .model import CityModel, ScenarioConstraints, build_city_model, normalize_weights, solve
from .schemas import OptimizeRequest, SensitivityRequest, to_scenario_kwargs
from .sensitivity import AXIS_NAMES, SENSITIVITY_AXES, run_sensitivity

__all__ = [
    "AXIS_NAMES",
    "CityModel",
    "Diagnostic",
    "InfeasibleScenarioError",
    "InvalidScenarioError",
    "OptimizeRequest",
    "OptimizerError",
    "SENSITIVITY_AXES",
    "ScenarioConstraints",
    "SensitivityRequest",
    "build_city_model",
    "normalize_weights",
    "run_sensitivity",
    "solve",
    "to_scenario_kwargs",
]
