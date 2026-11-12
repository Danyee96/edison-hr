<?php

namespace App\Models;

use App\Services\WorkingScheduleService;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Support\Facades\DB;

class PayrollRun extends BaseModel
{
    use HasFactory;

    protected $fillable = [
        'title',
        'payroll_frequency',
        'pay_period_start',
        'pay_period_end',
        'pay_date',
        'total_gross_pay',
        'total_deductions',
        'total_net_pay',
        'employee_count',
        'status',
        'notes',
        'created_by',
    ];

    protected $casts = [
        'pay_period_start' => 'date',
        'pay_period_end' => 'date',
        'pay_date' => 'date',
        'total_gross_pay' => 'decimal:2',
        'total_deductions' => 'decimal:2',
        'total_net_pay' => 'decimal:2',
    ];

    /**
     * Get the payroll entries.
     */
    public function payrollEntries()
    {
        return $this->hasMany(PayrollEntry::class);
    }

    /**
     * Get the payslips through payroll entries.
     */
    public function payslips()
    {
        return $this->hasManyThrough(Payslip::class, PayrollEntry::class);
    }

    public function forwardedAdvances()
    {
        return $this->hasMany(AdvanceSalary::class, 'payroll_run_id');
    }

    /**
     * Get the user who created the payroll run.
     */
    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function forwardedAdvanceNote(): string
    {
        return 'Minus from previous month - Payroll Run #'.$this->id;
    }

    public function deleteForwardedAdvances(): void
    {
        $note = $this->forwardedAdvanceNote();

        AdvanceSalary::where(function ($query) use ($note) {
                $query->where('payroll_run_id', $this->id)
                    ->orWhere('notes', $note);
            })
            ->whereIn('created_by', getCompanyAndUsersId())
            ->delete();
    }

    /**
     * Calculate and update totals.
     */
    public function calculateTotals()
    {
        $entries = $this->payrollEntries;

        $this->total_gross_pay = $entries->sum('gross_pay');
        $this->total_deductions = $entries->sum('total_deductions');
        $this->total_net_pay = $entries->sum('net_pay');
        $this->employee_count = $entries->count();

        $this->save();
    }

    public function calculatePayPeriodDays(): int
    {
        $periodDate = $this->pay_period_start ?: $this->pay_period_end ?: $this->pay_date;

        return $periodDate ? Carbon::parse($periodDate)->daysInMonth : 0;
    }

    public function calculatePerDaySalary(float $basicSalary): float
    {
        $payPeriodDays = $this->calculatePayPeriodDays();

        return $payPeriodDays > 0 ? $basicSalary / $payPeriodDays : 0;
    }

    public function calculateLeaveDeduction(float $basicSalary, int|float $absentDays): float
    {
        $payPeriodDays = $this->calculatePayPeriodDays();

        if ($payPeriodDays <= 0 || $absentDays <= 0) {
            return 0;
        }

        return round($this->calculatePerDaySalary($basicSalary) * $absentDays, 2);
    }

    private function calculatePerMinuteSalaryForDate(float $basicSalary, $date, WorkingScheduleService $workingSchedule, ?array $settings = null): float
    {
        $expectedMinutes = $workingSchedule->expectedMinutesForDate($date, $settings);

        if ($expectedMinutes <= 0) {
            return 0;
        }

        return $this->calculatePerDaySalary($basicSalary) / $expectedMinutes;
    }

    private function calculateLatePenalty($attendanceRecords, float $basicSalary, WorkingScheduleService $workingSchedule, ?array $settings = null): float
    {
        $penalty = $attendanceRecords->sum(function ($record) use ($basicSalary, $workingSchedule, $settings) {
            return $this->calculatePerMinuteSalaryForDate($basicSalary, $record->date, $workingSchedule, $settings)
                * $record->payableLateMinutes();
        });

        return round($penalty, 2);
    }

