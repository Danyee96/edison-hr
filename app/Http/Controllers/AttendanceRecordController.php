<?php

namespace App\Http\Controllers;

use App\Models\AttendancePolicy;
use App\Models\AttendanceRecord;
use App\Models\Employee;
use App\Models\IpRestriction;
use App\Models\LeaveApplication;
use App\Models\Shift;
use App\Models\User;
use App\Services\LegacyAttendanceSheetImportService;
use App\Services\WorkingScheduleService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;

class AttendanceRecordController extends Controller
{
    public function index(Request $request)
    {
        if (Auth::user()->can('manage-attendance-records')) {
            $data = $this->attendanceViewData($request);

            return Inertia::render('hr/attendance-records/index', [
                'attendanceDays' => $data['days'],
                'attendanceAnalytics' => $data['analytics'],
                'selectedEmployee' => $data['employees']->firstWhere('id', $data['selected_employee_id']),
                'employees' => $data['employees'],
                'filters' => [
                    'employee_id' => $data['selected_employee_id'] ?: null,
                    'month' => $data['month'],
                ],
            ]);
        } else {
            return redirect()->back()->with('error', __('Permission Denied.'));
        }
    }

    private function getFilteredEmployees()
    {
        // Get employees for filter dropdown (compatible with getFilteredEmployees logic)
        $employeeQuery = Employee::whereIn('created_by', getCompanyAndUsersId());

        if (Auth::user()->can('manage-own-attendance-records') && ! Auth::user()->can('manage-any-attendance-records')) {
            $employeeQuery->where(function ($q) {
                $q->where('created_by', Auth::id())->orWhere('user_id', Auth::id());
            });
        }

        $employees = User::emp()
            ->with('employee.department')
            ->whereIn('created_by', getCompanyAndUsersId())
            ->where('status', 'active')
            ->whereIn('id', $employeeQuery->pluck('user_id'))
            ->select('id', 'name')
            ->orderByRaw($this->userEmployeeIdSortExpression('users.id').' asc')
            ->orderBy('name')
            ->get()
            ->map(function ($user) {
                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'employee_id' => $user->employee->employee_id_display ?? '',
                    'department_name' => $user->employee?->department?->name ?? '',
                ];
            });

