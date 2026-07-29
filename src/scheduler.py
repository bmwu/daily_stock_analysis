# -*- coding: utf-8 -*-
"""
===================================
定时调度模块
===================================

职责：
1. 支持每日定时执行股票分析
2. 支持定时执行大盘复盘
3. 优雅处理信号，确保可靠退出

依赖：
- schedule: 轻量级定时任务库
"""

import logging
import re
import signal
import threading
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Callable, Dict, List, Mapping, Optional, Sequence, Tuple, Union

logger = logging.getLogger(__name__)

SCHEDULE_TIME_PATTERN = re.compile(r"(?:[01]\d|2[0-3]):[0-5]\d")
SCHEDULE_STOCK_MARKETS: Tuple[str, ...] = ("cn", "hk", "us", "jp", "kr", "tw")
SCHEDULE_STOCK_MARKET_SET = frozenset(SCHEDULE_STOCK_MARKETS)


@dataclass(frozen=True)
class ScheduleSlot:
    """One daily schedule trigger with optional market filter."""

    time: str
    markets: Tuple[str, ...] = ()

    @property
    def has_market_filter(self) -> bool:
        return bool(self.markets)


def normalize_schedule_times(
    schedule_times: Optional[Union[Sequence[str], str]],
    *,
    fallback_time: str = "18:00",
) -> List[str]:
    """Return sorted unique HH:MM schedule times with SCHEDULE_TIME fallback."""
    if isinstance(schedule_times, str):
        raw_items = [item.strip() for item in schedule_times.split(",")]
    elif schedule_times is None:
        raw_items = []
    else:
        raw_items = [str(item).strip() for item in schedule_times]

    valid = {
        item
        for item in raw_items
        if item and SCHEDULE_TIME_PATTERN.fullmatch(item)
    }
    if not valid:
        fallback = (fallback_time or "18:00").strip() or "18:00"
        valid.add(fallback if SCHEDULE_TIME_PATTERN.fullmatch(fallback) else "18:00")
    return sorted(valid)


def normalize_schedule_markets(
    markets: Optional[Union[Sequence[str], str]],
) -> Tuple[str, ...]:
    """Return ordered unique stock-analysis markets; empty means no filter."""
    if markets is None:
        return ()
    if isinstance(markets, str):
        raw_items = [item.strip().lower() for item in markets.split(",")]
    else:
        raw_items = [str(item).strip().lower() for item in markets]

    selected = {item for item in raw_items if item in SCHEDULE_STOCK_MARKET_SET}
    return tuple(market for market in SCHEDULE_STOCK_MARKETS if market in selected)


def serialize_schedule_slots(slots: Sequence[ScheduleSlot]) -> str:
    """Serialize schedule slots to SCHEDULE_SLOTS env form."""
    parts: List[str] = []
    for slot in slots:
        markets = ",".join(slot.markets) if slot.markets else ",".join(SCHEDULE_STOCK_MARKETS)
        parts.append(f"{slot.time}|{markets}")
    return ";".join(parts)


def _slot_from_mapping(item: Mapping[str, Any]) -> Optional[ScheduleSlot]:
    time_value = str(item.get("time", "") or "").strip()
    if not SCHEDULE_TIME_PATTERN.fullmatch(time_value):
        return None
    markets = normalize_schedule_markets(item.get("markets"))
    return ScheduleSlot(time=time_value, markets=markets)


def _parse_schedule_slots_raw(raw: str) -> List[ScheduleSlot]:
    """Parse ``HH:MM|market[,market...];...`` into slots (invalid tokens skipped)."""
    slots: List[ScheduleSlot] = []
    seen_times = set()
    for part in raw.split(";"):
        token = part.strip()
        if not token:
            continue
        if "|" in token:
            time_raw, markets_raw = token.split("|", 1)
        else:
            time_raw, markets_raw = token, ""
        time_value = time_raw.strip()
        if not SCHEDULE_TIME_PATTERN.fullmatch(time_value):
            logger.warning("Ignoring invalid SCHEDULE_SLOTS time token: %r", token)
            continue
        if time_value in seen_times:
            logger.warning("Ignoring duplicate SCHEDULE_SLOTS time: %s", time_value)
            continue
        markets = normalize_schedule_markets(markets_raw)
        # Bare time or empty market list => no market filter (all markets).
        if markets_raw.strip() and not markets:
            logger.warning("Ignoring SCHEDULE_SLOTS entry with no valid markets: %r", token)
            continue
        seen_times.add(time_value)
        slots.append(ScheduleSlot(time=time_value, markets=markets))
    return slots