    private function calculatePartialAttendancePenalty($attendanceRecords, float $basicSalary, WorkingScheduleService $workingSchedule, ?array $settings = null): float
    {
        $penalty = $attendanceRecords->sum(function ($record) use ($basicSalary, $workingSchedule, $settings) {
            return $this->calculatePerMinuteSalaryForDate($basicSalary, $record->date, $workingSchedule, $settings) * 120;
        });

        return round($penalty, 2);
    }

    public function syncCurrentFormulaToEntries(): void
    {
        if (! $this->exists) {
            return;
        }

        $employeeIds = $this->payrollEntries()->pluck('employee_id')->filter()->unique()->values();

        foreach ($employeeIds as $employeeId) {
            $this->recalcEmployeePayroll((int) $employeeId);
        }

        $this->refresh();
        $this->calculateTotals();
    }

    public function syncFineDeductionsToEntries(?array $employeeIds = null): void
    {
        if (! $this->exists) {
            return;
        }

        $entries = $this->payrollEntries();

        if (! empty($employeeIds)) {
            $entries->whereIn('employee_id', array_map('intval', $employeeIds));
        }

        $entries->get()->each(function (PayrollEntry $entry) {
            $this->syncFineDeductionToEntry($entry);
        });

        $this->calculateTotals();
    }

    private function syncFineDeductionToEntry(PayrollEntry $entry): void
    {
        $fineRecords = PayrollFine::where('employee_id', $entry->employee_id)
            ->whereIn('created_by', getCompanyAndUsersId())
            ->whereBetween('fine_date', [$this->pay_period_start, $this->pay_period_end])
            ->orderBy('fine_date')
            ->orderBy('id')
            ->get();

        $newFineAmount = round($fineRecords->sum(fn ($fine) => (float) $fine->amount), 2);
        $fineNotes = $fineRecords
            ->filter(fn ($fine) => ! empty($fine->notes))
            ->map(fn ($fine) => $fine->fine_date?->toDateString().': '.$fine->notes)
            ->values()
            ->all();

        $breakdown = $entry->deductions_breakdown ?: [];
        $oldFineAmount = round((float) ($breakdown['Manual Fine Amount'] ?? 0), 2);
        $difference = round($newFineAmount - $oldFineAmount, 2);

        if ($difference == 0.0 && $breakdown === $this->fineBreakdown($breakdown, $newFineAmount, $fineNotes)) {
            return;
        }

        $entry->deductions_breakdown = $this->fineBreakdown($breakdown, $newFineAmount, $fineNotes);
        $entry->other_deductions = round(max(0, (float) $entry->other_deductions - $oldFineAmount + $newFineAmount), 2);
        $entry->total_deductions = round((float) $entry->total_deductions + $difference, 2);
        $entry->net_pay = round((float) $entry->net_pay - $difference, 2);
        $entry->save();
    }

    private function fineBreakdown(array $breakdown, float $fineAmount, array $fineNotes): array
    {
        $breakdown['Manual Fine Amount'] = $fineAmount;
        $breakdown['Manual Fine Notes'] = $fineNotes;

        return array_filter($breakdown, function ($value) {
            if (is_array($value)) {
                return ! empty($value);
            }

            return $value !== null && $value !== '' && $value !== 0 && $value !== 0.0 && $value !== '0';
        });
    }

