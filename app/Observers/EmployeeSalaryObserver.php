<?php

namespace App\Observers;

use App\Models\EmployeeSalary;
use App\Models\PayrollEntry;
use App\Models\PayrollRun;

class EmployeeSalaryObserver
{
    /**
     * Handle the EmployeeSalary "updated" event.
     */
    public function updated(EmployeeSalary $employeeSalary)
    {
        // When the basic salary changes, update payroll entries for runs that are not completed
        if ($employeeSalary->wasChanged('basic_salary')) {
            $employeeId = $employeeSalary->employee_id;

            // Find payroll runs that include this employee and are not completed
            $payrollRunIds = PayrollEntry::where('employee_id', $employeeId)
                ->whereHas('payrollRun', function ($q) {
                    $q->where('status', '!=', 'completed');
                })->pluck('payroll_run_id')->unique();

            foreach ($payrollRunIds as $runId) {
                $run = PayrollRun::find($runId);
                if ($run) {
                    try {
                        $run->recalcEmployeePayroll($employeeId);
                    } catch (\Exception $e) {
                        // Silent failure: don't break user flow
                        \Log::error('Failed to recalc payroll entry after salary update: ' . $e->getMessage());
                    }
                }
            }
        }
    }
}
