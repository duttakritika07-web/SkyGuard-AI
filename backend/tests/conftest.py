"""Set an isolated database before application modules are imported."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path


TEST_DIRECTORY = Path(tempfile.mkdtemp(prefix="skyguard-tests-"))
os.environ["SKYGUARD_DATABASE_URL"] = (
    f"sqlite:///{(TEST_DIRECTORY / 'test-skyguard.db').as_posix()}"
)