    /**
     * Process payroll for all employees.
     */
    public function processPayroll(?array $employeeIds = null)
    {
        if ($this->status !== 'draft') {
            return false;
        }

        $this->status = 'draft';
        $this->save();

        try {
            DB::transaction(function () use ($employeeIds) {
                $companyUserIds = getCompanyAndUsersId();
                $workingSchedule = app(WorkingScheduleService::class);
                $settings = settings();

                if (empty($workingSchedule->workingDayIndices($settings))) {
                    throw new \Exception(__('Please configure working days first.'));
                }

                $workingDateKeys = collect(CarbonPeriod::create($this->pay_period_start, $this->pay_period_end))
                    ->filter(fn ($date) => $workingSchedule->isWorkingDate($date, $settings))
                    ->map(fn ($date) => $date->toDateString())
                    ->values();

                $payrollContext = [
                    'company_user_ids' => $companyUserIds,
                    'working_date_keys' => $workingDateKeys,
                    'total_working_days' => $workingDateKeys->count(),
                    'working_schedule' => $workingSchedule,
                    'settings' => $settings,
                ];

                // Get all active employees
                $employees = User::with('employee')->where('type', 'employee')
                    ->whereIn('created_by', $companyUserIds)
                    ->whereHas('employee', function ($q) {
                        $q->whereIn('employee_status', ['active', 'probation']);
                    });

                if (! empty($employeeIds)) {
                    $employees->whereIn('id', $employeeIds);
                }

                $employees = $employees
                    ->orderby('id', 'desc')
                    ->get();

                $this->payrollEntries()->delete();

                $payrollContext['salaries'] = EmployeeSalary::whereIn('employee_id', $employees->pluck('id'))
                    ->where('is_active', true)
                    ->get()
                    ->keyBy('employee_id');

                $payrollContext['attendance'] = AttendanceRecord::whereIn('employee_id', $employees->pluck('id'))
                    ->whereBetween('date', [$this->pay_period_start, $this->pay_period_end])
                    ->orderBy('date')
                    ->get()
                    ->groupBy('employee_id');

                $payrollContext['profile_bonuses'] = EmployeeBonus::whereIn('employee_id', $employees->pluck('id'))
                    ->where('bonus_type', 'custom')
                    ->where('notes', 'Employee profile bonus')
                    ->whereIn('created_by', $companyUserIds)
                    ->latest('bonus_date')
                    ->latest('id')
                    ->get()
                    ->unique('employee_id')
                    ->keyBy('employee_id');

                $payrollContext['fines'] = PayrollFine::whereIn('employee_id', $employees->pluck('id'))
                    ->whereIn('created_by', $companyUserIds)
                    ->whereBetween('fine_date', [$this->pay_period_start, $this->pay_period_end])
                    ->orderBy('fine_date')
                    ->orderBy('id')
                    ->get()
                    ->groupBy('employee_id');

                foreach ($employees as $employee) {
                    $this->processEmployeePayroll($employee, $payrollContext);
                }

                $this->syncNegativeNetPayAdvances();
                $this->calculateTotals();
                $this->status = 'completed';
                $this->save();
            });

            return true;
        } catch (\Exception $e) {
            $this->status = 'draft';
            $this->save();
            throw $e;
        }
    }

