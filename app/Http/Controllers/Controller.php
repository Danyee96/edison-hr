<?php

namespace App\Http\Controllers;

abstract class Controller
{
    protected function normalizeSortDirection(?string $direction, string $default = 'asc'): string
    {
        $direction = strtolower((string) $direction);

        if (in_array($direction, ['asc', 'desc'], true)) {
            return $direction;
        }

        return strtolower($default) === 'desc' ? 'desc' : 'asc';
    }

    protected function numericTextSortExpression(string $expression): string
    {
        return "CAST(NULLIF(REGEXP_REPLACE({$expression}, '[^0-9]', ''), '') AS UNSIGNED)";
    }

    protected function userEmployeeIdSortExpression(string $userIdColumn = 'users.id'): string
    {
        return $this->numericTextSortExpression("(select employee_id from employees where employees.user_id = {$userIdColumn} limit 1)");
    }
}
