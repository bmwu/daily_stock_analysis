# -*- coding: utf-8 -*-
"""Tests for SCHEDULE_SLOTS parsing and market-aware scheduling."""

from __future__ import annotations

import sys
import unittest
from datetime import datetime
from unittest.mock import patch

from src.scheduler import (
    ScheduleSlot,
    markets_to_review_region,
    normalize_schedule_markets,
    normalize_schedule_slots,
    serialize_schedule_slots,
)


class ScheduleSlotsNormalizeTestCase(unittest.TestCase):
    def test_parse_slots_string(self):
        slots = normalize_schedule_slots("09:00|us;15:30|cn,hk,jp")
        self.assertEqual(
            slots,
            [
                ScheduleSlot(time="09:00", markets=("us",)),
                ScheduleSlot(time="15:30", markets=("cn", "hk", "jp")),
            ],
        )

    def test_empty_slots_fallback_to_times(self):
        slots = normalize_schedule_slots(
            "",
            schedule_times="18:00,09:00",
            fallback_time="18:00",
        )
        self.assertEqual(
            slots,
            [
                ScheduleSlot(time="09:00", markets=()),
                ScheduleSlot(time="18:00", markets=()),
            ],
        )

    def test_duplicate_times_keep_first(self):
        slots = normalize_schedule_slots("09:00|us;09:00|cn")
        self.assertEqual(slots, [ScheduleSlot(time="09:00", markets=("us",))])

    def test_invalid_markets_ignored(self):
        slots = normalize_schedule_slots("10:00|xx,yy")
        self.assertEqual(slots, [ScheduleSlot(time="18:00", markets=())])

    def test_serialize_roundtrip(self):
        raw = "09:00|us;15:30|cn,hk,jp"
        slots = normalize_schedule_slots(raw)
        self.assertEqual(serialize_schedule_slots(slots), raw)

    def test_normalize_markets_order(self):
        self.assertEqual(
            normalize_schedule_markets(["jp", "cn", "tw", "cn"]),
            ("cn", "jp", "tw"),
        )

    def test_markets_to_review_region(self):
        self.assertIsNone(markets_to_review_region(None))
        self.assertEqual(markets_to_review_region(["us", "tw"]), "us")
        self.assertEqual(markets_to_review_region(["tw"]), "")
        self.assertEqual(markets_to_review_region(["cn", "hk", "jp"]), "cn,hk,jp")


class SchedulerSlotsJobTestCase(unittest.TestCase):
    def test_scheduler_registers_slot_runners_with_markets(self):
        class _FakeJob:
            def __init__(self, schedule_module):
                self._schedule_module = schedule_module
                self.next_run = datetime(2026, 1, 1, 18, 0, 0)
                self.at_time = None
                self.job_func = None

            @property
            def day(self):
                return self

            def at(self, value):
                self.at_time = value
                hour, minute = [int(part) for part in value.split(":")]
                self.next_run = datetime(2026, 1, 1, hour, minute, 0)
                return self

            def do(self, fn, *args, **kwargs):
                self.job_func = fn
                self._schedule_module.jobs.append(self)
                return self

        class _FakeScheduleModule:
            def __init__(self):
                self.jobs = []

            def every(self):
                return _FakeJob(self)

            def get_jobs(self):
                return list(self.jobs)

            def run_pending(self):
                return None

            def cancel_job(self, job):
                self.jobs.remove(job)

        fake_schedule = _FakeScheduleModule()
        with patch.dict(sys.modules, {"schedule": fake_schedule}):
            from src.scheduler import Scheduler

            calls = []

            def task(markets=None):
                calls.append(markets)

            scheduler = Scheduler(
                schedule_time="18:00",
                schedule_slots=[
                    ScheduleSlot(time="09:00", markets=("us",)),
                    ScheduleSlot(time="15:30", markets=("cn", "hk")),
                ],
            )
            scheduler.set_daily_task(task, run_immediately=False)

            self.assertEqual([job.at_time for job in fake_schedule.jobs], ["09:00", "15:30"])
            fake_schedule.jobs[0].job_func()
            fake_schedule.jobs[1].job_func()

        self.assertEqual(calls, [["us"], ["cn", "hk"]])

    def test_scheduler_reloads_when_slot_markets_change(self):
        class _FakeJob:
            def __init__(self, schedule_module):
                self._schedule_module = schedule_module
                self.next_run = datetime(2026, 1, 1, 18, 0, 0)
                self.at_time = None

            @property
            def day(self):
                return self

            def at(self, value):
                self.at_time = value
                return self

            def do(self, fn, *args, **kwargs):
                self.job_func = fn
                self._schedule_module.jobs.append(self)
                return self

        class _FakeScheduleModule:
            def __init__(self):
                self.jobs = []

            def every(self):
                return _FakeJob(self)

            def get_jobs(self):
                return list(self.jobs)

            def cancel_job(self, job):
                self.jobs.remove(job)

        fake_schedule = _FakeScheduleModule()
        current = {"raw": "09:00|us"}
        with patch.dict(sys.modules, {"schedule": fake_schedule}):
            from src.scheduler import Scheduler

            scheduler = Scheduler(
                schedule_time="09:00",
                schedule_slots=[ScheduleSlot(time="09:00", markets=("us",))],
                schedule_slots_provider=lambda: current["raw"],
            )
            scheduler.set_daily_task(lambda **kwargs: None, run_immediately=False)
            self.assertEqual(scheduler.schedule_slots[0].markets, ("us",))

            current["raw"] = "09:00|cn,hk"
            scheduler.refresh_daily_schedule_if_needed()

        self.assertEqual(scheduler.schedule_slots[0].markets, ("cn", "hk"))


class FilterStocksByMarketsTestCase(unittest.TestCase):
    def test_filter_fail_open_unknown(self):
        from main import _filter_stocks_by_markets

        codes = _filter_stocks_by_markets(
            ["AAPL", "600519", "UNKNOWN_XYZ"],
            ["us"],
        )
        self.assertEqual(codes, ["AAPL", "UNKNOWN_XYZ"])


if __name__ == "__main__":
    unittest.main()
