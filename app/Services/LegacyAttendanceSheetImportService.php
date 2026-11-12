<?php

namespace App\Services;

use App\Services\Attendance\XlsxReader;
use App\Models\AttendanceImportLog;
use App\Models\AttendanceRecord;
use App\Models\Branch;
use App\Models\Department;
use App\Models\Employee;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use RuntimeException;

class LegacyAttendanceSheetImportService
{
    public function missingEmployeeRows(UploadedFile|string $file): array
    {
        [$rows, $headers] = $this->sheetRows($file);
        $missing = [];

        foreach ($rows as $index => $row) {
            $line = $index + 2;
            $data = $this->combine($headers, $row);
            $employeeName = $this->cleanName((string) ($data['name'] ?? ''));

            if (! $this->needsEmployeeMapping($employeeName, $data)) {
                continue;
            }

            $employeeNo = trim((string) ($data['emp_no'] ?? $data['ac_no'] ?? ''));
            $date = null;

            try {
                $date = $this->parseDate((string) ($data['date'] ?? ''));
            } catch (\Throwable) {
                $date = trim((string) ($data['date'] ?? ''));
            }

            $suggestedEmployee = $employeeNo !== ''
                ? Employee::with('user:id,name')
                    ->whereIn('created_by', getCompanyAndUsersId())
                    ->where(function ($query) use ($employeeNo) {
                        $query->where('employee_id', EmployeeIdService::normalize($employeeNo, creatorId()))
                            ->orWhere('employee_id', $employeeNo)
                            ->orWhere('biometric_emp_id', $employeeNo);
                    })
                    ->first()
                : null;

            $missing[] = [
                'line' => $line,
                'employee_no' => $employeeNo,
                'sheet_name' => $employeeName,
                'department' => $this->cleanName((string) ($data['no'] ?? '')),
                'date' => $date,
                'clock_in' => trim((string) ($data['clock_in'] ?? '')),
                'clock_out' => trim((string) ($data['clock_out'] ?? '')),
                'suggested_employee_id' => $suggestedEmployee?->user_id,
                'suggested_employee_name' => $suggestedEmployee?->user?->name,
            ];
        }

        return $missing;
    }

