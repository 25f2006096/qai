import sys
from pathlib import Path

# Ensure quantum_backend is placed first in sys.path so 'app' imports resolve to quantum_backend/app
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))
