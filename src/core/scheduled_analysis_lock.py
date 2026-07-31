# -*- coding: utf-8 -*-
"""Cross-process host lock for scheduled analysis slots.

Prevents duplicate daily pushes when multiple ``main.py --serve`` / schedule
processes share the same data directory. Combines an exclusive file lock with
a per-slot claim marker so late arrivals after the first run finishes also skip.
"""

from __future__ import annotations

import errno
import logging
import os
import re
import threading
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Optional, Sequence

from src.config import Config

try:
    import fcntl
except ImportError:  # pragma: no cover - Windows fallback
    fcntl = None

_process_guard = threading.Lock()
_process_running = False
_CLAIM_STALE_TTL_SECONDS = 24 * 60 * 60
_SAFE_KEY_RE = re.compile(r"[^A-Za-z0-9._-]+")
logger = logging.getLogger(__name__)


@dataclass
class ScheduledAnalysisLease:
    handle: Any
    lock_path: Path
    claim_path: Optional[Path]
    uses_flock: bool
    slot_key: str
    persist_claim: bool


def scheduled_analysis_lock_path(config: Config) -> Path:
    database_path = getattr(config, "database_path", "./data/stock_analysis.db")
    return Path(database_path).parent / "scheduled_analysis.lock"


def scheduled_slot_claims_dir(config: Config) -> Path:
    database_path = getattr(config, "database_path", "./data/stock_analysis.db")
    return Path(database_path).parent / "scheduled_slot_claims"


def build_scheduled_slot_key(
    *,
    slot_time: Optional[str],
    markets: Optional[Sequence[str]] = None,
    when: Optional[date] = None,
) -> str:
    day = (when or date.today()).isoformat()
    time_part = (slot_time or "").strip() or "startup"
    if markets:
        normalized = sorted(
            {
                str(item).strip().lower()
                for item in markets
                if str(item).strip()
            }
        )
        markets_part = ",".join(normalized) if normalized else "all"
    else:
        markets_part = "all"
    return f"{day}|{time_part}|{markets_part}"


def _claim_file_name(slot_key: str) -> str:
    return _SAFE_KEY_RE.sub("_", slot_key) + ".claim"


def scheduled_slot_claim_path(config: Config, slot_key: str) -> Path:
    return scheduled_slot_claims_dir(config) / _claim_file_name(slot_key)


def _write_metadata(handle: Any, *, slot_key: str) -> None:
    handle.seek(0)
    handle.truncate()
    handle.write(
        f"pid={os.getpid()}\n"
        f"started_at={datetime.now().isoformat()}\n"
        f"slot_key={slot_key}\n"
    )
    handle.flush()


def _write_claim_file(claim_path: Path, *, slot_key: str) -> None:
    claim_path.parent.mkdir(parents=True, exist_ok=True)
    claim_path.write_text(
        f"pid={os.getpid()}\n"
        f"started_at={datetime.now().isoformat()}\n"
        f"slot_key={slot_key}\n",
        encoding="utf-8",
    )


def _read_metadata(path: Path) -> dict[str, str]:
    try:
        raw = path.read_text(encoding="utf-8")
    except OSError:
        return {}
    metadata: dict[str, str] = {}
    for line in raw.splitlines():
        if "=" in line:
            key, value = line.split("=", 1)
            metadata[key.strip()] = value.strip()
    return metadata


def _is_process_alive(pid: int) -> bool:
    if pid <= 0:
        return False
    if os.name == "nt":
        return _is_windows_process_alive(pid)
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except OSError:
        return True
    return True


def _is_windows_process_alive(pid: int) -> bool:
    try:
        import ctypes
    except ImportError:  # pragma: no cover
        return True
    try:
        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        handle = kernel32.OpenProcess(0x1000, False, pid)
        if not handle:
            return ctypes.get_last_error() != 87
        try:
            exit_code = ctypes.c_ulong()
            if not kernel32.GetExitCodeProcess(handle, ctypes.byref(exit_code)):
                return True
            return exit_code.value == 259
        finally:
            kernel32.CloseHandle(handle)
    except Exception as exc:  # pragma: no cover
        logger.warning("Windows process probe failed; assume alive: %s", exc)
        return True


def _is_claim_stale(claim_path: Path) -> bool:
    """Day-scoped claims stay valid after the holder exits; only TTL expires them."""
    metadata = _read_metadata(claim_path)
    started_raw = metadata.get("started_at")
    if started_raw:
        try:
            started_at = datetime.fromisoformat(started_raw)
        except ValueError:
            return True
        return datetime.now() - started_at > timedelta(seconds=_CLAIM_STALE_TTL_SECONDS)

    try:
        modified_at = datetime.fromtimestamp(claim_path.stat().st_mtime)
    except OSError:
        return False
    return datetime.now() - modified_at > timedelta(seconds=_CLAIM_STALE_TTL_SECONDS)