    public function import(UploadedFile|string $file, int $creatorId, ?int $branchId = null, array $employeeMappings = [], array $ignoredLines = []): array
    {
        [$rows, $headers, $fileName] = $this->sheetRows($file);

        if (! in_array('emp_no', $headers, true) && ! in_array('ac_no', $headers, true)) {
            throw new RuntimeException('Missing required sheet column: emp_no or ac_no');
        }

        foreach (['no', 'name', 'date', 'on_duty', 'off_duty', 'clock_in', 'clock_out'] as $requiredHeader) {
            if (! in_array($requiredHeader, $headers, true)) {
                throw new RuntimeException("Missing required sheet column: {$requiredHeader}");
            }
        }

        $creator = User::findOrFail($creatorId);
        $branch = $branchId ? Branch::findOrFail($branchId) : $this->branch($creator->id);

        $stats = [
            'rows' => 0,
            'departments_created' => 0,
            'employees_created' => 0,
            'employees_updated' => 0,
            'attendance_created' => 0,
            'attendance_updated' => 0,
            'skipped' => 0,
            'errors' => [],
        ];
        $seenEmployees = [];
        $ignoredLines = array_flip(array_map('strval', $ignoredLines));

        DB::transaction(function () use ($rows, $headers, $creator, $branch, $fileName, $employeeMappings, $ignoredLines, &$stats, &$seenEmployees) {
            foreach ($rows as $index => $row) {
                $stats['rows']++;
                $line = $index + 2;
                $data = $this->combine($headers, $row);

                try {
                    if (isset($ignoredLines[(string) $line])) {
                        $stats['skipped']++;
                        continue;
                    }

                    $employeeNo = trim((string) ($data['emp_no'] ?? $data['ac_no'] ?? ''));
                    $departmentName = $this->cleanName((string) ($data['no'] ?? '')) ?: 'Unassigned';
                    $employeeName = $this->cleanName((string) ($data['name'] ?? ''));

                    if ($employeeNo === '' && ! isset($employeeMappings[$line])) {
                        $stats['skipped']++;
                        continue;
                    }

                    $date = $this->parseDate((string) ($data['date'] ?? ''));
                    $mappedEmployeeId = $employeeMappings[$line] ?? $employeeMappings[(string) $line] ?? null;
                    $badEmployeeName = $employeeName === '' || is_numeric($employeeName);
                    $employee = null;

                    if ($badEmployeeName) {
                        if (! $this->hasAttendance($data) || ! $mappedEmployeeId) {
                            $stats['skipped']++;
                            continue;
                        }

                        $employee = Employee::where('user_id', (int) $mappedEmployeeId)
                            ->whereIn('created_by', getCompanyAndUsersId())
                            ->first();

                        if (! $employee) {
                            throw new RuntimeException('Selected employee could not be found.');
                        }
                    } else {
                        $department = Department::where('branch_id', $branch->id)
                            ->where('name', $departmentName)
                            ->first();

                        if (! $department) {
                            $department = Department::create([
                                'name' => $departmentName,
                                'branch_id' => $branch->id,
                                'description' => 'Imported from '.$fileName,
                                'status' => 'active',
                                'created_by' => $creator->id,
                            ]);
                            $stats['departments_created']++;
                        }

                        $employeeId = EmployeeIdService::normalize($employeeNo, $creator);
                        $employee = Employee::where('created_by', $creator->id)
                            ->where(function ($query) use ($employeeNo, $employeeId) {
                                $query->where('employee_id', $employeeId)
                                    ->orWhere('employee_id', $employeeNo)
                                    ->orWhere('biometric_emp_id', $employeeNo);
                            })
                            ->first();

                        if (! $employee) {
                            $employee = $this->createEmployee($employeeNo, $employeeName, $department->id, $branch->id, $creator->id);
                            $stats['employees_created']++;
                        }
                    }
                    $seenEmployees[$employeeNo ?: $employee->employee_id] = true;

                    $attributes = [
                        'shift_id' => $employee->shift_id,
                        'attendance_policy_id' => $employee->attendance_policy_id,
                        'date' => $date,
                        'on_duty' => $this->parseTime($data['on_duty'] ?? ''),
                        'off_duty' => $this->parseTime($data['off_duty'] ?? ''),
                        'clock_in' => $this->parseTime($data['clock_in'] ?? ''),
                        'clock_out' => $this->parseTime($data['clock_out'] ?? ''),
                        'total_hours' => $this->timeToHours($data['work_time'] ?? ''),
                        'work_time' => $this->emptyToNull($data['work_time'] ?? ''),
                        'overtime_hours' => $this->timeToHours($data['ot_time'] ?? ''),
                        'is_late' => $this->minutes($data['late'] ?? '') > 0,
                        'late_minutes' => $this->minutes($data['late'] ?? ''),
                        'is_early_departure' => $this->minutes($data['early'] ?? '') > 0,
                        'early_leave_minutes' => $this->minutes($data['early'] ?? ''),
                        'is_absent' => $this->truthy($data['absent'] ?? ''),
                        'is_holiday' => $this->truthy($data['holiday'] ?? ''),
                        'is_weekend' => false,
                        'status' => $this->status($data),
                        'notes' => 'Imported from attendance sheet.',
                        'created_by' => $creator->id,
                    ];

                    if (Schema::hasColumn('attendance_records', 'biometric_id')) {
                        $attributes['biometric_id'] = $employeeNo ?: $employee->employee_id;
                    }

                    $record = AttendanceRecord::where('employee_id', $employee->user_id)
                        ->whereDate('date', $date)
                        ->first();

                    if ($record) {
                        $record->update($attributes);
                        $stats['attendance_updated']++;
                    } else {
                        AttendanceRecord::create(['employee_id' => $employee->user_id] + $attributes);
                        $stats['attendance_created']++;
                    }
                } catch (\Throwable $e) {
                    $stats['skipped']++;
                    $stats['errors'][] = "Row {$line}: ".$e->getMessage();
                }
            }

            if (class_exists(AttendanceImportLog::class) && Schema::hasTable('attendance_import_logs')) {
                AttendanceImportLog::create([
                    'file_name' => $fileName,
                    'total_rows' => $stats['rows'],
                    'imported_rows' => $stats['attendance_created'] + $stats['attendance_updated'],
                    'skipped_rows' => $stats['skipped'],
                    'created_employees' => $stats['employees_created'],
                    'errors' => array_slice($stats['errors'], 0, 100),
                    'created_by' => $creator->id,
                ]);
            }
        });

        return $stats;
    }