    /**
     * Process payroll for individual employee.
     */
    private function processEmployeePayroll($employee, array $payrollContext)
    {
        $employeeSalary = $payrollContext['salaries']->get($employee->id);

        if (! $employeeSalary) {
            return;
        }

        $attendanceRecords = $payrollContext['attendance']->get($employee->id, collect());
        $totalWorkingDays = $payrollContext['total_working_days'];
        $holidayDays = $attendanceRecords->where('status', 'holiday')->count();
        $workingDateKeys = $payrollContext['working_date_keys'];
        $workingDateLookup = $workingDateKeys->flip();

        $recordsByDate = $attendanceRecords->keyBy(fn ($record) => $record->date->toDateString());
        $presentDays = 0;
        $offDays = 0;

        foreach ($workingDateKeys as $dateKey) {
            $record = $recordsByDate->get($dateKey);
            $workedThatDay = $record && (
                ! empty($record->clock_in)
                || ! empty($record->clock_out)
                || in_array($record->status, ['present', 'holiday'], true)
            );

            if ($workedThatDay) {
                $presentDays++;
            } else {
                $offDays++;
            }
        }

        if ($totalWorkingDays > 0 && $presentDays === 0) {
            return;
        }

        $basicSalary = (float) $employeeSalary->basic_salary;
        $profileBonus = (float) ($payrollContext['profile_bonuses']->get($employee->id)?->amount ?? 0);
        $isBonusOnlyPayroll = $basicSalary <= 0 && $profileBonus > 0;
        $deductionBase = $basicSalary > 0 ? $basicSalary : $profileBonus;
        $perDaySalary = $this->calculatePerDaySalary($basicSalary);
        $perDayDeductionBase = $this->calculatePerDaySalary($deductionBase);
        $offDayDeduction = $this->calculateLeaveDeduction($deductionBase, $offDays);
        $lateRecords = $attendanceRecords
            ->filter(fn ($record) => $workingDateLookup->has($record->date->toDateString()));
        $lateMinutes = (int) $lateRecords->sum(fn ($record) => $record->payableLateMinutes());
        $latePenalty = $this->calculateLatePenalty(
            $lateRecords,
            $deductionBase,
            $payrollContext['working_schedule'],
            $payrollContext['settings']
        );

        $partialAttendanceRecords = $isBonusOnlyPayroll
            ? collect()
            : $attendanceRecords->filter(fn ($record) => $workingDateLookup->has($record->date->toDateString()) && ! $record->is_holiday && (
                empty($record->clock_in) && ! empty($record->clock_out)
            ));
        $partialAttendanceDays = (int) $partialAttendanceRecords->count();
        $partialAttendancePenalty = $this->calculatePartialAttendancePenalty(
            $partialAttendanceRecords,
            $deductionBase,
            $payrollContext['working_schedule'],
            $payrollContext['settings']
        );
        $partialAttendanceMinutes = $partialAttendanceDays * 120;
        $latePenalty = round($latePenalty + $partialAttendancePenalty, 2);
        $lateMinutes += $partialAttendanceMinutes;

        $bonusDeduction = $basicSalary > 0 ? min($profileBonus, $offDays * 1000) : 0;
        $bonusAmount = round(max(0, $profileBonus - $bonusDeduction), 2);
        $advanceDeductions = $this->deductApprovedAdvances($employee->id, $bonusAmount);
        $advanceDeduction = $advanceDeductions['total'];
        $fineRecords = $payrollContext['fines']->get($employee->id, collect());
        $manualFineAmount = round($fineRecords->sum(fn ($fine) => (float) $fine->amount), 2);
        $manualFineNotes = $fineRecords
            ->filter(fn ($fine) => ! empty($fine->notes))
            ->map(fn ($fine) => $fine->fine_date?->toDateString().': '.$fine->notes)
            ->values()
            ->all();
        $penaltiesAndFines = $manualFineAmount;
        $totalDeductions = round($advanceDeduction + $offDayDeduction + $latePenalty + $penaltiesAndFines, 2);
        $grossSalary = round($basicSalary + $bonusAmount, 2);
        $netSalary = round($basicSalary - $advanceDeduction - $offDayDeduction - $latePenalty - $penaltiesAndFines + $bonusAmount, 2);

        PayrollEntry::create([
            'payroll_run_id' => $this->id,
            'employee_id' => $employee->id,
            'basic_salary' => $basicSalary,
            'component_earnings' => 0,
            'total_earnings' => $grossSalary,
            'total_deductions' => $totalDeductions,
            'gross_pay' => $grossSalary,
            'net_pay' => $netSalary,
            'working_days' => $totalWorkingDays,
            'present_days' => $presentDays,
            'full_present_days' => $presentDays,
            'half_days' => 0,
            'holiday_days' => $holidayDays,
            'paid_leave_days' => 0,
            'unpaid_leave_days' => $offDays,
            'absent_days' => $offDays,
            'overtime_hours' => 0,
            'overtime_amount' => 0,
            'bonus_amount' => $bonusAmount,
            'advance_deduction' => $advanceDeduction,
            'absence_deduction' => $offDayDeduction,
            'late_penalty' => $latePenalty,
            'other_deductions' => $penaltiesAndFines,
            'per_day_salary' => $perDaySalary,
            'unpaid_leave_deduction' => $offDayDeduction,
            'earnings_breakdown' => array_filter([
                'Basic Salary' => $basicSalary,
                'Bonus Applied' => $bonusAmount,
            ]),
            'deductions_breakdown' => array_filter([
                'Deduction Base' => $deductionBase,
                'Per Day Deduction Base' => round($perDayDeductionBase, 2),
                'Advance Deduction' => $advanceDeduction,
                'Advance Deduction From Salary' => $advanceDeductions['salary'],
                'Advance Deduction From Bonus' => $advanceDeductions['bonus'],
                'Advance Installment Details' => $advanceDeductions['details'],
                'Off Days Deduction' => $offDayDeduction,
                'Late Deduction' => $latePenalty,
                'Partial Attendance Penalty' => $partialAttendancePenalty,
                'Partial Attendance Hours' => $partialAttendanceDays * 2,
                'Manual Fine Amount' => $manualFineAmount,
                'Manual Fine Notes' => $manualFineNotes,
                'Late Minutes' => $lateMinutes,
                'Bonus Deduction From Off Days' => $bonusDeduction,
            ]),
            'notes' => __('Deduction formula: basic salary is divided by the selected month days; leave, late, and partial attendance deductions use that monthly day rate.'),
            'created_by' => $this->created_by,
        ]);
    }

