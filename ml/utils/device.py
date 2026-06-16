"""
Device detection utility.

Auto-detects GPU (CUDA) or falls back to CPU at startup.
All ML models use the detected device via `get_device()`.
"""

import logging

import torch

logger = logging.getLogger(__name__)


def get_device() -> torch.device:
    """Detect and return the best available compute device.

    Returns cuda if a CUDA-capable GPU is available, otherwise cpu.
    Logs the selected device and GPU name when applicable.
    """
    if torch.cuda.is_available():
        device = torch.device("cuda")
        gpu_name = torch.cuda.get_device_name(0)
        vram_gb = torch.cuda.get_device_properties(0).total_mem / (1024 ** 3)
        logger.info(f"GPU detected: {gpu_name} ({vram_gb:.1f} GB VRAM)")
    else:
        device = torch.device("cpu")
        logger.info("No GPU detected — running all models on CPU")

    return device


def get_device_string() -> str:
    """Return device as a string ('cuda' or 'cpu') for libraries that expect str."""
    return "cuda" if torch.cuda.is_available() else "cpu"
