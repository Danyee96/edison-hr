<?php

namespace App\Console\Commands;

use App\Models\Employee;
use App\Services\Attendance\XlsxReader;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class UpdateEmployeeNumbersFromSheet extends Command
{
    protected $signature = 'employees:update-numbers-from-sheet
        {file : Path to the XLSX/XLS attendance export}
        {--creator-id= : Company user ID to limit employee matching}
        {--dry-run : Parse and report without writing to the database}';

    protected $description = 'Update existing employee numbers from the AC-No. column in an attendance sheet.';

    public function handle(): int
    {
        $this->error('Employee number updates from sheets are disabled. Update employee data only from the Employees tab edit option.');

        return self::FAILURE;

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
        foreach (['ac_no', 'name'] as $header) {
            if (! in_array($header, $headers, true)) {
                $this->error("Missing required sheet column: {$header}");

                return self::FAILURE;
            }
        }

        $sheetEmployees = $this->sheetEmployees($rows, $headers);
        $dryRun = (bool) $this->option('dry-run');
        $creatorId = $this->option('creator-id') ? (int) $this->option('creator-id') : null;

        $stats = [
            'valid_sheet_employees' => count($sheetEmployees),
            'updated' => 0,
            'unchanged' => 0,
            'not_found' => 0,
            'duplicate_names' => 0,
            'conflicts' => 0,
            'skipped' => 0,
        ];
        $warnings = [];

        $sync = function () use ($sheetEmployees, $creatorId, $dryRun, &$stats, &$warnings) {
            $query = Employee::with(['user:id,name,created_by', 'department:id,name'])
                ->whereHas('user');

            if ($creatorId) {
                $query->where(function ($query) use ($creatorId) {
                    $query->where('created_by', $creatorId)
                        ->orWhereHas('user', fn ($userQuery) => $userQuery->where('created_by', $creatorId));
                });
            }

            $employeesByName = $query->get()
                ->groupBy(fn (Employee $employee) => $this->nameKey($employee->user?->name ?? ''));

            $assignments = [];

            foreach ($sheetEmployees as $sheetEmployee) {
                $matches = $employeesByName->get($sheetEmployee['name_key'], collect());

                if ($matches->isEmpty()) {
                    $stats['not_found']++;
                    $stats['skipped']++;
                    $warnings[] = 'Not found: '.$sheetEmployee['name'].' -> '.$sheetEmployee['employee_no'];
                    continue;
                }

                if ($matches->count() > 1) {
                    $resolved = $this->resolveDuplicateMatch($matches, $sheetEmployee);

                    if (! $resolved) {
                        $stats['duplicate_names']++;
                        $stats['skipped']++;
                        $warnings[] = 'Duplicate name in database: '.$sheetEmployee['name'];
                        continue;
                    }

                    $matches = collect([$resolved]);
                }

                $employee = $matches->first();
                if ($employee->employee_id === $sheetEmployee['employee_no']) {
                    $stats['unchanged']++;
                    continue;
                }

                $assignments[$employee->id] = [
                    'employee' => $employee,
                    'employee_no' => $sheetEmployee['employee_no'],
                    'name' => $sheetEmployee['name'],
                ];
            }

            $targetCounts = collect($assignments)->countBy('employee_no');
            foreach ($targetCounts->filter(fn ($count) => $count > 1) as $employeeNo => $count) {
                $stats['conflicts']++;
                $warnings[] = "Employee number {$employeeNo} is assigned to {$count} matched employees.";
                $assignments = array_filter($assignments, fn ($assignment) => $assignment['employee_no'] !== $employeeNo);
            }

            foreach ($assignments as $assignment) {
                $conflict = Employee::where('employee_id', $assignment['employee_no'])
                    ->where('id', '<>', $assignment['employee']->id)
                    ->first();

                if ($conflict && ! isset($assignments[$conflict->id])) {
                    $stats['conflicts']++;
                    $stats['skipped']++;
                    $warnings[] = "Employee number {$assignment['employee_no']} already belongs to employee row {$conflict->id}.";
                    unset($assignments[$assignment['employee']->id]);
                }
            }

            if (! $dryRun) {
                foreach ($assignments as $assignment) {
                    $assignment['employee']->employee_id = 'NUMBER-TMP-'.$assignment['employee']->id;
                    $assignment['employee']->save();
                }

                foreach ($assignments as $assignment) {
                    $assignment['employee']->employee_id = $assignment['employee_no'];
                    $assignment['employee']->save();
                }
            }

            $stats['updated'] = count($assignments);
        };

        if ($dryRun) {
            $sync();
        } else {
            DB::transaction($sync);
        }

        $this->info($dryRun ? 'Dry run complete.' : 'Employee numbers updated.');
        $this->table(['Metric', 'Count'], collect($stats)->map(fn ($value, $key) => [$key, $value])->values()->all());

        foreach (array_slice($warnings, 0, 30) as $warning) {
            $this->warn($warning);
        }

        return self::SUCCESS;
    }

    private function sheetEmployees(array $rows, array $headers): array
    {
        $employees = [];

        foreach ($rows as $row) {
            $data = $this->combine($headers, $row);
            $employeeNo = trim((string) ($data['ac_no'] ?? ''));
            $name = $this->cleanName((string) ($data['name'] ?? ''));

            if ($employeeNo === '' || $name === '' || preg_match('/\d/', $name)) {
                continue;
            }

            $employees[$this->nameKey($name)] = [
                'employee_no' => $employeeNo,
                'name' => $name,
                'name_key' => $this->nameKey($name),
                'department_key' => $this->nameKey((string) ($data['no'] ?? '')),
            ];
        }

        return array_values($employees);
    }

    private function resolveDuplicateMatch($matches, array $sheetEmployee): ?Employee
    {
        $sameEmployeeNo = $matches->filter(fn (Employee $employee) => $employee->employee_id === $sheetEmployee['employee_no']);
        if ($sameEmployeeNo->count() === 1) {
            return $sameEmployeeNo->first();
        }

        if ($sheetEmployee['department_key'] !== '') {
            $sameDepartment = $matches->filter(fn (Employee $employee) => $this->nameKey($employee->department?->name ?? '') === $sheetEmployee['department_key']);
            if ($sameDepartment->count() === 1) {
                return $sameDepartment->first();
            }
        }

        $sameExactName = $matches->filter(fn (Employee $employee) => $this->cleanName($employee->user?->name ?? '') === $sheetEmployee['name']);
        if ($sameExactName->count() === 1) {
            return $sameExactName->first();
        }

        return null;
    }

    private function rows(string $path): array
    {
        $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));

        return match ($extension) {
            'xlsx', 'xlsm', 'xltx', 'xltm' => (new XlsxReader())->rows($path),
            default => $this->legacyXlsRows($path),
        };
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

    private function nameKey(string $value): string
    {
        return strtolower($this->cleanName($value));
    }
}
