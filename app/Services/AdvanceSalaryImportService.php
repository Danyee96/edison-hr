<?php

namespace App\Services;

use App\Models\AdvanceSalary;
use App\Models\User;
use App\Services\Attendance\XlsxReader;
use Carbon\Carbon;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class AdvanceSalaryImportService
{
    public function import(UploadedFile $file, string $month, int $creatorId): array
    {
        $monthStart = Carbon::createFromFormat('Y-m', $month)->startOfMonth();
        $extension = strtolower($file->getClientOriginalExtension());
        $path = $file->getRealPath();

        if (! $path || ! is_file($path)) {
            throw new RuntimeException(__('The uploaded file could not be read.'));
        }

        $employees = $this->employees();
        $rows = $this->rows($path, $extension, $employees);

        if (empty($rows)) {
            throw new RuntimeException(__('No importable advance rows were found in the file.'));
        }

        $stats = [
            'total_rows' => 0,
            'created' => 0,
            'updated' => 0,
            'skipped' => 0,
            'errors' => [],
        ];

        DB::transaction(function () use ($rows, $employees, $monthStart, $creatorId, &$stats) {
            foreach ($rows as $index => $row) {
                $stats['total_rows']++;
                $line = $row['_line'] ?? $index + 2;

                try {
                    $employee = $this->matchEmployee($row, $employees);
                    if (! $employee) {
                        throw new RuntimeException(__('Employee was not found by ID or name.'));
                    }

                    $amount = $this->parseAmount($row['amount'] ?? $row['advance'] ?? $row['advance_amount'] ?? null);
                    if ($amount <= 0) {
                        throw new RuntimeException(__('Advance amount is required.'));
                    }

                    $requestDate = $this->parseDate($row['date'] ?? $row['request_date'] ?? $row['advance_date'] ?? null, $monthStart);
                    $notes = trim((string) ($row['notes'] ?? $row['note'] ?? ''));
                    $advance = $this->existingAdvance($employee['id'], $requestDate, $monthStart);

                    $payload = [
                        'employee_id' => $employee['id'],
                        'amount' => $amount,
                        'deducted_amount' => 0,
                        'repayment_type' => 'full',
                        'repayment_source' => 'salary',
                        'request_date' => $requestDate,
                        'approval_date' => $requestDate,
                        'status' => 'approved',
                        'notes' => $notes !== '' ? $notes : __('Imported from salary advance file.'),
                        'created_by' => $creatorId,
                    ];

                    if ($advance) {
                        unset($payload['deducted_amount'], $payload['created_by']);
                        $advance->update($payload);
                        $stats['updated']++;
                    } else {
                        AdvanceSalary::create($payload);
                        $stats['created']++;
                    }
                } catch (\Throwable $e) {
                    $stats['skipped']++;
                    $stats['errors'][] = __('Row :line: :message', ['line' => $line, 'message' => $e->getMessage()]);
                }
            }
        });

        $stats['errors'] = array_slice($stats['errors'], 0, 25);

        return $stats;
    }

    private function rows(string $path, string $extension, Collection $employees): array
    {
        return match ($extension) {
            'xlsx', 'xlsm', 'xltx', 'xltm' => $this->tableRows((new XlsxReader())->rows($path)),
            'csv' => $this->tableRows($this->csvRows($path)),
            'xls' => $this->tableRows($this->legacyXlsRows($path)),
            'pdf' => $this->pdfRows($path, $employees),
            'txt' => $this->textRows((string) file_get_contents($path), $employees),
            default => throw new RuntimeException(__('Only PDF, XLSX, XLS, CSV and TXT files are supported.')),
        };
    }

    private function tableRows(array $rows): array
    {
        if (count($rows) < 2) {
            return [];
        }

        $headers = array_map(fn ($header) => $this->normalizeHeader((string) $header), array_shift($rows));
        $mapped = [];

        foreach ($rows as $index => $row) {
            $data = ['_line' => $index + 2];
            foreach ($headers as $column => $header) {
                if ($header !== '') {
                    $data[$header] = trim((string) ($row[$column] ?? ''));
                }
            }

            if ($this->rowHasValue($data)) {
                $mapped[] = $data;
            }
        }

        return $mapped;
    }

    private function csvRows(string $path): array
    {
        $handle = fopen($path, 'r');
        if ($handle === false) {
            throw new RuntimeException(__('Unable to read CSV file.'));
        }

        $rows = [];
        while (($row = fgetcsv($handle, 0, ',', '"', '\\')) !== false) {
            $rows[] = $row;
        }
        fclose($handle);

        return $rows;
    }

    private function legacyXlsRows(string $path): array
    {
        $data = file_get_contents($path);
        if ($data === false) {
            throw new RuntimeException(__('Unable to read XLS file.'));
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
                $rows[$row][$column] = trim(str_replace("\0", '', substr($body, 8, $stringLength)));
            } elseif ($type === 0x0203 && $length >= 14) {
                $row = ord($body[0]) | (ord($body[1]) << 8);
                $column = ord($body[2]) | (ord($body[3]) << 8);
                $rows[$row][$column] = (string) unpack('d', substr($body, 6, 8))[1];
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

    private function pdfRows(string $path, Collection $employees): array
    {
        $text = $this->pdfText($path);
        if (trim($text) === '') {
            throw new RuntimeException(__('No readable text was found in the PDF. Scanned PDFs need OCR before importing.'));
        }

        return $this->textRows($text, $employees);
    }

    private function textRows(string $text, Collection $employees): array
    {
        $rows = [];
        $lines = preg_split('/\R+/', $text) ?: [];

        foreach ($lines as $index => $line) {
            $line = trim(preg_replace('/\s+/', ' ', $line));
            if ($line === '') {
                continue;
            }

            $employee = $this->matchEmployeeFromLine($line, $employees);
            $amount = $this->amountFromLine($line);

            if (! $employee || $amount === null) {
                continue;
            }

            $rows[] = [
                '_line' => $index + 1,
                'employee_id' => $employee['employee_code'],
                'name' => $employee['name'],
                'amount' => $amount,
                'date' => $this->dateFromLine($line),
                'notes' => __('Imported from salary advance file.'),
            ];
        }

        return $rows;
    }

    private function pdfText(string $path): string
    {
        $contents = file_get_contents($path);
        if ($contents === false) {
            return '';
        }

        preg_match_all('/stream\s*(.*?)\s*endstream/s', $contents, $matches);
        $text = '';

        foreach ($matches[1] ?? [] as $stream) {
            $decoded = @gzuncompress(ltrim($stream));
            $chunk = $decoded !== false ? $decoded : $stream;
            $text .= "\n".$this->decodePdfTextOperators($chunk);
        }

        if (trim($text) === '') {
            $text = $this->decodePdfTextOperators($contents);
        }

        return html_entity_decode($text, ENT_QUOTES | ENT_HTML5);
    }

    private function decodePdfTextOperators(string $contents): string
    {
        $text = '';
        preg_match_all('/\((?:\\\\.|[^\\\\)])*\)\s*Tj|\[(.*?)\]\s*TJ/s', $contents, $matches);

        foreach ($matches[0] ?? [] as $match) {
            preg_match_all('/\((?:\\\\.|[^\\\\)])*\)/s', $match, $strings);
            foreach ($strings[0] ?? [] as $string) {
                $text .= ' '.$this->decodePdfString(substr($string, 1, -1));
            }
            $text .= "\n";
        }

        return $text;
    }

    private function decodePdfString(string $value): string
    {
        $value = preg_replace_callback('/\\\\([0-7]{1,3})/', fn ($match) => chr(octdec($match[1])), $value);

        return str_replace(
            ['\\\\', '\(', '\)', '\n', '\r', '\t'],
            ['\\', '(', ')', "\n", "\r", "\t"],
            $value ?? ''
        );
    }

    private function employees(): Collection
    {
        return User::emp()
            ->whereIn('created_by', getCompanyAndUsersId())
            ->with('employee:id,user_id,employee_id')
            ->get(['id', 'name'])
            ->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'normalized_name' => $this->normalizeName($user->name),
                'employee_code' => (string) ($user->employee?->employee_id ?? ''),
                'normalized_code' => $this->normalizeEmployeeCode($user->employee?->employee_id),
            ]);
    }

    private function matchEmployee(array $row, Collection $employees): ?array
    {
        $code = $this->normalizeEmployeeCode($row['employee_id'] ?? $row['employee_no'] ?? $row['emp_no'] ?? $row['id'] ?? '');
        if ($code !== '') {
            $match = $employees->first(fn ($employee) => $employee['normalized_code'] === $code);
            if ($match) {
                return $match;
            }
        }

        $name = $this->normalizeName((string) ($row['employee'] ?? $row['employee_name'] ?? $row['name'] ?? ''));
        if ($name === '') {
            return null;
        }

        return $employees->first(fn ($employee) => $employee['normalized_name'] === $name);
    }

    private function matchEmployeeFromLine(string $line, Collection $employees): ?array
    {
        $normalizedLine = $this->normalizeName($line);
        $lineCodes = [];
        preg_match_all('/\b[A-Za-z]*\d+[A-Za-z0-9-]*\b/', $line, $codeMatches);
        foreach ($codeMatches[0] ?? [] as $code) {
            $lineCodes[] = $this->normalizeEmployeeCode($code);
        }

        foreach ($employees as $employee) {
            if ($employee['normalized_code'] !== '' && in_array($employee['normalized_code'], $lineCodes, true)) {
                return $employee;
            }
        }

        return $employees
            ->filter(fn ($employee) => $employee['normalized_name'] !== '' && str_contains($normalizedLine, $employee['normalized_name']))
            ->sortByDesc(fn ($employee) => strlen($employee['normalized_name']))
            ->first();
    }

    private function existingAdvance(int $employeeId, string $requestDate, Carbon $monthStart): ?AdvanceSalary
    {
        $sameDate = AdvanceSalary::where('employee_id', $employeeId)
            ->whereIn('created_by', getCompanyAndUsersId())
            ->whereDate('request_date', $requestDate)
            ->first();

        if ($sameDate) {
            return $sameDate;
        }

        if ($requestDate !== $monthStart->toDateString()) {
            return null;
        }

        $monthEnd = $monthStart->copy()->endOfMonth();
        $monthAdvances = AdvanceSalary::where('employee_id', $employeeId)
            ->whereIn('created_by', getCompanyAndUsersId())
            ->whereBetween('request_date', [$monthStart->toDateString(), $monthEnd->toDateString()])
            ->orderBy('request_date')
            ->get();

        return $monthAdvances->count() === 1 ? $monthAdvances->first() : null;
    }

    private function parseAmount($value): float
    {
        $clean = preg_replace('/[^\d.\-]/', '', (string) $value);

        return round((float) $clean, 2);
    }

    private function parseDate($value, Carbon $fallbackMonth): string
    {
        $value = trim((string) $value);
        if ($value === '') {
            return $fallbackMonth->toDateString();
        }

        if (is_numeric($value)) {
            return Carbon::create(1899, 12, 30)->addDays((int) $value)->toDateString();
        }

        return Carbon::parse($value)->toDateString();
    }

    private function amountFromLine(string $line): ?string
    {
        if (preg_match('/(?:PKR|Rs\.?|Amount|Advance)\s*[:\-]?\s*(-?\d[\d,]*(?:\.\d{1,2})?)/i', $line, $match)) {
            return $match[1];
        }

        if (preg_match_all('/-?\d[\d,]*(?:\.\d{1,2})?/', $line, $matches)) {
            $numbers = array_values(array_filter($matches[0], fn ($number) => strlen(preg_replace('/\D/', '', $number)) >= 3));

            return end($numbers) ?: null;
        }

        return null;
    }

    private function dateFromLine(string $line): ?string
    {
        if (preg_match('/\b\d{4}-\d{1,2}-\d{1,2}\b/', $line, $match)) {
            return $match[0];
        }

        if (preg_match('/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/', $line, $match)) {
            return $match[0];
        }

        return null;
    }

    private function normalizeHeader(string $header): string
    {
        $header = strtolower(trim($header));
        $header = preg_replace('/[^a-z0-9]+/', '_', $header);
        $header = trim($header ?? '', '_');

        return match ($header) {
            'employee_code', 'employee_id_no', 'emp_id', 'emp_no', 'employee_no', 'staff_id' => 'employee_id',
            'employee_name', 'staff_name' => 'name',
            'advance_taken', 'advance_amount', 'salary_advance', 'advance_salary' => 'amount',
            'advance_date' => 'date',
            default => $header,
        };
    }

    private function normalizeName(string $value): string
    {
        $value = strtolower(trim($value));

        return trim(preg_replace('/[^a-z0-9]+/', ' ', $value) ?? '');
    }

    private function normalizeEmployeeCode($value): string
    {
        $value = strtoupper(trim((string) $value));
        $digits = preg_replace('/\D+/', '', $value);

        return $digits !== '' ? (string) ((int) $digits) : preg_replace('/[^A-Z0-9]+/', '', $value);
    }

    private function rowHasValue(array $row): bool
    {
        foreach ($row as $key => $value) {
            if ($key !== '_line' && trim((string) $value) !== '') {
                return true;
            }
        }

        return false;
    }
}