    private function syncNegativeNetPayAdvances(): void
    {
        $nextMonthDate = Carbon::parse($this->pay_period_start)
            ->addMonthNoOverflow()
            ->startOfMonth()
            ->toDateString();
        $note = $this->forwardedAdvanceNote();
        $negativeEntries = $this->payrollEntries()
            ->where('net_pay', '<', 0)
            ->get(['id', 'employee_id', 'net_pay', 'created_by'])
            ->keyBy('employee_id');

        AdvanceSalary::whereIn('created_by', getCompanyAndUsersId())
            ->where(function ($query) use ($note) {
                $query->where('payroll_run_id', $this->id)
                    ->orWhere('notes', $note);
            })
            ->whereDate('request_date', $nextMonthDate)
            ->whereNotIn('employee_id', $negativeEntries->keys())
            ->delete();

        foreach ($negativeEntries as $entry) {
            $amount = round(abs((float) $entry->net_pay), 2);

            if ($amount <= 0) {
                continue;
            }

            AdvanceSalary::whereIn('created_by', getCompanyAndUsersId())
                ->where('employee_id', $entry->employee_id)
                ->whereDate('request_date', $nextMonthDate)
                ->where('notes', $note)
                ->whereNull('payroll_run_id')
                ->delete();

            AdvanceSalary::updateOrCreate(
                [
                    'payroll_run_id' => $this->id,
                    'employee_id' => $entry->employee_id,
                ],
                [
                    'payroll_entry_id' => $entry->id,
                    'request_date' => $nextMonthDate,
                    'notes' => $note,
                    'amount' => $amount,
                    'deducted_amount' => 0,
                    'repayment_type' => 'full',
                    'repayment_source' => 'salary',
                    'installment_months' => null,
                    'monthly_installment_amount' => null,
                    'installment_start_date' => null,
                    'approval_date' => $nextMonthDate,
                    'status' => 'approved',
                    'created_by' => $entry->created_by ?: $this->created_by,
                ]
            );
        }
    }