def _is_lock_file_stale(lock_path: Path) -> bool:
    """Exclusive run-lock stale detection (process dead or TTL exceeded)."""
    metadata = _read_metadata(lock_path)
    pid_raw = metadata.get("pid")
    if pid_raw:
        try:
            pid = int(pid_raw)
        except ValueError:
            return True
        if not _is_process_alive(pid):
            return True
    started_raw = metadata.get("started_at")
    if started_raw:
        try:
            started_at = datetime.fromisoformat(started_raw)
        except ValueError:
            return True
        return datetime.now() - started_at > timedelta(seconds=_CLAIM_STALE_TTL_SECONDS)
    try:
        modified_at = datetime.fromtimestamp(lock_path.stat().st_mtime)
    except OSError:
        return False
    return datetime.now() - modified_at > timedelta(seconds=_CLAIM_STALE_TTL_SECONDS)


def _open_exclusive_lock(lock_path: Path, *, slot_key: str) -> Optional[tuple[Any, bool]]:
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    if fcntl is not None:
        handle = open(lock_path, "a+", encoding="utf-8")
        try:
            fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except (BlockingIOError, OSError) as exc:
            handle.close()
            if isinstance(exc, BlockingIOError) or getattr(exc, "errno", None) in (
                errno.EACCES,
                errno.EAGAIN,
            ):
                return None
            raise
        _write_metadata(handle, slot_key=slot_key)
        return handle, True

    # pragma: no cover - platforms without fcntl
    fd: Optional[int] = None
    for _ in range(2):
        try:
            fd = os.open(str(lock_path), os.O_CREAT | os.O_EXCL | os.O_RDWR)
            break
        except FileExistsError:
            if not _is_claim_stale(lock_path):
                return None
            logger.warning("检测到过期的 scheduled_analysis.lock，尝试清理后重试。")
            try:
                lock_path.unlink()
            except OSError as exc:
                logger.warning("清理过期 scheduled_analysis.lock 失败: %s", exc)
                return None
    if fd is None:
        return None
    handle = os.fdopen(fd, "w+", encoding="utf-8")
    _write_metadata(handle, slot_key=slot_key)
    return handle, False


def try_begin_scheduled_slot(
    config: Config,
    *,
    slot_time: Optional[str] = None,
    markets: Optional[Sequence[str]] = None,
    persist_claim: bool = True,
    when: Optional[date] = None,
) -> Optional[ScheduledAnalysisLease]:
    """Claim one local schedule slot for this host/data directory.

    ``persist_claim=True`` (daily slots): after the first process claims the
    slot for the day, later processes skip even if the first run has finished.
    ``persist_claim=False`` (startup immediate): only prevents concurrent runs.
    """
    global _process_running
    slot_key = build_scheduled_slot_key(slot_time=slot_time, markets=markets, when=when)
    lock_path = scheduled_analysis_lock_path(config)
    claim_path = scheduled_slot_claim_path(config, slot_key) if persist_claim else None

    with _process_guard:
        if _process_running:
            return None

        if claim_path is not None and claim_path.exists():
            if _is_claim_stale(claim_path):
                logger.warning("检测到过期的定时槽位声明 %s，将重新抢占。", claim_path.name)
                try:
                    claim_path.unlink()
                except OSError as exc:
                    logger.warning("清理过期定时槽位声明失败: %s", exc)
                    return None
            else:
                return None

        opened = _open_exclusive_lock(lock_path, slot_key=slot_key)
        if opened is None:
            return None
        handle, uses_flock = opened

        # Re-check claim under the exclusive lock to close the race.
        if claim_path is not None:
            if claim_path.exists() and not _is_claim_stale(claim_path):
                try:
                    if uses_flock and fcntl is not None:
                        fcntl.flock(handle.fileno(), fcntl.LOCK_UN)
                finally:
                    handle.close()
                    if not uses_flock:
                        try:
                            lock_path.unlink()
                        except FileNotFoundError:
                            pass
                return None
            try:
                _write_claim_file(claim_path, slot_key=slot_key)
            except OSError as exc:
                logger.warning("写入定时槽位声明失败: %s", exc)
                try:
                    if uses_flock and fcntl is not None:
                        fcntl.flock(handle.fileno(), fcntl.LOCK_UN)
                finally:
                    handle.close()
                    if not uses_flock:
                        try:
                            lock_path.unlink()
                        except FileNotFoundError:
                            pass
                return None

        _process_running = True
        return ScheduledAnalysisLease(
            handle=handle,
            lock_path=lock_path,
            claim_path=claim_path,
            uses_flock=uses_flock,
            slot_key=slot_key,
            persist_claim=persist_claim,
        )


def release_scheduled_slot(lease: Optional[ScheduledAnalysisLease]) -> None:
    if lease is None:
        return

    global _process_running
    with _process_guard:
        _process_running = False

    try:
        if lease.uses_flock and fcntl is not None:
            fcntl.flock(lease.handle.fileno(), fcntl.LOCK_UN)
    finally:
        lease.handle.close()
        if not lease.uses_flock:
            try:
                lease.lock_path.unlink()
            except FileNotFoundError:
                pass