    private function rows(string $path, string $extension): array
    {
        return match ($extension) {
            'xlsx', 'xlsm', 'xltx', 'xltm' => (new XlsxReader())->rows($path),
            'csv' => $this->csvRows($path),
            default => $this->legacyXlsRows($path),
        };
    }

    private function sheetRows(UploadedFile|string $file): array
    {
        $path = $file instanceof UploadedFile ? $file->getRealPath() : $file;
        $fileName = $file instanceof UploadedFile ? $file->getClientOriginalName() : basename($file);

        if (! $path || ! is_file($path)) {
            throw new RuntimeException('Attendance sheet file could not be read.');
        }

        $rows = $this->rows($path, strtolower(pathinfo($fileName, PATHINFO_EXTENSION)));
        if (count($rows) < 2) {
            throw new RuntimeException('The sheet does not contain attendance rows.');
        }

        $headers = array_map(fn ($header) => $this->normalizeHeader($header), array_shift($rows));

        return [$rows, $headers, $fileName];
    }

    private function needsEmployeeMapping(string $employeeName, array $data): bool
    {
        return ($employeeName === '' || is_numeric($employeeName)) && $this->hasAttendance($data);
    }

    private function hasAttendance(array $data): bool
    {
        foreach (['clock_in', 'clock_out', 'work_time', 'ot_time', 'late', 'early'] as $field) {
            $value = trim((string) ($data[$field] ?? ''));
            if ($value !== '' && $value !== '-' && $value !== '0' && $value !== '0:00' && $value !== '00:00') {
                return true;
            }
        }

        return false;
    }

    private function csvRows(string $path): array
    {
        $handle = fopen($path, 'r');
        if ($handle === false) {
            throw new RuntimeException('Unable to read CSV file.');
        }

        $rows = [];
        while (($row = fgetcsv($handle)) !== false) {
            $rows[] = array_map(fn ($value) => trim((string) $value), $row);
        }
        fclose($handle);

        return $rows;
    }

    private function legacyXlsRows(string $path): array
    {
        $data = file_get_contents($path);
        if ($data === false) {
            throw new RuntimeException('Unable to read file.');
        }

        $rows = [];
        $pos = 0;
        $size = strlen($data);

        while ($pos + 4 <= $size) {
            $type = ord($data[$pos]) | (ord($data[$pos + 1]) << 8);
            $length = ord($data[$pos + 2]) | (ord($data[$pos + 3]) << 8);
            $body = substr($data, $pos + 4, $length);

            if ($type === 0x0004 && $length >= 8) {
                $row = ord($body[0]) | (ord($body[1]) << 8);
                $column = ord($body[2]) | (ord($body[3]) << 8);
                $stringLength = ord($body[7]);
                $value = trim(str_replace("\0", '', substr($body, 8, $stringLength)));
                $rows[$row][$column] = $value;
            }

            $pos += 4 + $length;
        }

        if ($pos !== $size) {
            throw new RuntimeException('The XLS file ended unexpectedly while parsing.');
        }

        ksort($rows);
        $maxColumn = collect($rows)->flatMap(fn ($row) => array_keys($row))->max() ?? 0;

        return collect($rows)
            ->map(function ($row) use ($maxColumn) {
                $values = [];
                for ($column = 0; $column <= $maxColumn; $column++) {
                    $values[] = $row[$column] ?? '';
                }

                return $values;
            })
            ->values()
            ->all();
    }