    /**
     * Recalculate payroll entry for a single employee on this payroll run.
     * This will update existing PayrollEntry if present (useful when salary changes).
     */
    public function recalcEmployeePayroll(int $employeeId)
    {
        $employee = User::with('employee')->find($employeeId);
        if (! $employee) return false;

        $employeeSalary = EmployeeSalary::where('employee_id', $employee->id)->where('is_active', true)->first();
        if (! $employeeSalary) return false;

        $attendanceRecords = AttendanceRecord::where('employee_id', $employee->id)
            ->whereBetween('date', [$this->pay_period_start, $this->pay_period_end])
            ->orderBy('date')
            ->get();

        $workingDateKeys = collect(CarbonPeriod::create($this->pay_period_start, $this->pay_period_end))
            ->filter(fn ($date) => app(WorkingScheduleService::class)->isWorkingDate($date, settings()))
            ->map(fn ($date) => $date->toDateString())
            ->values();

        $totalWorkingDays = $workingDateKeys->count();
        $recordsByDate = $attendanceRecords->keyBy(fn ($record) => $record->date->toDateString());
        $presentDays = 0;
        $offDays = 0;

        foreach ($workingDateKeys as $dateKey) {
            $record = $recordsByDate->get($dateKey);
            $workedThatDay = $record && (
                ! empty($record->clock_in)
                || ! empty($record->clock_out)
                || in_array($record->status, ['present', 'holiday'], true)
            );

            if ($workedThatDay) {
                $presentDays++;
            } else {
                $offDays++;
            }
        }

        if ($totalWorkingDays > 0 && $presentDays === 0) {
            PayrollEntry::where('payroll_run_id', $this->id)
                ->where('employee_id', $employee->id)
                ->delete();
            $this->calculateTotals();

            return true;
        }

        $basicSalary = (float) $employeeSalary->basic_salary;
        $workingSchedule = app(WorkingScheduleService::class);
        $settings = settings();
        $profileBonus = (float) (EmployeeBonus::where('employee_id', $employee->id)
            ->where('bonus_type', 'custom')
            ->where('notes', 'Employee profile bonus')
            ->whereIn('created_by', getCompanyAndUsersId())
            ->latest('bonus_date')
            ->latest('id')
            ->get()
            ->unique('employee_id')
            ->pluck('amount')
            ->first() ?? 0);

        $isBonusOnlyPayroll = $basicSalary <= 0 && $profileBonus > 0;
        $deductionBase = $basicSalary > 0 ? $basicSalary : $profileBonus;
        $perDaySalary = $this->calculatePerDaySalary($basicSalary);
        $perDayDeductionBase = $this->calculatePerDaySalary($deductionBase);
        $offDayDeduction = $this->calculateLeaveDeduction($deductionBase, $offDays);
        $workingDateLookup = $workingDateKeys->flip();
        $lateRecords = $attendanceRecords
            ->filter(fn ($record) => $workingDateLookup->has($record->date->toDateString()));
        $lateMinutes = (int) $lateRecords->sum(fn ($record) => $record->payableLateMinutes());
        $latePenalty = $this->calculateLatePenalty($lateRecords, $deductionBase, $workingSchedule, $settings);

        $partialAttendanceRecords = $isBonusOnlyPayroll
            ? collect()
            : $attendanceRecords->filter(fn ($record) => $workingDateLookup->has($record->date->toDateString()) && ! $record->is_holiday && (
                empty($record->clock_in) && ! empty($record->clock_out)
            ));
        $partialAttendanceDays = (int) $partialAttendanceRecords->count();
        $partialAttendancePenalty = $this->calculatePartialAttendancePenalty($partialAttendanceRecords, $deductionBase, $workingSchedule, $settings);
        $partialAttendanceMinutes = $partialAttendanceDays * 120;
        $latePenalty = round($latePenalty + $partialAttendancePenalty, 2);
        $lateMinutes += $partialAttendanceMinutes;

        $bonusDeduction = $basicSalary > 0 ? min($profileBonus, $offDays * 1000) : 0;
        $bonusAmount = round(max(0, $profileBonus - $bonusDeduction), 2);
        $advanceDeductions = $this->deductApprovedAdvances($employee->id, $bonusAmount);
        $advanceDeduction = $advanceDeductions['total'];
        $fineRecords = PayrollFine::where('employee_id', $employee->id)
            ->whereIn('created_by', getCompanyAndUsersId())
            ->whereBetween('fine_date', [$this->pay_period_start, $this->pay_period_end])
            ->orderBy('fine_date')
            ->orderBy('id')
            ->get();
        $manualFineAmount = round($fineRecords->sum(fn ($fine) => (float) $fine->amount), 2);
        $manualFineNotes = $fineRecords
            ->filter(fn ($fine) => ! empty($fine->notes))
            ->map(fn ($fine) => $fine->fine_date?->toDateString().': '.$fine->notes)
            ->values()
            ->all();
        $penaltiesAndFines = $manualFineAmount;
        $totalDeductions = round($advanceDeduction + $offDayDeduction + $latePenalty + $penaltiesAndFines, 2);
        $grossSalary = round($basicSalary + $bonusAmount, 2);
        $netSalary = round($basicSalary - $advanceDeduction - $offDayDeduction - $latePenalty - $penaltiesAndFines + $bonusAmount, 2);

        $entry = PayrollEntry::where('payroll_run_id', $this->id)->where('employee_id', $employee->id)->first();
        if (! $entry) return false;

        $entry->basic_salary = $basicSalary;
        $entry->component_earnings = 0;
        $entry->total_earnings = $grossSalary;
        $entry->total_deductions = $totalDeductions;
        $entry->gross_pay = $grossSalary;
        $entry->net_pay = $netSalary;
        $entry->working_days = $totalWorkingDays;
        $entry->present_days = $presentDays;
        $entry->full_present_days = $presentDays;
        $entry->half_days = 0;
        $entry->holiday_days = $attendanceRecords->where('status', 'holiday')->count();
        $entry->paid_leave_days = 0;
        $entry->unpaid_leave_days = $offDays;
        $entry->absent_days = $offDays;
        $entry->overtime_hours = 0;
        $entry->overtime_amount = 0;
        $entry->bonus_amount = $bonusAmount;
        $entry->advance_deduction = $advanceDeduction;
        $entry->absence_deduction = $offDayDeduction;
        $entry->late_penalty = $latePenalty;
        $entry->other_deductions = $penaltiesAndFines;
        $entry->per_day_salary = $perDaySalary;
        $entry->unpaid_leave_deduction = $offDayDeduction;
        $entry->earnings_breakdown = array_filter([
            'Basic Salary' => $basicSalary,
            'Bonus Applied' => $bonusAmount,
        ]);
        $entry->deductions_breakdown = array_filter([
            'Deduction Base' => $deductionBase,
            'Per Day Deduction Base' => round($perDayDeductionBase, 2),
            'Advance Deduction' => $advanceDeduction,
            'Advance Deduction From Salary' => $advanceDeductions['salary'],
            'Advance Deduction From Bonus' => $advanceDeductions['bonus'],
            'Advance Installment Details' => $advanceDeductions['details'],
            'Off Days Deduction' => $offDayDeduction,
            'Late Deduction' => $latePenalty,
            'Partial Attendance Penalty' => $partialAttendancePenalty,
            'Partial Attendance Hours' => $partialAttendanceDays * 2,
            'Manual Fine Amount' => $manualFineAmount,
            'Manual Fine Notes' => $manualFineNotes,
            'Late Minutes' => $lateMinutes,
            'Bonus Deduction From Off Days' => $bonusDeduction,
        ]);
        $entry->notes = __('Deduction formula: basic salary is divided by the selected month days; leave, late, and partial attendance deductions use that monthly day rate.');
        $entry->save();

        // Update payroll run totals after changing entry
        $this->calculateTotals();

        return true;
    }