        return $employees;
    }

    private function attendanceViewData(Request $request): array
    {
        $employees = $this->getFilteredEmployees();
        $selectedEmployeeId = $request->employee_id && $request->employee_id !== 'all'
            ? (int) $request->employee_id
            : (int) ($employees->first()['id'] ?? 0);
        $month = $request->month ?: now()->format('Y-m');
        $monthStart = Carbon::createFromFormat('Y-m', $month)->startOfMonth();
        $monthEnd = $monthStart->copy()->endOfMonth();
        $workingSchedule = app(WorkingScheduleService::class);

        $records = collect();
        if ($selectedEmployeeId) {
            $records = AttendanceRecord::with(['employee', 'shift', 'attendancePolicy'])
                ->where('employee_id', $selectedEmployeeId)
                ->whereBetween('date', [$monthStart->toDateString(), $monthEnd->toDateString()])
                ->where(function ($q) {
                    if (Auth::user()->can('manage-any-attendance-records')) {
                        $q->whereIn('created_by', getCompanyAndUsersId());
                    } elseif (Auth::user()->can('manage-own-attendance-records')) {
                        $q->where('created_by', Auth::id())->orWhere('employee_id', Auth::id());
                    } else {
                        $q->whereRaw('1 = 0');
                    }
                })
                ->orderBy('date')
                ->get()
                ->keyBy(fn ($record) => $record->date->toDateString());
        }

        $days = collect();
        for ($date = $monthStart->copy(); $date->lte($monthEnd); $date->addDay()) {
            $dateKey = $date->toDateString();
            $record = $records->get($dateKey);
            $holiday = $workingSchedule->holidayForDate($date);
            $isWorkingDate = $workingSchedule->isWorkingDate($date);
            $leaveType = null;

            $leaveApplication = null;
            if ($selectedEmployeeId && (! $record || $record?->status === 'on_leave')) {
                $leaveApplication = LeaveApplication::where('employee_id', $record?->employee_id ?? $selectedEmployeeId)
                    ->whereDate('start_date', '<=', $dateKey)
                    ->whereDate('end_date', '>=', $dateKey)
                    ->where('status', 'approved')
                    ->with('leaveType')
                    ->first();
                $leaveType = $leaveApplication?->leaveType;
            }

            $partialPunch = $record && ! $holiday && (
                ($record->clock_in && ! $record->clock_out)
                || (! $record->clock_in && $record->clock_out)
            );
            $missingClockIn = (bool) ($record && ! $holiday && empty($record->clock_in) && ! empty($record->clock_out));

            if ($holiday) {
                $status = (! $record || $record->status === 'absent' || $record->status === 'no_record') ? 'holiday' : $record->status;
            } elseif ($leaveApplication) {
                $status = 'on_leave';
            } else {
                $status = $record?->status ?? ($isWorkingDate ? 'absent' : 'holiday');
                if ($status === 'no_record') {
                    $status = $isWorkingDate ? 'absent' : 'holiday';
                }
            }

            if ($partialPunch) {
                $status = 'present';
            }

            $days->push([
                'id' => $record?->id,
                'date' => $dateKey,
                'day_name' => $date->format('D'),
                'employee_id' => $selectedEmployeeId,
                'employee' => $record?->employee,
                'shift' => $record?->shift,
                'status' => $status,
                'clock_in' => $record?->clock_in,
                'clock_out' => $record?->clock_out,
                'on_duty' => $record?->on_duty,
                'off_duty' => $record?->off_duty,
                'default_clock_in_time' => $record?->on_duty ?: $record?->shift?->start_time,
                'break_hours' => (float) ($record?->break_hours ?? 0),
                'total_hours' => (float) ($record?->total_hours ?? 0),
                'overtime_hours' => (float) ($record?->overtime_hours ?? 0),
                'late_minutes' => (int) ($record?->late_minutes ?? 0),
                'early_leave_minutes' => (int) ($record?->early_leave_minutes ?? 0),
                'is_late' => (bool) ($record?->is_late ?? false),
                'is_early_departure' => (bool) ($record?->is_early_departure ?? false),
                'is_weekend' => (bool) ($record?->is_weekend ?? $date->isWeekend()),
                'is_holiday' => (bool) ($record?->is_holiday ?? false) || (bool) $holiday,
                'is_partial_punch' => (bool) $partialPunch,
                'missing_clock_in' => $missingClockIn,
                'holiday' => $holiday,
                'notes' => $record?->notes,
                'leave_type' => $leaveType,
            ]);
        }

        $analytics = [
            'calendar_days' => $days->count(),
            'present' => $days->where('status', 'present')->count(),
            'absent' => $days->filter(fn ($day) => $day['status'] === 'absent')->count(),
            'no_clockin' => $days->where('missing_clock_in', true)->count(),
            'partial_clockins' => $days->where('is_partial_punch', true)->count(),
            'holidays' => $days->where('status', 'holiday')->count(),
            'missing_records' => $days->where('status', 'no_record')->count(),
            'late_days' => $days->where('is_late', true)->count(),
            'total_late_minutes' => $records
                ->sum(fn (AttendanceRecord $record) => $record->payableLateMinutes()),
            'early_departures' => $days->where('is_early_departure', true)->count(),
            'total_early_leave_minutes' => $days->sum('early_leave_minutes'),
            'total_hours' => round($days->sum('total_hours'), 2),
            'overtime_hours' => round($days->sum('overtime_hours'), 2),
        ];

        return [
            'employees' => $employees,
            'selected_employee_id' => $selectedEmployeeId,
            'month' => $month,
            'days' => $days,
            'analytics' => $analytics,
        ];
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'employee_id' => 'required|exists:users,id',
            'date' => 'required|date',
            'clock_in' => 'nullable|date_format:H:i',
            'clock_out' => 'nullable|date_format:H:i',
            'break_hours' => 'nullable|numeric|min:0',
            'is_holiday' => 'boolean',
            'status' => 'required|in:present,absent,half_day,on_leave,holiday',
            'notes' => 'nullable|string',
        ]);

        // Get employee with shift and policy
        $employee = \App\Models\Employee::where('user_id', $validated['employee_id'])->first();

        $workingSchedule = app(WorkingScheduleService::class);
        if (empty($workingSchedule->workingDayIndices())) {
            return redirect()->back()->with('error', __('Please configure working days first.'));
        }

        if (! $workingSchedule->isWorkingDate($validated['date'])) {
            return redirect()->back()->with('error', __('Cannot create attendance record for non-working day.'));
        }

        // Check if employee has approved leave for this date
        $hasApprovedLeave = LeaveApplication::where('employee_id', $validated['employee_id'])
            ->where('status', 'approved')
            ->whereDate('start_date', '<=', $validated['date'])
            ->whereDate('end_date', '>=', $validated['date'])
            ->exists();

        if ($hasApprovedLeave) {
            return redirect()->back()->with('error', __('Employee has approved leave for this date. Cannot create attendance record.'));
        }

        // Check if record already exists
        $exists = AttendanceRecord::where('employee_id', $validated['employee_id'])
            ->where('date', $validated['date'])
            ->whereIn('created_by', getCompanyAndUsersId())
            ->exists();

        if ($exists) {
            return redirect()->back()->with('error', __('Attendance record already exists for this employee and date.'));
        }

        // Use employee's assigned shift and policy, or get defaults
        $shift = $employee && $employee->shift_id ?
            Shift::find($employee->shift_id) :
            Shift::whereIn('created_by', getCompanyAndUsersId())->where('status', 'active')->first();

        $policy = $employee && $employee->attendance_policy_id ?
            AttendancePolicy::find($employee->attendance_policy_id) :
            AttendancePolicy::whereIn('created_by', getCompanyAndUsersId())->where('status', 'active')->first();

        $validated['shift_id'] = $shift?->id;
        $validated['attendance_policy_id'] = $policy?->id;
        $validated['created_by'] = creatorId();
        $validated['is_holiday'] = $validated['is_holiday'] ?? false;
        $validated['break_hours'] = $validated['break_hours'] ?? 0;

        // Set weekend flag
        $validated['is_weekend'] = Carbon::parse($validated['date'])->isWeekend();

        $record = AttendanceRecord::create($validated);

        // Process complete attendance calculation
        $record->fresh(); // Reload to get relationships
        $record->processAttendance();

        return redirect()->back()->with('success', __('Attendance record created successfully.'));
    }

    public function importSheet(Request $request, LegacyAttendanceSheetImportService $importService)
    {
        if (! Auth::user()->can('manage-attendance-records')) {
            return redirect()->back()->with('error', __('Permission Denied.'));
        }

        $validated = $request->validate([
            'file' => 'nullable|required_without:import_token|file|max:10240',
            'import_token' => 'nullable|string',
            'employee_mappings' => 'nullable|array',
            'employee_mappings.*' => 'nullable|integer|exists:users,id',
            'ignored_attendance_lines' => 'nullable|array',
            'ignored_attendance_lines.*' => 'integer',
        ]);

        try {
            if ($request->filled('import_token')) {
                $token = basename((string) $validated['import_token']);
                $path = Storage::path('attendance-imports/'.$token);

                if (! is_file($path)) {
                    return redirect()->back()->with('error', __('Attendance import file has expired. Please upload it again.'));
                }

                $stats = $importService->import(
                    $path,
                    creatorId(),
                    null,
                    $validated['employee_mappings'] ?? [],
                    $validated['ignored_attendance_lines'] ?? []
                );
                Storage::delete('attendance-imports/'.$token);

                return redirect()->back()->with('success', __('Attendance sheet imported. Created: :created, Updated: :updated, Employees Created: :employees, Skipped: :skipped', [
                    'created' => $stats['attendance_created'],
                    'updated' => $stats['attendance_updated'],
                    'employees' => $stats['employees_created'],
                    'skipped' => $stats['skipped'],
                ]));
            }

            $file = $validated['file'];
            $allowedExtensions = ['xls', 'xlsx', 'xlsm', 'xlt', 'xltx', 'xltm', 'csv'];
            $extension = strtolower($file->getClientOriginalExtension());
            if (! in_array($extension, $allowedExtensions, true)) {
                return redirect()->back()->with('error', __('Please upload an Excel attendance sheet.'));
            }

            $missingRows = $importService->missingEmployeeRows($file);
            if (! empty($missingRows)) {
                $token = (string) Str::uuid().'.'.$extension;
                $file->storeAs('attendance-imports', $token);

                return redirect()->back()->with('attendance_import_mapping', [
                    'token' => $token,
                    'rows' => $missingRows,
                ]);
            }

            $stats = $importService->import($file, creatorId());

            return redirect()->back()->with('success', __('Attendance sheet imported. Created: :created, Updated: :updated, Employees Created: :employees, Skipped: :skipped', [
                'created' => $stats['attendance_created'],
                'updated' => $stats['attendance_updated'],
                'employees' => $stats['employees_created'],
                'skipped' => $stats['skipped'],
            ]));
        } catch (\Throwable $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }

    public function export(Request $request)
    {
        if (! Auth::user()->can('manage-attendance-records')) {
            abort(403);
        }

        $data = $this->attendanceViewData($request);
        $employee = $data['employees']->firstWhere('id', $data['selected_employee_id']);
        $safeName = Str::slug($employee['name'] ?? 'employee') ?: 'employee';
        $filename = "attendance-{$safeName}-{$data['month']}.csv";

        return response()->streamDownload(function () use ($data, $employee) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['Employee', $employee['name'] ?? '-']);
            fputcsv($handle, ['Employee ID', $employee['employee_id'] ?? '-']);
            fputcsv($handle, ['Month', $data['month']]);
            fputcsv($handle, []);
            fputcsv($handle, ['Date', 'Day', 'Status', 'On Duty', 'Off Duty', 'Clock In', 'Clock Out', 'Total Hours', 'Late Minutes', 'Early Leave Minutes', 'Overtime Hours', 'Notes']);

            foreach ($data['days'] as $day) {
                fputcsv($handle, [
                    $day['date'],
                    $day['day_name'],
                    $day['status'],
                    $day['on_duty'] ?: '',
                    $day['off_duty'] ?: '',
                    $day['clock_in'] ?: '',
                    $day['clock_out'] ?: '',
                    $day['total_hours'],
                    $day['late_minutes'],
                    $day['early_leave_minutes'],
                    $day['overtime_hours'],
                    $day['notes'] ?: '',
                ]);
            }

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    public function update(Request $request, $attendanceRecordId)
    {

        $attendanceRecord = AttendanceRecord::where('id', $attendanceRecordId)
            ->whereIn('created_by', getCompanyAndUsersId())
            ->first();

        $workingSchedule = app(WorkingScheduleService::class);
        if (empty($workingSchedule->workingDayIndices())) {
            return redirect()->back()->with('error', __('Please configure working days first.'));
        }

        if (! $workingSchedule->isWorkingDate($request->date)) {
            return redirect()->back()->with('error', __('Cannot create attendance record for non-working day.'));
        }

        // Check if employee has approved leave for this date
        $hasApprovedLeave = LeaveApplication::where('employee_id', $request->employee_id)
            ->where('status', 'approved')
            ->whereDate('start_date', '<=', $request->date)
            ->whereDate('end_date', '>=', $request->date)
            ->exists();

        if ($hasApprovedLeave) {
            return redirect()->back()->with('error', __('Employee has approved leave for this date. Cannot create attendance record.'));
        }

        if ($attendanceRecord) {
            try {
                $validated = $request->validate([
                    'employee_id' => 'required|exists:users,id',
                    'date' => 'required|date',
                    'clock_in' => 'nullable|date_format:H:i',
                    'clock_out' => 'nullable|date_format:H:i',
                    'break_hours' => 'nullable|numeric|min:0',
                    'is_holiday' => 'boolean',
                    'status' => 'required|in:present,absent,half_day,on_leave,holiday',
                    'notes' => 'nullable|string',
                ]);

                // Check if employee or date changed and if duplicate exists
                if ($attendanceRecord->employee_id != $validated['employee_id'] || $attendanceRecord->date != $validated['date']) {
                    $exists = AttendanceRecord::where('employee_id', $validated['employee_id'])
                        ->where('date', $validated['date'])
                        ->where('id', '!=', $attendanceRecordId)
                        ->exists();

                    if ($exists) {
                        return redirect()->back()->with('error', __('Attendance record already exists for this employee and date.'));
                    }
                }

                // Get employee with shift and policy
                $employee = \App\Models\Employee::where('user_id', $validated['employee_id'])->first();

                // Use employee's assigned shift and policy, or get defaults
                $shift = $employee && $employee->shift_id ?
                    Shift::find($employee->shift_id) :
                    Shift::whereIn('created_by', getCompanyAndUsersId())->where('status', 'active')->first();

                $policy = $employee && $employee->attendance_policy_id ?
                    AttendancePolicy::find($employee->attendance_policy_id) :
                    AttendancePolicy::whereIn('created_by', getCompanyAndUsersId())->where('status', 'active')->first();

                $validated['shift_id'] = $shift?->id;
                $validated['attendance_policy_id'] = $policy?->id;

                // Set weekend flag
                $validated['is_weekend'] = Carbon::parse($validated['date'])->isWeekend();

                $attendanceRecord->update($validated);

                // Process complete attendance calculation
                $attendanceRecord->fresh(); // Reload to get relationships
                $attendanceRecord->processAttendance();

                return redirect()->back()->with('success', __('Attendance record updated successfully'));
            } catch (\Exception $e) {
                return redirect()->back()->with('error', $e->getMessage() ?: __('Failed to update attendance record'));
            }
        } else {
            return redirect()->back()->with('error', __('Attendance record Not Found.'));
        }
    }

    public function destroy($attendanceRecordId)
    {
        $attendanceRecord = AttendanceRecord::where('id', $attendanceRecordId)
            ->whereIn('created_by', getCompanyAndUsersId())
            ->first();

        if ($attendanceRecord) {
            try {
                $attendanceRecord->delete();

                return redirect()->back()->with('success', __('Attendance record deleted successfully'));
            } catch (\Exception $e) {
                return redirect()->back()->with('error', $e->getMessage() ?: __('Failed to delete attendance record'));
            }
        } else {
            return redirect()->back()->with('error', __('Attendance record Not Found.'));
        }
    }

    public function clockIn(Request $request)
    {
        if (Auth::user()->can('clock-in-out')) {
            try {
                $validated = $request->validate([
                    'employee_id' => 'required|exists:users,id',
                ]);

                $settings = settings();
                if (! empty($settings['ipRestrictionEnabled']) && $settings['ipRestrictionEnabled'] == 1) {
                    $loginUserIp = request()->ip();
                    $ip = IpRestriction::whereIn('created_by', getCompanyAndUsersId())->where('ip_address', $loginUserIp)->first();
                    if (empty($ip) || is_null($ip)) {
                        return redirect()->back()->with('error', __('This IP Address Is Not Allowed For Clock In & Clock Out.'));
                    }
                }

                $today = Carbon::today();
                $now = Carbon::now();

                $workingSchedule = app(WorkingScheduleService::class);
                if (empty($workingSchedule->workingDayIndices())) {
                    return redirect()->back()->with('error', __('Please configure working days first.'));
                }

                if (! $workingSchedule->isWorkingDate($today)) {
                    return redirect()->back()->with('error', __('Cannot create attendance record for non-working day.'));
                }

                // Check if employee has approved leave for this date
                $hasApprovedLeave = LeaveApplication::where('employee_id', $validated['employee_id'])
                    ->where('status', 'approved')
                    ->whereDate('start_date', '<=', $today)
                    ->whereDate('end_date', '>=', $today)
                    ->exists();

                if ($hasApprovedLeave) {
                    return redirect()->back()->with('error', __('Employee has approved leave for this date. Cannot create attendance record.'));
                }

                // Check if already clocked in today
                $existingRecord = AttendanceRecord::where('employee_id', $validated['employee_id'])
                    ->where('date', $today)
                    ->first();

                if ($existingRecord && $existingRecord->clock_in) {
                    return redirect()->back()->with('error', __('Already clocked in today.'));
                }

                // Get employee with shift and policy
                $employee = \App\Models\Employee::where('user_id', $validated['employee_id'])->first();

                if (! $employee) {
                    return redirect()->back()->with('error', __('Employee profile not found.'));
                }

                // Use employee's assigned shift and policy, or get defaults
                $shift = $employee->shift_id ?
                    Shift::find($employee->shift_id) :
                    Shift::whereIn('created_by', getCompanyAndUsersId())->where('status', 'active')->first();

                $policy = $employee->attendance_policy_id ?
                    AttendancePolicy::find($employee->attendance_policy_id) :
                    AttendancePolicy::whereIn('created_by', getCompanyAndUsersId())->where('status', 'active')->first();

                if (! $shift || ! $policy) {
                    return redirect()->back()->with('error', __('No active shift or attendance policy found. Please contact HR.'));
                }

                if ($existingRecord) {
                    $existingRecord->update([
                        'clock_in' => $now->format('H:i:s'),
                        'shift_id' => $shift->id,
                        'attendance_policy_id' => $policy->id,
                        'status' => 'present',
                    ]);
                    $record = $existingRecord;
                } else {
                    $record = AttendanceRecord::create([
                        'employee_id' => $validated['employee_id'],
                        'date' => $today,
                        'clock_in' => $now->format('H:i:s'),
                        'shift_id' => $shift->id,
                        'attendance_policy_id' => $policy->id,
                        'is_weekend' => $today->isWeekend(),
                        'status' => 'present',
                        'created_by' => creatorId(),
                    ]);
                }

                // Check for late arrival if methods exist
                if (method_exists($record, 'checkLateArrival')) {
                    $record->checkLateArrival();
                    $record->save();
                }

                return redirect()->back()->with('success', __('Clocked in successfully.'));
            } catch (\Exception $e) {
                \Log::error('Clock in failed: '.$e->getMessage());

                return redirect()->back()->with('error', __('Failed to clock in. Please try again.'));
            }
        } else {
            return redirect()->back()->with('error', __('Permission Denied.'));
        }
    }

    public function clockOut(Request $request)
    {
        if (Auth::user()->can('clock-in-out')) {
            try {
                $validated = $request->validate([
                    'employee_id' => 'required|exists:users,id',
                ]);

                $today = Carbon::today();
                $now = Carbon::now();

                $record = AttendanceRecord::where('employee_id', $validated['employee_id'])
                    ->where('date', $today)
                    ->first();

                if (! $record || ! $record->clock_in) {
                    return redirect()->back()->with('error', __('Must clock in first.'));
                }

                if ($record->clock_out) {
                    return redirect()->back()->with('error', __('Already clocked out today.'));
                }

                $record->update([
                    'clock_out' => $now->format('H:i:s'),
                ]);

                // Process complete attendance calculation if method exists
                if (method_exists($record, 'processAttendance')) {
                    $record->processAttendance();
                }

                return redirect()->back()->with('success', __('Clocked out successfully.'));
            } catch (\Exception $e) {
                \Log::error('Clock out failed: '.$e->getMessage());

                return redirect()->back()->with('error', __('Failed to clock out. Please try again.'));
            }
        } else {
            return redirect()->back()->with('error', __('Permission Denied.'));
        }

    }

    public function getTodayAttendance(Request $request)
    {
        $validated = $request->validate([
            'employee_id' => 'required|exists:users,id',
        ]);

        $today = Carbon::today();
        $attendance = AttendanceRecord::where('employee_id', $validated['employee_id'])
            ->where('date', $today)
            ->first();

        return Inertia::render('employee-dashboard', [
            'attendance' => $attendance,
        ]);
    }
}
