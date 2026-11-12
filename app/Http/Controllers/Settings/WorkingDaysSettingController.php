<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Services\WorkingScheduleService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class WorkingDaysSettingController extends Controller
{
    public function index(WorkingScheduleService $scheduleService)
    {
        if (! $this->canManageWorkingSchedule()) {
            return redirect()->back()->with('error', __('Permission Denied.'));
        }

        return Inertia::render('settings/working-days', [
            'workingSchedule' => $scheduleService->schedule(),
            'workingHolidays' => $scheduleService->holidayDetails(),
        ]);
    }

    public function getWorkingDaysSettings(WorkingScheduleService $scheduleService)
    {
        $settings = settings();
        $response = [];
        foreach ($scheduleService->workingDayIndices($settings) as $dayId) {
            $dayName = strtolower(\Carbon\Carbon::create()->dayOfWeek((int) $dayId)->format('l'));
            $response["working_day_{$dayName}"] = true;
        }

        return response()->json($response);
    }

    public function updateWorkingDaysSettings(Request $request, WorkingScheduleService $scheduleService)
    {
        if ($this->canManageWorkingSchedule()) {
            if ($request->has('schedule')) {
                $validated = $request->validate([
                    'schedule' => 'required|array',
                    'schedule.*.enabled' => 'boolean',
                    'schedule.*.open_time' => 'required|date_format:H:i',
                    'schedule.*.close_time' => 'required|date_format:H:i',
                    'holidays' => 'nullable|array',
                    'holidays.*.date' => 'required|date',
                    'holidays.*.name' => 'nullable|string|max:255',
                ]);

                $existingSchedule = $scheduleService->schedule();
                $schedule = [];
                $workingDayIds = [];

                foreach ($existingSchedule as $dayName => $day) {
                    $incoming = $validated['schedule'][$dayName] ?? [];
                    $enabled = (bool) ($incoming['enabled'] ?? false);
                    $schedule[$dayName] = [
                        'enabled' => $enabled,
                        'open_time' => $incoming['open_time'] ?? $day['open_time'],
                        'close_time' => $incoming['close_time'] ?? $day['close_time'],
                    ];

                    if ($enabled) {
                        $workingDayIds[] = $day['day_index'];
                    }
                }

                $holidays = collect($validated['holidays'] ?? [])
                    ->map(fn ($holiday) => [
                        'date' => \Carbon\Carbon::parse($holiday['date'])->toDateString(),
                        'name' => trim((string) ($holiday['name'] ?? '')) ?: __('Holiday'),
                    ])
                    ->unique('date')
                    ->sortBy('date')
                    ->values()
                    ->all();

                updateSetting('working_schedule', json_encode($schedule));
                updateSetting('working_holidays', json_encode($holidays));
                updateSetting('working_days', json_encode($workingDayIds));

                return redirect()->back()->with('success', __('Working days and hours updated successfully.'));
            }

            $validated = $request->validate([
                'working_days' => 'required|array',
                'working_days.*' => 'required|string|in:monday,tuesday,wednesday,thursday,friday,saturday,sunday',
            ]);

            $schedule = $scheduleService->schedule();
            $workingDayIds = [];
            foreach ($schedule as $dayName => &$day) {
                $day['enabled'] = in_array($dayName, $validated['working_days'], true);
                if ($day['enabled']) {
                    $workingDayIds[] = $day['day_index'];
                }
                unset($day['day_index']);
            }

            updateSetting('working_schedule', json_encode($schedule));
            updateSetting('working_days', json_encode($workingDayIds));

            return redirect()->back()->with('success', __('Working days settings updated successfully.'));
        }else{
            return redirect()->back()->with('error', __('Permission Denied.'));
        }
    }

    private function canManageWorkingSchedule(): bool
    {
        $user = Auth::user();

        return $user->can('manage-working-days-settings')
            || $user->can('update-working-days-settings')
            || $user->can('manage-attendance-records')
            || $user->can('manage-payroll-runs');
    }
}