    private function deductApprovedAdvances(int $employeeId, float $availableBonus = 0): array
    {
        $deducted = [
            'salary' => 0,
            'bonus' => 0,
            'total' => 0,
            'details' => [],
        ];

        DB::transaction(function () use ($employeeId, $availableBonus, &$deducted) {
            $advances = AdvanceSalary::where('employee_id', $employeeId)
                ->where('status', 'approved')
                ->whereIn('created_by', getCompanyAndUsersId())
                ->whereDate('request_date', '<=', $this->pay_period_end)
                ->where(function ($query) {
                    $query->whereColumn('deducted_amount', '<', 'amount')
                        ->orWhereBetween('request_date', [$this->pay_period_start, $this->pay_period_end]);
                })
                ->lockForUpdate()
                ->orderBy('request_date')
                ->orderBy('id')
                ->get();
            $remainingBonus = max(0, $availableBonus);

            foreach ($advances as $advance) {
                $isCurrentPeriodAdvance = $advance->request_date
                    && $advance->request_date->betweenIncluded($this->pay_period_start, $this->pay_period_end);
                $isInstallment = ($advance->repayment_type ?? 'full') === 'installment';
                $installmentStarted = ! $advance->installment_start_date
                    || $advance->installment_start_date->startOfMonth()->lessThanOrEqualTo($this->pay_period_end->copy()->startOfMonth());

                if ($isInstallment) {
                    if (! $installmentStarted) {
                        continue;
                    }

                    $amount = min(
                        (float) $advance->outstanding_amount,
                        (float) ($advance->monthly_installment_amount ?: $advance->outstanding_amount)
                    );
                } else {
                    $amount = $isCurrentPeriodAdvance ? (float) $advance->amount : (float) $advance->outstanding_amount;
                }

                if ($amount <= 0) {
                    continue;
                }

                $source = ($advance->repayment_source ?? 'salary') === 'bonus' ? 'bonus' : 'salary';

                if ($source === 'bonus') {
                    $amount = min($amount, $remainingBonus);

                    if ($amount <= 0) {
                        continue;
                    }

                    $remainingBonus = round($remainingBonus - $amount, 2);
                }

                if ((float) $advance->deducted_amount < (float) $advance->amount) {
                    $advance->deducted_amount = min((float) $advance->amount, (float) $advance->deducted_amount + $amount);
                    $advance->save();
                }

                $deducted[$source] = round($deducted[$source] + $amount, 2);
                $deducted['total'] = round($deducted['total'] + $amount, 2);
                $deducted['details'][] = [
                    'advance_id' => $advance->id,
                    'amount' => round($amount, 2),
                    'source' => $source,
                    'repayment_type' => $isInstallment ? 'installment' : 'full',
                    'outstanding_after' => max(0, round((float) $advance->amount - (float) $advance->deducted_amount, 2)),
                ];
            }
        });

        return $deducted;
    }

