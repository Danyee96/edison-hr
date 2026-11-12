<?php

namespace App\Http\Controllers;

use App\Models\AdvanceSalary;
use App\Models\AttendanceRecord;
use App\Models\Department;
use App\Models\EmployeeBonus;
use App\Models\PayrollEntry;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class HrReportController extends Controller
{
    public function index(Request $request)
    {
        if (! Auth::user()->can('manage-hr-reports')) {
            return redirect()->back()->with('error', __('Permission Denied.'));
        }

        $dateFrom = $request->date_from ?: now()->startOfMonth()->toDateString();
        $dateTo = $request->date_to ?: now()->endOfMonth()->toDateString();

        $attendance = AttendanceRecord::query()
            ->whereIn('created_by', getCompanyAndUsersId())
            ->whereBetween('date', [$dateFrom, $dateTo])
            ->selectRaw('status, count(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        $departments = Department::withCount('employees')
            ->whereIn('created_by', getCompanyAndUsersId())
            ->get(['id', 'name']);

        $payroll = PayrollEntry::whereIn('created_by', getCompanyAndUsersId())
            ->selectRaw('sum(gross_pay) as gross_pay, sum(total_deductions) as total_deductions, sum(net_pay) as net_pay, sum(bonus_amount) as bonus_amount, sum(advance_deduction) as advance_deduction, sum(late_penalty) as late_penalty')
            ->first();

        return Inertia::render('hr/reports/index', [
            'filters' => ['date_from' => $dateFrom, 'date_to' => $dateTo],
            'attendance' => $attendance,
            'departments' => $departments,
            'payroll' => $payroll,
            'bonusTotal' => EmployeeBonus::whereIn('created_by', getCompanyAndUsersId())->whereBetween('bonus_date', [$dateFrom, $dateTo])->sum('amount'),
            'outstandingAdvances' => AdvanceSalary::whereIn('created_by', getCompanyAndUsersId())->where('status', 'approved')->get()->sum('outstanding_amount'),
        ]);
    }
}
