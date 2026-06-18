"""
Serialization utilities for the Sentinel ML service.

Provides a recursive sanitizer that converts all numpy scalar/array types
to native Python equivalents so Pydantic v2 can serialize pipeline results.

Usage:
    from ml.utils.serialization import numpy_to_python
    clean = numpy_to_python(pipeline_result)
"""

import numpy as np


def numpy_to_python(obj):
    """Recursively convert numpy types to native Python types.

    Handles:
        - numpy integer scalars  → int
        - numpy float scalars    → float
        - numpy bool scalars     → bool
        - numpy ndarray          → list (nested)
        - tuple                  → tuple (elements sanitized)
        - list                   → list (elements sanitized)
        - dict                   → dict (keys and values sanitized)
        - everything else        → unchanged

    Args:
        obj: Any Python / numpy object.

    Returns:
        An equivalent object with all numpy types replaced by Python natives.
    """
    if isinstance(obj, dict):
        return {numpy_to_python(k): numpy_to_python(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        sanitized = [numpy_to_python(item) for item in obj]
        return type(obj)(sanitized)
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.floating):
        return float(obj)
    if isinstance(obj, np.bool_):
        return bool(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    return obj
