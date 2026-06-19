import datetime
import os
import shutil
import logging
from pathlib import Path
from app.core.config import settings

logger = logging.getLogger(__name__)


class LocalFileManager:
    """Manages local storage of camera snapshots, video, and audio evidence.

    Organizes directories by tenant, date, camera, and incident type.
    Includes capability to clean up files older than a retention threshold.
    """

    def __init__(self, base_dir: str = settings.UPLOAD_DIR):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _get_path(
        self,
        tenant_id: str,
        camera_id: str,
        incident_type: str,
        date: datetime.date = None
    ) -> Path:
        """Resolve the nested directory path for an incident.

        Structure:
          uploads/tenants/<tenant_id>/<year>/<month>/<day>/<camera_id>/<incident_type>/
        """
        if date is None:
            date = datetime.date.today()

        path = (
            self.base_dir
            / "tenants"
            / f"tenant_{tenant_id}"
            / incident_type
            / str(date.year)
            / f"{date.month:02d}"
            / f"{date.day:02d}"
            / str(camera_id)
        )
        path.mkdir(parents=True, exist_ok=True)
        return path


    def save_file(
        self,
        tenant_id: str,
        camera_id: str,
        incident_type: str,
        file_bytes: bytes,
        extension: str,
        prefix: str = "evidence"
    ) -> str:
        """Save evidence file to local storage.

        Returns:
            Relative path to file (string) starting with the base directory.
        """
        dir_path = self._get_path(tenant_id, camera_id, incident_type)
        timestamp = datetime.datetime.now().strftime("%H%M%S_%f")
        filename = f"{prefix}_{timestamp}.{extension.strip('.')}"
        file_path = dir_path / filename

        with open(file_path, "wb") as f:
            f.write(file_bytes)

        # Return relative path for database storage/routing
        return str(file_path.relative_to(self.base_dir.parent))

    def delete_file(self, relative_path: str):
        """Remove a file from local storage."""
        full_path = Path(relative_path)
        if full_path.exists():
            full_path.unlink()
            logger.info(f"Deleted local file: {relative_path}")

    def cleanup_old_files(self, tenant_id: str, retention_days: int = 30):
        """Delete files older than retention_days for a specific tenant."""
        tenant_dir = self.base_dir / "tenants" / f"tenant_{tenant_id}"
        if not tenant_dir.exists():
            return

        cutoff = datetime.datetime.now() - datetime.timedelta(days=retention_days)
        deleted_count = 0

        # Walk tenant dir to find old files
        for root, dirs, files in os.walk(tenant_dir):
            for file in files:
                file_path = Path(root) / file
                mtime = datetime.datetime.fromtimestamp(file_path.stat().st_mtime)
                if mtime < cutoff:
                    file_path.unlink()
                    deleted_count += 1

        # Clean up empty directories
        for root, dirs, files in os.walk(tenant_dir, topdown=False):
            for d in dirs:
                dir_path = Path(root) / d
                if not os.listdir(dir_path):
                    dir_path.rmdir()

        if deleted_count > 0:
            logger.info(f"Retention cleanup: deleted {deleted_count} files older than {retention_days} days for tenant {tenant_id}")


# Global file manager instance
file_manager = LocalFileManager()
