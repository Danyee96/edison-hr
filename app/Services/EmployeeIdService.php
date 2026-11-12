<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\User;

class EmployeeIdService
{
    public static function prefixFor(User|int|null $creator): string
    {
        $user = $creator instanceof User ? $creator : User::find($creator);
        $name = strtoupper((string) ($user?->name ?? 'CO'));
        $letters = preg_replace('/[^A-Z]/', '', $name) ?? '';

        if (strlen($letters) >= 2) {
            return substr($letters, 0, 2);
        }

        $fallback = preg_replace('/[^A-Z0-9]/', '', $name) ?: 'CO'.($user?->id ?? '');

        return strtoupper(str_pad(substr($fallback, 0, 2), 2, 'X'));
    }

    public static function normalize(string|int|null $employeeId, User|int|null $creator): string
    {
        $employeeId = trim((string) $employeeId);
        if ($employeeId === '') {
            return '';
        }

        $prefix = self::prefixFor($creator);

        if (preg_match('/^'.preg_quote($prefix, '/').'-/i', $employeeId)) {
            return strtoupper($prefix).'-'.substr($employeeId, strlen($prefix) + 1);
        }

        $employeeId = preg_replace('/^[A-Za-z]{2}-/', '', $employeeId) ?? $employeeId;

        return strtoupper($prefix).'-'.$employeeId;
    }

    public static function display(string|int|null $employeeId, User|int|null $creator): string
    {
        $employeeId = trim((string) $employeeId);
        if ($employeeId === '') {
            return '';
        }

        if (preg_match('/^[A-Za-z]{2}-/', $employeeId)) {
            [$prefix, $suffix] = explode('-', $employeeId, 2);

            return strtoupper($prefix).'-'.$suffix;
        }

        return strtoupper(self::prefixFor($creator)).'-'.$employeeId;
    }

    public static function generate(User|int|null $creator): string
    {
        $prefix = self::prefixFor($creator);
        $lastNumber = Employee::query()
            ->select(['employee_id', 'created_by'])
            ->whereNotNull('employee_id')
            ->get()
            ->map(function (Employee $employee) use ($prefix) {
                $displayId = self::display($employee->employee_id, $employee->created_by);

                if (! str_starts_with($displayId, $prefix.'-')) {
                    return 0;
                }

                $suffix = substr($displayId, strlen($prefix) + 1);

                return ctype_digit($suffix) ? (int) $suffix : 0;
            })
            ->max() ?? 0;

        $nextNumber = $lastNumber + 1;

        do {
            $employeeId = $prefix.'-'.$nextNumber;
            $nextNumber++;
        } while (self::displayDuplicateExists($employeeId, $creator));

        return $employeeId;
    }

    public static function nextNumber(User|int|null $creator): string
    {
        $employeeId = self::generate($creator);
        $normalized = trim((string) $employeeId);

        if (preg_match('/^[A-Za-z]{2}-(\d+)$/', $normalized, $matches)) {
            return $matches[1];
        }

        return preg_replace('/\D+/', '', $normalized) ?? '';
    }

    public static function displayDuplicateExists(string|int|null $employeeId, User|int|null $creator, int|string|null $ignoreEmployeeId = null): bool
    {
        $displayId = self::display($employeeId, $creator);

        if ($displayId === '') {
            return false;
        }

        return Employee::query()
            ->select(['id', 'employee_id', 'created_by'])
            ->whereNotNull('employee_id')
            ->when($ignoreEmployeeId, fn ($query) => $query->whereKeyNot($ignoreEmployeeId))
            ->get()
            ->contains(fn (Employee $employee) => self::display($employee->employee_id, $employee->created_by) === $displayId);
    }
}
