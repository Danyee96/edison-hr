<?php

namespace App\Console\Commands;

use App\Models\AttendanceImportLog;
use App\Models\AttendanceRecord;
use App\Models\Branch;
use App\Models\Department;
use App\Models\Employee;
use App\Models\User;
use App\Services\EmployeeIdService;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use RuntimeException;

class ImportLegacyAttendanceXls extends Command
{
    protected $signature = 'attendance:import-legacy-xls
        {file : Path to the legacy XLS attendance export}
        {--creator-id= : User ID to own imported records}
        {--branch-id= : Branch ID for imported departments/employees}
        {--dry-run : Parse and report without writing to the database}';

    protected $description = 'Import employees, departments, and attendance from the old BIFF XLS attendance export.';

    public function handle(): int
    {
        $path = (string) $this->argument('file');
        if (! is_file($path)) {
            $this->error("File not found: {$path}");

            return self::FAILURE;
        }

        $rows = $this->rows($path);
        if (count($rows) < 2) {
            $this->error('The sheet does not contain attendance rows.');

            return self::FAILURE;
        }

        $headers = array_map(fn ($header) => $this->normalizeHeader($header), array_shift($rows));
        if (! in_array('emp_no', $headers, true) && ! in_array('ac_no', $headers, true)) {
            $this->error('Missing required sheet column: emp_no or ac_no');

            return self::FAILURE;
        }

        foreach (['no', 'name', 'date', 'on_duty', 'off_duty', 'clock_in', 'clock_out'] as $header) {
            if (! in_array($header, $headers, true)) {
                $this->error("Missing required sheet column: {$header}");

                return self::FAILURE;
            }
        }

        $creator = $this->creator();
        $branch = $this->branch($creator->id);
        $dryRun = (bool) $this->option('dry-run');

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

        $previewDepartments = [];
        $previewEmployees = [];
        $seenEmployees = [];

        $write = function () use ($rows, $headers, $creator, $branch, &$stats, &$previewDepartments, &$previewEmployees, &$seenEmployees, $path, $dryRun) {
            foreach ($rows as $index => $row) {
                $stats['rows']++;
                $line = $index + 2;
                $data = $this->combine($headers, $row);

                try {
                    $employeeNo = trim((string) ($data['emp_no'] ?? $data['ac_no'] ?? ''));
                    $departmentName = $this->cleanName((string) ($data['no'] ?? '')) ?: 'Unassigned';
                    $employeeName = $this->cleanName((string) ($data['name'] ?? ''));

                    if ($employeeNo === '' || $employeeName === '' || is_numeric($employeeName)) {
                        $stats['skipped']++;
                        continue;
                    }

                    $date = $this->parseDate((string) ($data['date'] ?? ''));
                    $previewDepartments[$departmentName] = true;
                    $previewEmployees[$employeeNo] = $employeeName;

                    if ($dryRun) {
                        continue;
                    }

                    $department = Department::where('branch_id', $branch->id)
                        ->where('name', $departmentName)
                        ->first();

                    if (! $department) {
                        $department = Department::create([
                            'name' => $departmentName,
                            'branch_id' => $branch->id,
                            'description' => 'Imported from '.basename($path),
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
                    $seenEmployees[$employeeNo] = true;

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
                        'notes' => 'Imported from legacy attendance sheet.',
                        'created_by' => $creator->id,
                    ];

                    if (Schema::hasColumn('attendance_records', 'biometric_id')) {
                        $attributes['biometric_id'] = $employeeNo;
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
        };

        if ($dryRun) {
            $write();
        } else {
            DB::transaction($write);

            if (class_exists(AttendanceImportLog::class) && Schema::hasTable('attendance_import_logs')) {
                AttendanceImportLog::create([
                    'file_name' => basename($path),
                    'total_rows' => $stats['rows'],
                    'imported_rows' => $stats['attendance_created'] + $stats['attendance_updated'],
                    'skipped_rows' => $stats['skipped'],
                    'created_employees' => $stats['employees_created'],
                    'errors' => array_slice($stats['errors'], 0, 100),
                    'created_by' => $creator->id,
                ]);
            }
        }

        $this->info(($dryRun ? 'Dry run complete.' : 'Import complete.'));
        $this->line('Creator: '.$creator->id.' - '.$creator->name);
        $this->line('Branch: '.$branch->id.' - '.$branch->name);
        $this->line('Rows read: '.$stats['rows']);
        $this->line('Unique departments in sheet: '.count($previewDepartments));
        $this->line('Unique employees in sheet: '.count($previewEmployees));
        $this->table(['Metric', 'Count'], collect($stats)->except(['errors'])->map(fn ($value, $key) => [$key, $value])->values()->all());

        foreach (array_slice($stats['errors'], 0, 20) as $error) {
            $this->warn($error);
        }

        return empty($stats['errors']) ? self::SUCCESS : self::FAILURE;
    }

    private function rows(string $path): array
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

    private function creator(): User
    {
        $id = $this->option('creator-id');
        if ($id) {
            return User::findOrFail($id);
        }

        return User::whereIn('type', ['company', 'superadmin', 'admin'])
            ->orderByRaw("FIELD(type, 'company', 'admin', 'superadmin')")
            ->orderBy('id')
            ->firstOrFail();
    }

    private function branch(int $creatorId): Branch
    {
        $id = $this->option('branch-id');
        if ($id) {
            return Branch::findOrFail($id);
        }

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

    private function parseDate(string $value): string
    {
        return Carbon::createFromFormat('d/m/Y', trim($value))->format('Y-m-d');
    }

    private function parseTime($value): ?string
    {
        $value = trim((string) $value);
        if ($value === '') {
            return null;
        }

        return Carbon::createFromFormat('H:i', $value)->format('H:i:s');
    }

    private function timeToHours($value): float
    {
        $minutes = $this->minutes($value);

        return round($minutes / 60, 2);
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

        $hours = $this->timeToHours($data['work_time'] ?? '');

        if ($hours >= 4) {
            return 'present';
        }

        if ($hours > 0) {
            return 'half_day';
        }

        return 'absent';
    }
}
