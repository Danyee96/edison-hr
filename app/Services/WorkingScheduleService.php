<?php

namespace App\Services;

use Carbon\Carbon;
use Carbon\CarbonPeriod;

class WorkingScheduleService
{
    private const DAYS = [
        1 => 'monday',
        2 => 'tuesday',
        3 => 'wednesday',
        4 => 'thursday',
        5 => 'friday',
        6 => 'saturday',
        0 => 'sunday',
    ];

    public function schedule(?array $settings = null): array
    {
        $settings ??= settings();
        $storedSchedule = json_decode($settings['working_schedule'] ?? '[]', true);
        $legacyWorkingDays = json_decode($settings['working_days'] ?? '[1,2,3,4,5]', true);
        $legacyWorkingDays = is_array($legacyWorkingDays) ? array_map('intval', $legacyWorkingDays) : [1, 2, 3, 4, 5];

        $schedule = [];
        foreach (self::DAYS as $dayIndex => $dayName) {
            $day = $storedSchedule[$dayName] ?? [];
            $schedule[$dayName] = [
                'day_index' => $dayIndex,
                'enabled' => array_key_exists('enabled', $day) ? (bool) $day['enabled'] : in_array($dayIndex, $legacyWorkingDays, true),
                'open_time' => $this->validTime($day['open_time'] ?? null) ?: '09:00',
                'close_time' => $this->validTime($day['close_time'] ?? null) ?: '18:00',
            ];
        }

        return $schedule;
    }

    public function holidays(?array $settings = null): array
    {
        return collect($this->holidayDetails($settings))
            ->pluck('date')
            ->all();
    }

    public function holidayDetails(?array $settings = null): array
    {
        $settings ??= settings();
        $holidays = json_decode($settings['working_holidays'] ?? '[]', true);
        if (! is_array($holidays)) {
            return [];
        }

        return collect($holidays)
            ->map(function ($holiday) {
                if (is_array($holiday)) {
                    $date = trim((string) ($holiday['date'] ?? ''));
                    $name = trim((string) ($holiday['name'] ?? ''));
                } else {
                    $date = trim((string) $holiday);
                    $name = '';
                }

                if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
                    return null;
                }

                return [
                    'date' => $date,
                    'name' => $name !== '' ? $name : __('Holiday'),
                ];
            })
            ->filter()
            ->unique('date')
            ->sortBy('date')
            ->values()
            ->all();
    }

    public function holidayForDate($date, ?array $settings = null): ?array
    {
        $dateKey = Carbon::parse($date)->toDateString();

        return collect($this->holidayDetails($settings))
            ->firstWhere('date', $dateKey);
    }

    public function workingDayIndices(?array $settings = null): array
    {
        return collect($this->schedule($settings))
            ->filter(fn ($day) => $day['enabled'])
            ->pluck('day_index')
            ->values()
            ->all();
    }

    public function isWorkingDate($date, ?array $settings = null): bool
    {
        $carbon = Carbon::parse($date);
        $schedule = $this->schedule($settings);
        $day = $schedule[strtolower($carbon->format('l'))] ?? null;

        return (bool) ($day['enabled'] ?? false) && ! in_array($carbon->toDateString(), $this->holidays($settings), true);
    }

    public function expectedMinutesForDate($date, ?array $settings = null): int
    {
        $carbon = Carbon::parse($date);
        if (! $this->isWorkingDate($carbon, $settings)) {
            return 0;
        }

        $day = $this->schedule($settings)[strtolower($carbon->format('l'))];
        $open = Carbon::parse($day['open_time']);
        $close = Carbon::parse($day['close_time']);
        if ($close->lessThanOrEqualTo($open)) {
            $close->addDay();
        }

        return max(0, $open->diffInMinutes($close));
    }

    public function countWorkingDays($startDate, $endDate, ?array $settings = null): int
    {
        $count = 0;
        foreach (CarbonPeriod::create($startDate, $endDate) as $date) {
            if ($this->isWorkingDate($date, $settings)) {
                $count++;
            }
        }

        return $count;
    }

    public function totalWorkingMinutes($startDate, $endDate, ?array $settings = null): int
    {
        $minutes = 0;
        foreach (CarbonPeriod::create($startDate, $endDate) as $date) {
            $minutes += $this->expectedMinutesForDate($date, $settings);
        }

        return $minutes;
    }

    private function validTime(?string $value): ?string
    {
        if (! $value || ! preg_match('/^\d{2}:\d{2}$/', $value)) {
            return null;
        }

        return $value;
    }
}
