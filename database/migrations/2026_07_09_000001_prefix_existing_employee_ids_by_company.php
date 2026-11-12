<?php

use App\Services\EmployeeIdService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('employees') || ! Schema::hasTable('users')) {
            return;
        }

        $employees = DB::table('employees')
            ->join('users', 'users.id', '=', 'employees.created_by')
            ->orderBy('employees.id')
            ->get([
                'employees.id',
                'employees.employee_id',
                'employees.created_by',
                'users.name as creator_name',
            ]);

        $updates = [];

        foreach ($employees as $employee) {
            $target = EmployeeIdService::normalize($employee->employee_id, $employee->created_by);

            if ($target === '' || $target === $employee->employee_id) {
                continue;
            }

            $updates[$employee->id] = $target;
        }

        foreach (array_keys($updates) as $employeeId) {
            DB::table('employees')
                ->where('id', $employeeId)
                ->update(['employee_id' => 'MIG-TMP-'.$employeeId]);
        }

        foreach ($updates as $employeeId => $target) {
            $candidate = $target;
            $counter = 1;

            while (DB::table('employees')->where('employee_id', $candidate)->where('id', '<>', $employeeId)->exists()) {
                $candidate = $target.'-'.$counter;
                $counter++;
            }

            DB::table('employees')
                ->where('id', $employeeId)
                ->update(['employee_id' => $candidate]);
        }
    }

    public function down(): void
    {
        // Employee IDs are user-facing data, so rollback intentionally leaves them unchanged.
    }
};
