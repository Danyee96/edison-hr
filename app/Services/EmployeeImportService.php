<?php

namespace App\Services;

use App\Models\Branch;
use App\Models\Department;
use App\Models\Employee;
use App\Models\EmployeeBonus;
use App\Models\EmployeeSalary;
use App\Models\User;
use App\Services\Attendance\XlsxReader;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use RuntimeException;
use Spatie\Permission\Models\Role;

class EmployeeImportService
{
    public function import(UploadedFile $file, int $creatorId): array
    {
        $extension = strtolower($file->getClientOriginalExtension());
        $path = $file->getRealPath();

        if (! $path || ! is_file($path)) {
            throw new RuntimeException(__('The uploaded employee sheet could not be read.'));
        }

        $rows = match ($extension) {
            'xlsx', 'xlsm', 'xltx', 'xltm' => (new XlsxReader())->rows($path),
            'csv', 'txt' => $this->csvRows($path),
            default => throw new RuntimeException(__('Please upload the employee sheet as XLSX or CSV.')),
        };

        if (count($rows) < 2) {
            throw new RuntimeException(__('The employee sheet does not contain employee rows.'));
        }

        $headerRow = array_shift($rows);
        $columns = $this->detectColumns($headerRow);
        $creator = User::findOrFail($creatorId);
        $branch = $this->defaultBranch($creatorId);
        $passwordHash = Hash::make(Str::random(32));
        $employeeRole = $this->employeeRole();

        $stats = [
            'rows' => 0,
            'created' => 0,
            'departments_created' => 0,
            'skipped' => 0,
            'duplicate_sheet_rows' => 0,
            'existing_employees' => 0,
            'invalid_rows' => 0,
            'errors' => [],
        ];
        $seenEmployeeIds = [];

        DB::transaction(function () use ($rows, $columns, $creator, $branch, $passwordHash, $employeeRole, &$stats, &$seenEmployeeIds) {
            foreach ($rows as $index => $row) {
                $stats['rows']++;
                $line = $index + 2;

                try {
                    $employeeId = $this->cleanId($this->value($row, $columns['employee_id']));
                    $name = $this->cleanName($this->value($row, $columns['name']));
                    $departmentName = $this->cleanName($this->value($row, $columns['department'])) ?: 'Unassigned';
                    $salary = $this->money($this->value($row, $columns['salary'] ?? null));
                    $bonus = $this->money($this->value($row, $columns['bonus'] ?? null));
                    $whatsapp = $this->normalizePakistanWhatsAppNumber($this->value($row, $columns['whatsapp'] ?? null));

                    if ($employeeId === '' || $name === '') {
                        $stats['skipped']++;
                        $stats['invalid_rows']++;
                        $stats['errors'][] = __('Row :row skipped: missing employee ID or name.', ['row' => $line]);
                        continue;
                    }

                    $rawEmployeeId = $employeeId;
                    $employeeId = EmployeeIdService::normalize($employeeId, $creator);

                    if (isset($seenEmployeeIds[$employeeId])) {
                        $stats['skipped']++;
                        $stats['duplicate_sheet_rows']++;
                        $stats['errors'][] = __('Row :row skipped: duplicate employee ID :id in uploaded sheet.', [
                            'row' => $line,
                            'id' => $employeeId,
                        ]);
                        continue;
                    }
                    $seenEmployeeIds[$employeeId] = true;

                    if (Employee::where('created_by', $creator->id)
                        ->where(fn ($query) => $query->where('employee_id', $employeeId)->orWhere('employee_id', $rawEmployeeId))
                        ->exists()) {
                        $stats['skipped']++;
                        $stats['existing_employees']++;
                        $stats['errors'][] = __('Row :row skipped: employee ID :id already exists.', [
                            'row' => $line,
                            'id' => $employeeId,
                        ]);
                        continue;
                    }

                    $department = Department::where('branch_id', $branch->id)
                        ->whereIn('created_by', getCompanyAndUsersId())
                        ->where('name', $departmentName)
                        ->first();

                    if (! $department) {
                        $department = Department::create([
                            'name' => $departmentName,
                            'branch_id' => $branch->id,
                            'description' => 'Imported from employee sheet',
                            'status' => 'active',
                            'created_by' => $creator->id,
                        ]);
                        $stats['departments_created']++;
                    }

                    $user = User::create([
                        'name' => $name,
                        'email' => $this->generateEmployeeEmail($name),
                        'password' => $passwordHash,
                        'type' => 'employee',
                        'lang' => 'en',
                        'status' => 'active',
                        'created_by' => $creator->id,
                    ]);

                    $this->assignEmployeeRole($user, $employeeRole);

                    Employee::create([
                        'user_id' => $user->id,
                        'employee_id' => $employeeId,
                        'branch_id' => $branch->id,
                        'department_id' => $department->id,
                        'whatsapp_number' => $whatsapp,
                        'base_salary' => $salary,
                        'employee_status' => 'active',
                        'created_by' => $creator->id,
                    ]);

                    if ($salary !== null) {
                        EmployeeSalary::create([
                            'employee_id' => $user->id,
                            'basic_salary' => $salary,
                            'components' => null,
                            'is_active' => true,
                            'created_by' => $creator->id,
                        ]);
                    }

                    if ($bonus !== null && $bonus > 0) {
                        EmployeeBonus::create([
                            'employee_id' => $user->id,
                            'bonus_type' => 'custom',
                            'amount' => $bonus,
                            'bonus_date' => now()->toDateString(),
                            'notes' => 'Employee profile bonus',
                            'created_by' => $creator->id,
                        ]);
                    }

                    $stats['created']++;
                } catch (\Throwable $e) {
                    $stats['skipped']++;
                    $stats['errors'][] = __('Row :row skipped: :message', [
                        'row' => $line,
                        'message' => $e->getMessage(),
                    ]);
                }
            }
        });

        $stats['errors'] = array_slice($stats['errors'], 0, 20);

        return $stats;
    }

