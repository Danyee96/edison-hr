<?php

namespace App\Console\Commands;

use App\Models\Branch;
use App\Models\Department;
use App\Models\Employee;
use App\Models\User;
use App\Services\EmployeeIdService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use RuntimeException;

class SyncEmployeesFromAttendanceSheet extends Command
{
    protected $signature = 'employees:sync-attendance-sheet
        {file : Path to the legacy XLS attendance export}
        {--creator-id= : Company user ID to own imported records}
        {--branch-id= : Branch ID for imported departments/employees}
        {--dry-run : Parse and report without writing to the database}';

    protected $description = 'Sync departments, employee names, and employee numbers from a legacy attendance XLS sheet.';

    public function handle(): int
    {
        $path = (string) $this->argument('file');
        if (! is_file($path)) {
            $this->error("File not found: {$path}");

            return self::FAILURE;
        }

        $rows = $this->rows($path);
        if (count($rows) < 2) {
            $this->error('The sheet does not contain employee rows.');

            return self::FAILURE;
        }

        $headers = array_map(fn ($header) => $this->normalizeHeader($header), array_shift($rows));
        foreach (['emp_no', 'ac_no', 'no', 'name'] as $header) {
            if (! in_array($header, $headers, true)) {
                $this->error("Missing required sheet column: {$header}");

                return self::FAILURE;
            }
        }

        $creator = $this->creator();
        $branch = $this->branch($creator->id);
        $dryRun = (bool) $this->option('dry-run');
        $sheet = $this->sheetEmployees($rows, $headers);
        $stats = [
            'valid_employees' => count($sheet['valid']),
            'invalid_employees' => count($sheet['invalid']),
            'departments_created' => 0,
            'employees_created' => 0,
            'employees_updated' => 0,
            'employees_deleted' => 0,
            'skipped' => 0,
            'errors' => [],
        ];

        $sync = function () use ($sheet, $creator, $branch, $dryRun, &$stats) {
            $departments = [];
            foreach (collect($sheet['valid'])->pluck('department')->unique()->values() as $departmentName) {
                $department = Department::where('branch_id', $branch->id)
                    ->where('name', $departmentName)
                    ->first();

                if (! $department && ! $dryRun) {
                    $department = Department::create([
                        'name' => $departmentName,
                        'branch_id' => $branch->id,
                        'description' => 'Imported from attendance sheet',
                        'status' => 'active',
                        'created_by' => $creator->id,
                    ]);
                    $stats['departments_created']++;
                } elseif (! $department) {
                    $stats['departments_created']++;
                }

                $departments[$departmentName] = $department;
            }

            foreach ($sheet['valid'] as $row) {
                $employeeId = EmployeeIdService::normalize($row['ac_no'], $creator);
                $empNoEmployeeId = EmployeeIdService::normalize($row['emp_no'], $creator);
                $employee = Employee::where('created_by', $creator->id)
                    ->where(function ($query) use ($row, $employeeId, $empNoEmployeeId) {
                        $query->where('biometric_emp_id', $row['emp_no'])
                            ->orWhere('employee_id', $employeeId)
                            ->orWhere('employee_id', $empNoEmployeeId);
                    })
                    ->first();

                if (! $employee) {
                    if ($dryRun) {
                        $stats['employees_created']++;
                        continue;
                    }

                    $employee = $this->createEmployee($row, $departments[$row['department']], $branch->id, $creator->id);
                    $stats['employees_created']++;

                    continue;
                }

                $stats['skipped']++;
            }
        };

        if ($dryRun) {
            $sync();
        } else {
            DB::transaction($sync);
        }

        $this->info($dryRun ? 'Dry run complete.' : 'Employee sync complete.');
        $this->line('Creator: '.$creator->id.' - '.$creator->name);
        $this->line('Branch: '.$branch->id.' - '.$branch->name);
        $this->table(['Metric', 'Count'], collect($stats)->except(['errors'])->map(fn ($value, $key) => [$key, $value])->values()->all());

        foreach (array_slice($stats['errors'], 0, 20) as $error) {
            $this->warn($error);
        }

        return empty($stats['errors']) ? self::SUCCESS : self::FAILURE;
    }

    private function sheetEmployees(array $rows, array $headers): array
    {
        $valid = [];
        $invalid = [];

        foreach ($rows as $row) {
            $data = $this->combine($headers, $row);
            $empNo = trim((string) ($data['emp_no'] ?? ''));
            $acNo = trim((string) ($data['ac_no'] ?? ''));
            $name = $this->cleanName((string) ($data['name'] ?? ''));
            $department = $this->cleanName((string) ($data['no'] ?? '')) ?: 'Unassigned';

            if ($empNo === '' && $acNo === '') {
                continue;
            }

            $payload = [
                'emp_no' => $empNo,
                'ac_no' => $acNo,
                'department' => $department,
                'name' => $name,
            ];

            if ($acNo === '' || $name === '' || preg_match('/\d/', $name)) {
                $invalid[$acNo ?: $empNo] = $payload;
                continue;
            }

            $valid[$acNo] = $payload;
        }

        return ['valid' => $valid, 'invalid' => $invalid];
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

    private function createEmployee(array $row, ?Department $department, int $branchId, int $creatorId): Employee
    {
        $user = User::create([
            'name' => $row['name'],
            'email' => $this->employeeEmail($row['ac_no']),
            'password' => Hash::make(Str::random(24)),
            'type' => 'employee',
            'lang' => 'en',
            'created_by' => $creatorId,
            'email_verified_at' => now(),
            'status' => 'active',
        ]);

        return Employee::create([
            'user_id' => $user->id,
            'employee_id' => EmployeeIdService::normalize($row['ac_no'], $creatorId),
            'biometric_emp_id' => $row['emp_no'],
            'branch_id' => $branchId,
            'department_id' => $department?->id,
            'employee_status' => 'active',
            'created_by' => $creatorId,
        ]);
    }

    private function employeeEmail(string $employeeNo): string
    {
        $base = 'employee-'.$employeeNo;
        $email = $base.'@example.local';
        $counter = 1;

        while (User::where('email', $email)->exists()) {
            $email = $base.'-'.$counter.'@example.local';
            $counter++;
        }

        return $email;
    }

    private function creator(): User
    {
        $creatorId = $this->option('creator-id');

        if ($creatorId) {
            return User::findOrFail((int) $creatorId);
        }

        return User::where('type', 'company')->firstOrFail();
    }

    private function branch(int $creatorId): Branch
    {
        $branchId = $this->option('branch-id');

        if ($branchId) {
            return Branch::findOrFail((int) $branchId);
        }

        return Branch::firstOrCreate(
            ['name' => 'Main Branch', 'created_by' => $creatorId],
            ['status' => 'active']
        );
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
}