def normalize_schedule_slots(
    schedule_slots: Optional[
        Union[str, Sequence[ScheduleSlot], Sequence[Mapping[str, Any]], Sequence[str]]
    ] = None,
    *,
    schedule_times: Optional[Union[Sequence[str], str]] = None,
    fallback_time: str = "18:00",
) -> List[ScheduleSlot]:
    """Normalize schedule slots; empty slots fall back to time-only legacy behavior.

    ``SCHEDULE_SLOTS`` non-empty values win. Otherwise times from
    ``SCHEDULE_TIMES`` / ``SCHEDULE_TIME`` are used with an empty market filter
    (analyze all markets, subject to trading-day checks).
    """
    parsed: List[ScheduleSlot] = []
    if isinstance(schedule_slots, str):
        raw = schedule_slots.strip()
        if raw:
            parsed = _parse_schedule_slots_raw(raw)
    elif schedule_slots:
        seen_times = set()
        for item in schedule_slots:
            slot: Optional[ScheduleSlot] = None
            if isinstance(item, ScheduleSlot):
                slot = item if SCHEDULE_TIME_PATTERN.fullmatch(item.time) else None
                if slot is not None:
                    slot = ScheduleSlot(
                        time=slot.time,
                        markets=normalize_schedule_markets(slot.markets),
                    )
            elif isinstance(item, Mapping):
                slot = _slot_from_mapping(item)
            elif isinstance(item, str) and "|" in item:
                parsed_one = _parse_schedule_slots_raw(item)
                slot = parsed_one[0] if parsed_one else None
            elif isinstance(item, str) and SCHEDULE_TIME_PATTERN.fullmatch(item.strip()):
                slot = ScheduleSlot(time=item.strip(), markets=())
            if slot is None:
                continue
            if slot.time in seen_times:
                continue
            seen_times.add(slot.time)
            parsed.append(slot)

    if parsed:
        return sorted(parsed, key=lambda slot: slot.time)

    times = normalize_schedule_times(schedule_times, fallback_time=fallback_time)
    return [ScheduleSlot(time=time_value, markets=()) for time_value in times]


def markets_to_review_region(markets: Optional[Sequence[str]]) -> Optional[str]:
    """Map stock-analysis markets to a market-review region string.

    Returns:
        None when ``markets`` is None (caller keeps config default)
        '' when markets were provided but none support market review
        comma-joined region otherwise
    """
    if markets is None:
        return None
    from src.utils.market_review_region import MARKET_REVIEW_REGION_ORDER

    selected = {str(item).strip().lower() for item in markets if str(item).strip()}
    regions = [region for region in MARKET_REVIEW_REGION_ORDER if region in selected]
    return ",".join(regions)


class GracefulShutdown:
    """
    优雅退出处理器

    捕获 SIGTERM/SIGINT 信号，确保任务完成后再退出
    """

    def __init__(self, register_signals: bool = True):
        self.shutdown_requested = False
        self._lock = threading.Lock()
        if not register_signals:
            return

        # 注册信号处理器
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)

    def _signal_handler(self, signum, frame):
        """信号处理函数"""
        with self._lock:
            if not self.shutdown_requested:
                logger.info(f"收到退出信号 ({signum})，等待当前任务完成...")
                self.shutdown_requested = True

    @property
    def should_shutdown(self) -> bool:
        """检查是否应该退出"""
        with self._lock:
            return self.shutdown_requested