    private function detectColumns(array $headers): array
    {
        $normalized = array_map(fn ($header) => $this->normalizeHeader($header), $headers);
        $columns = [
            'employee_id' => $this->findColumn($normalized, ['ac_no', 'acno', 'employee_id', 'employee_no', 'emp_no']),
            'name' => $this->findColumn($normalized, ['name', 'employee_name']),
            'department' => $this->findColumn($normalized, ['department', 'dept', 'no'], preferLast: true),
            'bonus' => $this->findColumn($normalized, ['bonus', 'bonous', 'bonas']),
            'salary' => $this->findColumn($normalized, ['salary', 'basic_salary', 'gross_salary']),
            'whatsapp' => $this->findColumn($normalized, ['whatsapp', 'whatsapp_number', 'whats_app', 'mobile', 'phone']),
        ];

        if ($columns['salary'] === null) {
            $columns['salary'] = $this->firstDateLikeColumnAfter($headers, $columns['bonus'] ?? $columns['name']);
        }

        foreach (['employee_id', 'name', 'department'] as $required) {
            if ($columns[$required] === null) {
                throw new RuntimeException(__('Missing required employee sheet column: :column', ['column' => $required]));
            }
        }

        return $columns;
    }

    private function findColumn(array $headers, array $aliases, bool $preferLast = false): ?int
    {
        $matches = [];
        foreach ($headers as $index => $header) {
            if (in_array($header, $aliases, true)) {
                $matches[] = $index;
            }
        }

        if (empty($matches)) {
            return null;
        }

        return $preferLast ? end($matches) : $matches[0];
    }

    private function firstDateLikeColumnAfter(array $headers, ?int $after): ?int
    {
        foreach ($headers as $index => $header) {
            if ($after !== null && $index <= $after) {
                continue;
            }

            if (preg_match('/^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}$/', trim((string) $header))) {
                return $index;
            }
        }

        return null;
    }

    private function normalizeHeader(mixed $header): string
    {
        $header = strtolower(trim((string) $header));
        $header = preg_replace('/[^a-z0-9]+/', '_', $header) ?? '';

        return trim($header, '_');
    }

    private function value(array $row, ?int $index): ?string
    {
        if ($index === null) {
            return null;
        }

        return isset($row[$index]) ? trim((string) $row[$index]) : null;
    }

    private function cleanId(?string $value): string
    {
        return trim((string) $value);
    }

    private function cleanName(?string $value): string
    {
        $value = preg_replace('/\s+/', ' ', trim((string) $value)) ?? '';

        return $value;
    }

    private function money(?string $value): ?float
    {
        $value = trim((string) $value);
        if ($value === '') {
            return null;
        }

        $value = str_replace([',', 'PKR', 'Rs.', 'Rs'], '', $value);

        return is_numeric($value) ? (float) $value : null;
    }

    private function normalizePakistanWhatsAppNumber(?string $number): ?string
    {
        $digits = preg_replace('/\D+/', '', $number ?? '');

        if (! $digits) {
            return null;
        }

        if (str_starts_with($digits, '0092')) {
            $digits = substr($digits, 2);
        } elseif (str_starts_with($digits, '92')) {
            // Already normalized without plus sign.
        } elseif (str_starts_with($digits, '0')) {
            $digits = '92'.substr($digits, 1);
        } else {
            $digits = '92'.$digits;
        }

        return '+'.$digits;
    }

    private function generateEmployeeEmail(string $name): string
    {
        $base = Str::slug($name) ?: 'employee';
        $email = $base.'@example.local';
        $counter = 1;

        while (User::where('email', $email)->exists()) {
            $email = $base.'-'.$counter.'@example.local';
            $counter++;
        }

        return $email;
    }

    private function employeeRole(): ?Role
    {
        return isSaaS()
            ? Role::where('created_by', createdBy())->where('name', 'employee')->first()
            : Role::where('name', 'employee')->first();
    }

    private function assignEmployeeRole(User $user, ?Role $role): void
    {
        if ($role) {
            $user->assignRole($role);
        }
    }

    private function defaultBranch(int $creatorId): Branch
    {
        return Branch::whereIn('created_by', getCompanyAndUsersId())
            ->where('status', 'active')
            ->orderBy('id')
            ->first()
            ?: Branch::create([
                'name' => 'Main Branch',
                'status' => 'active',
                'created_by' => $creatorId,
            ]);
    }

    private function csvRows(string $path): array
    {
        $handle = fopen($path, 'r');
        if ($handle === false) {
            throw new RuntimeException(__('Unable to read CSV file.'));
        }

        $rows = [];
        while (($row = fgetcsv($handle)) !== false) {
            $rows[] = array_map(fn ($value) => trim((string) $value), $row);
        }
        fclose($handle);

        return $rows;
    }
}
