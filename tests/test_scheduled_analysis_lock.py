# -*- coding: utf-8 -*-
"""Cross-process scheduled analysis slot lock/claim tests."""

from __future__ import annotations

import tempfile
import unittest
from datetime import date, datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import src.core.scheduled_analysis_lock as scheduled_lock


class ScheduledAnalysisLockTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self._orig_running = scheduled_lock._process_running
        scheduled_lock._process_running = False

    def tearDown(self) -> None:
        scheduled_lock._process_running = self._orig_running

    def test_build_slot_key_normalizes_markets(self) -> None:
        key = scheduled_lock.build_scheduled_slot_key(
            slot_time="18:00",
            markets=["hk", "CN", "jp"],
            when=date(2026, 7, 31),
        )
        self.assertEqual(key, "2026-07-31|18:00|cn,hk,jp")

    def test_second_process_skips_same_persisted_slot(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            config = SimpleNamespace(database_path=str(Path(temp_dir) / "stock_analysis.db"))
            first = scheduled_lock.try_begin_scheduled_slot(
                config,
                slot_time="18:00",
                markets=["cn", "hk"],
                persist_claim=True,
                when=date(2026, 7, 31),
            )
            self.assertIsNotNone(first)
            scheduled_lock.release_scheduled_slot(first)

            second = scheduled_lock.try_begin_scheduled_slot(
                config,
                slot_time="18:00",
                markets=["hk", "cn"],
                persist_claim=True,
                when=date(2026, 7, 31),
            )
            self.assertIsNone(second)

    def test_concurrent_holder_blocks_without_claim(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            config = SimpleNamespace(database_path=str(Path(temp_dir) / "stock_analysis.db"))
            first = scheduled_lock.try_begin_scheduled_slot(
                config,
                slot_time=None,
                persist_claim=False,
            )
            self.assertIsNotNone(first)
            try:
                second = scheduled_lock.try_begin_scheduled_slot(
                    config,
                    slot_time=None,
                    persist_claim=False,
                )
                self.assertIsNone(second)
            finally:
                scheduled_lock.release_scheduled_slot(first)

            third = scheduled_lock.try_begin_scheduled_slot(
                config,
                slot_time=None,
                persist_claim=False,
            )
            self.assertIsNotNone(third)
            scheduled_lock.release_scheduled_slot(third)

    def test_different_slots_same_day_can_both_run(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            config = SimpleNamespace(database_path=str(Path(temp_dir) / "stock_analysis.db"))
            morning = scheduled_lock.try_begin_scheduled_slot(
                config,
                slot_time="09:00",
                markets=["us"],
                persist_claim=True,
                when=date(2026, 7, 31),
            )
            self.assertIsNotNone(morning)
            scheduled_lock.release_scheduled_slot(morning)

            evening = scheduled_lock.try_begin_scheduled_slot(
                config,
                slot_time="18:00",
                markets=["cn", "hk"],
                persist_claim=True,
                when=date(2026, 7, 31),
            )
            self.assertIsNotNone(evening)
            scheduled_lock.release_scheduled_slot(evening)

    def test_stale_claim_can_be_reclaimed(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            config = SimpleNamespace(database_path=str(Path(temp_dir) / "stock_analysis.db"))
            slot_key = scheduled_lock.build_scheduled_slot_key(
                slot_time="18:00",
                markets=["cn"],
                when=date(2026, 7, 31),
            )
            claim_path = scheduled_lock.scheduled_slot_claim_path(config, slot_key)
            claim_path.parent.mkdir(parents=True, exist_ok=True)
            old = datetime.now() - timedelta(hours=25)
            claim_path.write_text(
                f"pid=1\nstarted_at={old.isoformat()}\nslot_key={slot_key}\n",
                encoding="utf-8",
            )
            lease = scheduled_lock.try_begin_scheduled_slot(
                config,
                slot_time="18:00",
                markets=["cn"],
                persist_claim=True,
                when=date(2026, 7, 31),
            )
            self.assertIsNotNone(lease)
            scheduled_lock.release_scheduled_slot(lease)


class SchedulerHostLockWiringTestCase(unittest.TestCase):
    def test_safe_run_task_skips_when_slot_unavailable(self) -> None:
        from src.scheduler import Scheduler

        calls = []

        def task(markets=None):
            calls.append(markets)

        sched = Scheduler(schedule_time="18:00", register_signals=False)
        sched._task_callback = task
        with patch(
            "src.core.scheduled_analysis_lock.try_begin_scheduled_slot",
            return_value=None,
        ), patch(
            "src.core.scheduled_analysis_lock.release_scheduled_slot",
        ) as release:
            sched._safe_run_task(
                markets=["cn"],
                slot_time="18:00",
                persist_claim=True,
            )
        self.assertEqual(calls, [])
        release.assert_called_once_with(None)

    def test_safe_run_task_runs_when_lease_acquired(self) -> None:
        from src.scheduler import Scheduler

        calls = []
        lease = SimpleNamespace(slot_key="2026-07-31|18:00|cn")

        def task(markets=None):
            calls.append(list(markets or []))

        sched = Scheduler(schedule_time="18:00", register_signals=False)
        sched._task_callback = task
        with patch(
            "src.core.scheduled_analysis_lock.try_begin_scheduled_slot",
            return_value=lease,
        ) as begin, patch(
            "src.core.scheduled_analysis_lock.release_scheduled_slot",
        ) as release, patch(
            "src.config.get_config",
            return_value=SimpleNamespace(database_path="./data/stock_analysis.db"),
        ):
            sched._safe_run_task(
                markets=["cn"],
                slot_time="18:00",
                persist_claim=True,
            )
        self.assertEqual(calls, [["cn"]])
        begin.assert_called_once()
        release.assert_called_once_with(lease)


if __name__ == "__main__":
    unittest.main()