class Scheduler:
    """
    定时任务调度器

    基于 schedule 库实现，支持：
    - 每日定时执行
    - 启动时立即执行
    - 优雅退出
    """

    def __init__(
        self,
        schedule_time: str = "18:00",
        schedule_time_provider: Optional[Callable[[], str]] = None,
        schedule_times: Optional[Sequence[str]] = None,
        schedule_times_provider: Optional[Callable[[], Union[Sequence[str], str]]] = None,
        schedule_slots: Optional[Sequence[ScheduleSlot]] = None,
        schedule_slots_provider: Optional[
            Callable[[], Union[Sequence[ScheduleSlot], str]]
        ] = None,
        register_signals: bool = True,
    ):
        """
        初始化调度器

        Args:
            schedule_time: 每日执行时间，格式 "HH:MM"
        """
        try:
            import schedule
            self.schedule = schedule
        except ImportError:
            logger.error("schedule 库未安装，请执行: pip install schedule")
            raise ImportError("请安装 schedule 库: pip install schedule")

        self.schedule_time = schedule_time
        self._schedule_time_provider = schedule_time_provider
        self._schedule_times_provider = schedule_times_provider
        self._schedule_slots_provider = schedule_slots_provider
        if schedule_slots is not None:
            self.schedule_slots = normalize_schedule_slots(
                schedule_slots,
                schedule_times=schedule_times,
                fallback_time=schedule_time,
            )
            self.schedule_times = [slot.time for slot in self.schedule_slots]
        elif schedule_times is not None:
            self.schedule_slots = normalize_schedule_slots(
                None,
                schedule_times=schedule_times,
                fallback_time=schedule_time,
            )
            self.schedule_times = [slot.time for slot in self.schedule_slots]
        else:
            # Preserve legacy sole-time semantics: keep the raw value so
            # set_daily_task can reject an invalid initial SCHEDULE_TIME.
            raw_time = (schedule_time or "").strip()
            self.schedule_times = [raw_time]
            if Scheduler._is_valid_schedule_time(raw_time):
                self.schedule_slots = [ScheduleSlot(time=raw_time, markets=())]
            else:
                self.schedule_slots = []
        self.shutdown_handler = GracefulShutdown(register_signals=register_signals)
        self._task_callback: Optional[Callable] = None
        self._daily_job: Optional[Any] = None
        self._daily_jobs: List[Any] = []
        self._background_tasks: List[Dict[str, Any]] = []
        self._running = False

    def set_daily_task(self, task: Callable, run_immediately: bool = True):
        """
        设置每日定时任务

        Args:
            task: 任务回调；可接受可选关键字参数 ``markets``
            run_immediately: 是否在设置后立即执行一次
        """
        self._task_callback = task
        slots = self.schedule_slots or normalize_schedule_slots(
            None,
            schedule_times=self.schedule_times,
            fallback_time=self.schedule_time,
        )
        # Reject invalid sole SCHEDULE_TIME before applying fallback semantics.
        if not self.schedule_slots and not any(
            self._is_valid_schedule_time(item) for item in self.schedule_times
        ):
            raise ValueError(f"无效的定时执行时间: {self.schedule_time!r}")
        if not self._configure_daily_slots(slots):
            raise ValueError(f"无效的定时执行时间: {self.schedule_time!r}")

        if run_immediately:
            logger.info("立即执行一次任务...")
            self._safe_run_task()

    @staticmethod
    def _is_valid_schedule_time(schedule_time: str) -> bool:
        """Validate time string in HH:MM 24-hour format."""
        candidate = (schedule_time or "").strip()
        return bool(SCHEDULE_TIME_PATTERN.fullmatch(candidate))

    def _cancel_daily_job(self) -> None:
        """Remove the currently registered daily job if one exists."""
        if self._daily_job is None and not self._daily_jobs:
            return

        for job in list(self._daily_jobs or [self._daily_job]):
            if job is None:
                continue
            if hasattr(self.schedule, "cancel_job"):
                self.schedule.cancel_job(job)
            else:  # pragma: no cover - compatibility fallback
                jobs = getattr(self.schedule, "jobs", None)
                if isinstance(jobs, list) and job in jobs:
                    jobs.remove(job)

        self._daily_job = None
        self._daily_jobs = []

    def _configure_daily_task(self, schedule_time: str) -> bool:
        """(Re)register a single daily job time (legacy API)."""
        candidate = (schedule_time or "").strip()
        if not self._is_valid_schedule_time(candidate):
            logger.warning(
                "检测到无效的定时执行时间 %r，继续沿用当前时间 %s",
                schedule_time,
                self.schedule_time,
            )
            return False
        return self._configure_daily_slots(
            normalize_schedule_slots(
                None,
                schedule_times=[candidate],
                fallback_time=self.schedule_time,
            )
        )

    def _configure_daily_tasks(self, schedule_times: Union[Sequence[str], str]) -> bool:
        """(Re)register daily jobs at the requested times (legacy time-only API)."""
        return self._configure_daily_slots(
            normalize_schedule_slots(
                None,
                schedule_times=schedule_times,
                fallback_time=self.schedule_time,
            )
        )

    def _slot_runner(self, markets: Optional[Sequence[str]]):
        """Build a zero-arg callback that executes the daily task for one slot."""

        def _runner() -> None:
            self._safe_run_task(markets=markets)

        return _runner

    def _configure_daily_slots(self, schedule_slots: Sequence[ScheduleSlot]) -> bool:
        """(Re)register daily jobs for schedule slots (time + optional markets)."""
        candidates = normalize_schedule_slots(
            schedule_slots,
            fallback_time=self.schedule_time,
        )
        if not candidates:
            logger.warning(
                "Invalid schedule slots; keeping current slots %s",
                serialize_schedule_slots(self.schedule_slots),
            )
            return False

        previous_slots = list(self.schedule_slots)
        self._cancel_daily_job()
        self._daily_jobs = []
        for slot in candidates:
            markets = list(slot.markets) if slot.markets else None
            job = self.schedule.every().day.at(slot.time).do(self._slot_runner(markets))
            self._daily_jobs.append(job)
        self._daily_job = self._daily_jobs[0] if self._daily_jobs else None
        self.schedule_slots = candidates
        self.schedule_times = [slot.time for slot in candidates]
        self.schedule_time = candidates[0].time if candidates else "18:00"

        rendered = serialize_schedule_slots(candidates)
        if previous_slots == candidates:
            logger.info("Daily scheduled jobs configured: %s", rendered)
        else:
            logger.info(
                "Schedule slots changed from %s to %s",
                serialize_schedule_slots(previous_slots),
                rendered,
            )
        return True

    def _refresh_daily_schedule_if_needed(self) -> None:
        """Reload daily schedule slots from the latest runtime config if needed."""
        if self._task_callback is None:
            return

        try:
            if self._schedule_slots_provider is not None:
                latest_slots = normalize_schedule_slots(
                    self._schedule_slots_provider(),
                    fallback_time=self.schedule_time,
                )
            elif self._schedule_times_provider is not None:
                latest_slots = normalize_schedule_slots(
                    None,
                    schedule_times=self._schedule_times_provider(),
                    fallback_time=self.schedule_time,
                )
            elif self._schedule_time_provider is not None:
                latest_slots = normalize_schedule_slots(
                    None,
                    schedule_times=[(self._schedule_time_provider() or "").strip()],
                    fallback_time=self.schedule_time,
                )
            else:
                return
        except Exception as exc:  # pragma: no cover - defensive branch
            logger.warning(
                "Failed to read latest schedule slots; keeping %s: %s",
                serialize_schedule_slots(self.schedule_slots),
                exc,
            )
            return

        if latest_slots == self.schedule_slots:
            return

        if self._configure_daily_slots(latest_slots):
            logger.info("Schedule refreshed; next run: %s", self._get_next_run_time())

    def refresh_daily_schedule_if_needed(self) -> None:
        """Public wrapper for runtime scheduler reconciliation."""
        self._refresh_daily_schedule_if_needed()

    def _safe_run_task(self, markets: Optional[Sequence[str]] = None):
        """安全执行任务（带异常捕获）"""
        if self._task_callback is None:
            return

        try:
            logger.info("=" * 50)
            logger.info(f"定时任务开始执行 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            if markets:
                logger.info("本轮限定市场: %s", ",".join(markets))
            logger.info("=" * 50)

            try:
                self._task_callback(markets=list(markets) if markets else None)
            except TypeError:
                self._task_callback()

            logger.info(f"定时任务执行完成 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

        except Exception as e:
            logger.exception(f"定时任务执行失败: {e}")

    def add_background_task(
        self,
        task: Callable,
        interval_seconds: int,
        run_immediately: bool = False,
        name: Optional[str] = None,
    ) -> None:
        """Register a periodic background task executed inside the scheduler loop.

        Note: The scheduler loop polls every 30 seconds, so *interval_seconds*
        below 30 will be clamped to 30 to avoid promising unreachable precision.
        """
        clamped_interval = max(30, int(interval_seconds))
        if int(interval_seconds) < 30:
            logger.warning(
                "后台任务 %s 请求间隔 %ds，但调度循环每 30s 轮询一次，已自动调整为 30s",
                name or getattr(task, "__name__", "background_task"),
                interval_seconds,
            )
        entry = {
            "task": task,
            "interval_seconds": clamped_interval,
            "last_run": 0.0,
            "name": name or getattr(task, "__name__", "background_task"),
            "thread": None,
            "running": False,
        }
        if not run_immediately:
            entry["last_run"] = time.time()
        self._background_tasks.append(entry)
        logger.info(
            "已注册后台任务: %s（间隔 %s 秒，立即执行=%s）",
            entry["name"],
            entry["interval_seconds"],
            run_immediately,
        )
        if run_immediately:
            self._start_background_task(entry)

    def _start_background_task(self, entry: Dict[str, Any]) -> bool:
        """Start one background task in a dedicated daemon thread."""
        worker = entry.get("thread")
        if worker is not None and worker.is_alive():
            return False

        def _runner() -> None:
            try:
                logger.info("后台任务开始执行: %s", entry["name"])
                entry["task"]()
            except Exception as exc:
                logger.exception("后台任务执行失败 [%s]: %s", entry["name"], exc)
            finally:
                entry["running"] = False
                entry["thread"] = None

        entry["last_run"] = time.time()
        entry["running"] = True
        worker = threading.Thread(
            target=_runner,
            daemon=True,
            name=f"scheduler-bg-{entry['name']}",
        )
        entry["thread"] = worker
        worker.start()
        return True

    def _run_background_tasks(self) -> None:
        """Execute any background tasks whose interval has elapsed."""
        if not self._background_tasks:
            return

        now = time.time()
        for entry in self._background_tasks:
            worker = entry.get("thread")
            if worker is not None and worker.is_alive():
                continue
            if entry.get("running"):
                entry["running"] = False
                entry["thread"] = None
            if now - entry["last_run"] < entry["interval_seconds"]:
                continue
            self._start_background_task(entry)

    def run(self):
        """
        运行调度器主循环

        阻塞运行，直到收到退出信号
        """
        self._running = True
        logger.info("调度器开始运行...")
        logger.info(f"下次执行时间: {self._get_next_run_time()}")

        while self._running and not self.shutdown_handler.should_shutdown:
            self._refresh_daily_schedule_if_needed()
            self.schedule.run_pending()
            self._run_background_tasks()
            time.sleep(30)  # 每30秒检查一次

            # 每小时打印一次心跳
            if datetime.now().minute == 0 and datetime.now().second < 30:
                logger.info(f"调度器运行中... 下次执行: {self._get_next_run_time()}")

        logger.info("调度器已停止")

    def _get_next_run_time(self) -> str:
        """获取下次执行时间"""
        jobs = self.schedule.get_jobs()
        if jobs:
            next_run = min(job.next_run for job in jobs)
            return next_run.strftime('%Y-%m-%d %H:%M:%S')
        return "未设置"

    def stop(self):
        """停止调度器"""
        self._running = False
        self._cancel_daily_job()


def run_with_schedule(
    task: Callable,
    schedule_time: str = "18:00",
    run_immediately: bool = True,
    background_tasks: Optional[List[Dict[str, Any]]] = None,
    schedule_time_provider: Optional[Callable[[], str]] = None,
    schedule_times: Optional[Sequence[str]] = None,
    schedule_times_provider: Optional[Callable[[], Union[Sequence[str], str]]] = None,
    schedule_slots: Optional[Sequence[ScheduleSlot]] = None,
    schedule_slots_provider: Optional[
        Callable[[], Union[Sequence[ScheduleSlot], str]]
    ] = None,
):
    """
    便捷函数：使用定时调度运行任务

    Args:
        task: 要执行的任务函数
        schedule_time: 每日执行时间
        run_immediately: 是否立即执行一次
        background_tasks: 可选的后台任务定义列表。每项为一个字典，
            需包含 `task` 与 `interval_seconds`，可选包含 `name`
            和 `run_immediately`。`interval_seconds` 单位为秒。
        schedule_time_provider: 可选的时间提供器；调度器每轮检查前会读取，
            当返回值变化时自动重建 daily job。
        schedule_slots: 可选的时间+市场槽位列表；优先于纯时间列表。
        schedule_slots_provider: 可选的槽位提供器，用于热重载。
    """
    scheduler_kwargs: Dict[str, Any] = {
        "schedule_time": schedule_time,
        "schedule_time_provider": schedule_time_provider,
    }
    if schedule_slots is not None:
        scheduler_kwargs["schedule_slots"] = schedule_slots
    if schedule_slots_provider is not None:
        scheduler_kwargs["schedule_slots_provider"] = schedule_slots_provider
    if schedule_times is not None:
        scheduler_kwargs["schedule_times"] = schedule_times
    if schedule_times_provider is not None:
        scheduler_kwargs["schedule_times_provider"] = schedule_times_provider
    scheduler = Scheduler(**scheduler_kwargs)
    for entry in background_tasks or []:
        scheduler.add_background_task(
            task=entry["task"],
            interval_seconds=entry["interval_seconds"],
            run_immediately=entry.get("run_immediately", False),
            name=entry.get("name"),
        )
    scheduler.set_daily_task(task, run_immediately=run_immediately)
    scheduler.run()


if __name__ == "__main__":
    # 测试定时调度
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s | %(levelname)-8s | %(name)-20s | %(message)s',
    )

    def test_task():
        print(f"任务执行中... {datetime.now()}")
        time.sleep(2)
        print("任务完成!")

    print("启动测试调度器（按 Ctrl+C 退出）")
    run_with_schedule(test_task, schedule_time="23:59", run_immediately=True)