    private function branch(int $creatorId): Branch
    {
        return Branch::firstOrCreate(
            ['name' => 'Main Branch', 'created_by' => $creatorId],
            ['status' => 'active']
        );
    }

    private function createEmployee(string $employeeNo, string $name, int $departmentId, int $branchId, int $creatorId): Employee
    {
        $user = User::create([
            'name' => $name,
            'email' => $this->employeeEmail($employeeNo),
            'password' => Hash::make(Str::random(24)),
            'type' => 'employee',
            'lang' => 'en',
            'created_by' => $creatorId,
            'email_verified_at' => now(),
            'status' => 'active',
        ]);

        return Employee::create([
            'user_id' => $user->id,
            'employee_id' => EmployeeIdService::normalize($employeeNo, $creatorId),
            'biometric_emp_id' => $employeeNo,
            'branch_id' => $branchId,
            'department_id' => $departmentId,
            'employee_status' => 'active',
            'created_by' => $creatorId,
        ]);
    }

    private function employeeEmail(string $employeeNo): string
    {
        $base = 'biometric-'.$employeeNo;
        $email = $base.'@example.local';
        $counter = 1;

        while (User::where('email', $email)->exists()) {
            $email = $base.'-'.$counter.'@example.local';
            $counter++;
        }

        return $email;
    }

    private function combine(array $headers, array $row): array
    {
        $data = [];
        foreach ($headers as $index => $header) {
            $data[$header] = $row[$index] ?? '';
        }

        return $data;
    }

    private function normalizeHeader(string $header): string
    {
        return trim(str_replace([' ', '.', '-'], '_', strtolower(trim($header))), '_');
    }

    private function cleanName(string $value): string
    {
        return trim(preg_replace('/\s+/', ' ', $value) ?? '');
    }

    private function parseDate($value): string
    {
        if (is_numeric($value)) {
            return Carbon::create(1899, 12, 30)->addDays((int) $value)->format('Y-m-d');
        }

        return Carbon::createFromFormat('d/m/Y', trim($value))->format('Y-m-d');
    }

    private function parseTime($value): ?string
    {
        $value = trim((string) $value);
        if ($value === '') {
            return null;
        }

        if (is_numeric($value)) {
            $seconds = (int) round(((float) $value - floor((float) $value)) * 86400);

            return Carbon::createFromTime(0, 0)->addSeconds($seconds)->format('H:i:s');
        }

        return Carbon::createFromFormat('H:i', $value)->format('H:i:s');
    }

    private function timeToHours($value): float
    {
        return round($this->minutes($value) / 60, 2);
    }

    private function minutes($value): int
    {
        $value = trim((string) $value);
        if ($value === '') {
            return 0;
        }

        if (str_contains($value, ':')) {
            [$hours, $minutes] = array_map('intval', explode(':', $value, 2));

            return ($hours * 60) + $minutes;
        }

        return (int) $value;
    }

    private function truthy($value): bool
    {
        return in_array(strtolower(trim((string) $value)), ['1', 'true', 'yes', 'y'], true);
    }

    private function emptyToNull($value): ?string
    {
        $value = trim((string) $value);

        return $value === '' ? null : $value;
    }

    private function status(array $data): string
    {
        if ($this->truthy($data['holiday'] ?? '')) {
            return 'holiday';
        }

        if ($this->truthy($data['absent'] ?? '')) {
            return 'absent';
        }

        return $this->timeToHours($data['work_time'] ?? '') > 0 ? 'present' : 'absent';
    }
}