    /**
     * Get employee leave data for pay period.
     */
    private function getEmployeeLeaveData($employeeId)
    {
        $leaveApplications = \App\Models\LeaveApplication::where('employee_id', $employeeId)
            ->where('status', 'approved')
            ->where(function ($query) {
                $query->whereBetween('start_date', [$this->pay_period_start, $this->pay_period_end])
                    ->orWhereBetween('end_date', [$this->pay_period_start, $this->pay_period_end])
                    ->orWhere(function ($q) {
                        $q->where('start_date', '<=', $this->pay_period_start)
                            ->where('end_date', '>=', $this->pay_period_end);
                    });
            })
            ->with('leaveType')
            ->get();

        $paidLeaveDays = 0;
        $unpaidLeaveDays = 0;

        foreach ($leaveApplications as $leave) {
            // Calculate days within pay period
            $leaveStart = max($leave->start_date, $this->pay_period_start);
            $leaveEnd = min($leave->end_date, $this->pay_period_end);
            $leaveDays = $leaveStart->diffInDays($leaveEnd) + 1;

            if ($leave->leaveType->is_paid) {
                $paidLeaveDays += $leaveDays;
            } else {
                $unpaidLeaveDays += $leaveDays;
            }
        }

        return [
            'paid_leave_days' => $paidLeaveDays,
            'unpaid_leave_days' => $unpaidLeaveDays,
        ];
    }
}
