<?php

namespace App\Services\Attendance;

use App\Models\AttendanceImportLog;
use App\Models\AttendancePolicy;
use App\Models\AttendanceRecord;
use App\Models\Employee;
use App\Models\Shift;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use RuntimeException;

class BiometricAttendanceImportService
{
    public function import(UploadedFile $file, int $creatorId): AttendanceImportLog
    {
        $extension = strtolower($file->getClientOriginalExtension());
        if ($extension === 'xls') {
            throw new RuntimeException(__('Legacy XLS files are not supported without PhpSpreadsheet. Please save the file as XLSX and import again.'));
        }
        if ($extension !== 'xlsx') {
            throw new RuntimeException(__('Only XLSX files are supported.'));
        }

        $rows = (new XlsxReader())->rows($file->getRealPath());
        if (count($rows) < 2) {
            throw new RuntimeException(__('The attendance file does not contain data rows.'));
        }

        $headers = array_map(fn ($header) => $this->normalizeHeader((string) $header), array_shift($rows));
        $required = ['employee_no', 'name', 'date', 'on_duty', 'off_duty', 'clock_in', 'clock_out'];
        foreach ($required as $header) {
            if (! in_array($header, $headers, true)) {
                throw new RuntimeException(__('Missing required column: ').$header);
            }
        }

        $stats = [
            'total_rows' => 0,
            'imported_rows' => 0,
            'skipped_rows' => 0,
            'created_employees' => 0,
            'errors' => [],
        ];

        DB::transaction(function () use ($rows, $headers, $creatorId, &$stats) {
            foreach ($rows as $index => $row) {
                $stats['total_rows']++;
                $line = $index + 2;
                $data = $this->combineRow($headers, $row);

                try {
                    $employeeNo = trim((string) ($data['employee_no'] ?? ''));
                    if ($employeeNo === '') {
                        throw new RuntimeException(__('Employee No is required.'));
                    }

                    $employee = Employee::whereIn('created_by', getCompanyAndUsersId())
                        ->where('biometric_emp_id', $employeeNo)
                        ->first();

                    if (! $employee) {
                        $employee = $this->createEmployee($employeeNo, (string) ($data['name'] ?? ''), $creatorId);
                        $stats['created_employees']++;
                    }

                    $attendanceDate = $this->parseDate($data['date'] ?? null);
                    $exists = AttendanceRecord::where('employee_id', $employee->user_id)
                        ->whereDate('date', $attendanceDate)
                        ->exists();

                    if ($exists) {
                        $stats['skipped_rows']++;
                        $stats['errors'][] = __('Row :line skipped: duplicate attendance record.', ['line' => $line]);
                        continue;
                    }

                    $shift = $employee->shift_id ? Shift::find($employee->shift_id) : Shift::whereIn('created_by', getCompanyAndUsersId())->where('status', 'active')->first();
                    $policy = $employee->attendance_policy_id ? AttendancePolicy::find($employee->attendance_policy_id) : AttendancePolicy::whereIn('created_by', getCompanyAndUsersId())->where('status', 'active')->first();

                    $record = AttendanceRecord::create([
                        'employee_id' => $employee->user_id,
                        'shift_id' => $shift?->id,
                        'attendance_policy_id' => $policy?->id,
                        'date' => $attendanceDate,
                        'on_duty' => $this->parseTime($data['on_duty'] ?? null),
                        'off_duty' => $this->parseTime($data['off_duty'] ?? null),
                        'clock_in' => $this->parseTime($data['clock_in'] ?? null),
                        'clock_out' => $this->parseTime($data['clock_out'] ?? null),
                        'late_minutes' => $this->parseMinutes($data['late'] ?? null),
                        'early_leave_minutes' => $this->parseMinutes($data['early'] ?? null),
                        'work_time' => (string) ($data['work_time'] ?? ''),
                        'created_by' => $creatorId,
                    ]);

                    $record->processAttendance();
                    $stats['imported_rows']++;
                } catch (\Throwable $e) {
                    $stats['skipped_rows']++;
                    $stats['errors'][] = __('Row :line: :message', ['line' => $line, 'message' => $e->getMessage()]);
                }
            }
        });

        return AttendanceImportLog::create([
            'file_name' => $file->getClientOriginalName(),
            'total_rows' => $stats['total_rows'],
            'imported_rows' => $stats['imported_rows'],
            'skipped_rows' => $stats['skipped_rows'],
            'created_employees' => $stats['created_employees'],
            'errors' => array_slice($stats['errors'], 0, 100),
            'created_by' => $creatorId,
        ]);
    }

    private function createEmployee(string $employeeNo, string $name, int $creatorId): Employee
    {
        $user = User::create([
            'name' => $name !== '' ? $name : 'Employee '.$employeeNo,
            'email' => 'biometric-'.$employeeNo.'-'.Str::random(6).'@example.local',
            'password' => Hash::make(Str::random(16)),
            'type' => 'employee',
            'lang' => 'en',
            'created_by' => $creatorId,
            'email_verified_at' => now(),
        ]);

        return Employee::create([
            'user_id' => $user->id,
            'employee_id' => Employee::generateEmployeeId($creatorId),
            'biometric_emp_id' => $employeeNo,
            'employee_status' => 'active',
            'created_by' => $creatorId,
        ]);
    }

    private function combineRow(array $headers, array $row): array
    {
        $combined = [];
        foreach ($headers as $index => $header) {
            $combined[$header] = $row[$index] ?? null;
        }

        return $combined;
    }

    private function normalizeHeader(string $header): string
    {
        return str_replace([' ', '-'], '_', strtolower(trim($header)));
    }

    private function parseDate($value): string
    {
        if (is_numeric($value)) {
            return Carbon::create(1899, 12, 30)->addDays((int) $value)->format('Y-m-d');
        }

        return Carbon::parse($value)->format('Y-m-d');
    }

    private function parseTime($value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_numeric($value)) {
            return Carbon::createFromTime(0, 0)->addSeconds((int) round(((float) $value) * 86400))->format('H:i:s');
        }

        return Carbon::parse($value)->format('H:i:s');
    }

    private function parseMinutes($value): int
    {
        if ($value === null || $value === '') {
            return 0;
        }
        if (is_numeric($value)) {
            return (int) $value;
        }
        if (str_contains((string) $value, ':')) {
            [$hours, $minutes] = array_pad(explode(':', (string) $value), 2, 0);
            return ((int) $hours * 60) + (int) $minutes;
        }

        return (int) preg_replace('/\D+/', '', (string) $value);
    }
}
