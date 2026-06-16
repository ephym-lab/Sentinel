# Custom YOLO26 Weights

Place fine-tuned YOLO26 model weights here.

## Required custom models:

| File | Dataset | Purpose |
|---|---|---|
| `yolo26n-face.pt` | WIDER FACE | Face detection (dev/CPU) |
| `yolo26l-face.pt` | WIDER FACE | Face detection (prod/GPU) |
| `yolo26n-fire.pt` | Custom fire/smoke | Fire/smoke detection (dev/CPU) |
| `yolo26l-fire.pt` | Custom fire/smoke | Fire/smoke detection (prod/GPU) |

## Training example:

```python
from ultralytics import YOLO

# Start from pretrained YOLO26 nano
model = YOLO("yolo26n.pt")

# Fine-tune on WIDER FACE dataset
model.train(data="widerface.yaml", epochs=100, imgsz=640)

# Save as custom face model
# Weights saved to runs/detect/train/weights/best.pt
# Copy to ml/weights/yolo26n-face.pt
```

## Note:
Standard pretrained models (yolo26n.pt, yolo26n-pose.pt) are auto-downloaded
by Ultralytics and do NOT need to be placed here.
