<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <title>{{ $payrollRun->title }}</title>
    <style>
        @page {
            size: A4 portrait;
            margin: 8mm;
        }
        body {
            background: #ffffff;
            color: #111827;
            font-family: DejaVu Sans, sans-serif;
            margin: 0;
        }
        h2 {
            color: #111827;
            font-size: 18px;
            font-weight: 600;
            line-height: 1.2;
            margin: 0 0 5mm;
        }
        .payroll-slip-grid {
            width: 100%;
            border-collapse: separate;
            border-spacing: 6mm;
            margin: -6mm;
        }
        .payroll-slip-cell {
            width: 50%;
            vertical-align: top;
        }
        .payroll-slip {
            page-break-inside: avoid;
            overflow: hidden;
            border: 1px dashed #64748b;
            background: #ffffff;
            padding: 2mm;
        }
        .payroll-slip-table {
            width: 100%;
            table-layout: fixed;
            border-collapse: collapse;
            overflow: hidden;
            border: 2px solid #111827;
            font-size: 10.5px;
            color: #111827;
        }
        .payroll-slip-table th,
        .payroll-slip-table td {
            border: 1px solid #111827;
            padding: 3.5px 5px;
            vertical-align: middle;
        }
        .payroll-slip-table th {
            background: #ffffff;
            color: #111827;
            text-align: center;
            font-weight: 800;
        }
        .payroll-slip-table .payroll-slip-employee {
            background: #ffffff;
            color: #050505;
            text-transform: uppercase;
            letter-spacing: 0;
            font-size: 17px;
            line-height: 1.15;
            padding: 8px 5px;
        }
        .payroll-slip-table .payroll-slip-total-head {
            background: #ffffff;
            color: #050505;
            font-size: 13px;
            line-height: 1.2;
        }
        .payroll-slip-table .payroll-slip-total-head span {
            display: block;
            color: #22c55e;
            font-family: DejaVu Sans Mono, monospace;
            font-size: 11px;
            font-weight: 900;
        }
        .payroll-slip-table .payroll-slip-meta td {
            background: #f8fafc;
            color: #475569;
            font-size: 9.5px;
            font-weight: 700;
            text-align: center;
        }
        .payroll-slip-table td:first-child {
            width: 34%;
            font-weight: 800;
            text-align: center;
        }
        .payroll-slip-table td:nth-child(2) {
            width: 36%;
            text-align: center;
            font-family: DejaVu Sans Mono, monospace;
            color: #374151;
            font-size: 11px;
        }
        .payroll-slip-table .amount {
            width: 30%;
            text-align: center;
            font-family: DejaVu Sans Mono, monospace;
            font-weight: 800;
            font-size: 11px;
            color: #111827;
        }
        .payroll-slip-table .danger {
            color: #dc2626;
        }
        .payroll-slip-table .success {
            color: #16a34a;
        }
    </style>
</head>
<body>
@php
    $formatPayrollAmount = fn ($value) => number_format(round((float) ($value ?? 0)), 0);
    $formatDeductionAmount = function ($value) {
        $amount = round((float) ($value ?? 0));

        return $amount > 0 ? '-'.number_format($amount, 0) : '0';
    };
    $formatEmployeeNumber = function ($value) {
        $raw = $value === null || $value === '' ? '' : (string) $value;
        return $raw === '' ? '-' : $raw;
    };
    $formatMinutes = function ($minutes) {
        $total = (int) ($minutes ?? 0);
        if ($total <= 0) {
            return '0m';
        }
        $hours = intdiv($total, 60);
        $mins = $total % 60;

        return $hours > 0 ? "{$hours}h {$mins}m" : "{$mins}m";
    };
    $formatDays = function ($value) {
        $total = (float) ($value ?? 0);

        return floor($total) == $total ? (string) ((int) $total) : number_format($total, 2);
    };
    $getManualFineAmount = fn ($entry) => (float) data_get($entry->deductions_breakdown, 'Manual Fine Amount', 0);
    $hasLegacyPartialAttendanceInFine = function ($entry) use ($getManualFineAmount) {
        $partialHours = (float) data_get($entry->deductions_breakdown, 'Partial Attendance Hours', 0);
        $fineAmount = $getManualFineAmount($entry);

        return $partialHours > 0 && (float) ($entry->other_deductions ?? 0) > $fineAmount;
    };
    $getDisplayedLateMinutes = function ($entry) use ($hasLegacyPartialAttendanceInFine) {
        $lateMinutes = (float) data_get($entry->deductions_breakdown, 'Late Minutes', 0);
        $partialHours = (float) data_get($entry->deductions_breakdown, 'Partial Attendance Hours', 0);

        return $hasLegacyPartialAttendanceInFine($entry) ? $lateMinutes + ($partialHours * 60) : $lateMinutes;
    };
    $getDisplayedLatePenalty = function ($entry) use ($hasLegacyPartialAttendanceInFine) {
        $latePenalty = (float) ($entry->late_penalty ?? 0);
        $partialPenalty = (float) data_get($entry->deductions_breakdown, 'Partial Attendance Penalty', 0);

        return $hasLegacyPartialAttendanceInFine($entry) ? $latePenalty + $partialPenalty : $latePenalty;
    };
@endphp

<h2>{{ __('Employee Payroll Entries') }}</h2>
<table class="payroll-slip-grid">
    <tbody>
    @foreach ($payrollRun->payrollEntries->chunk(2) as $rowEntries)
        <tr>
            @foreach ($rowEntries as $entry)
                @php
                    $employeeNumber = $formatEmployeeNumber($entry->employee?->employee?->employee_id_display ?? $entry->employee?->employee?->employee_id ?? $entry->employee?->employee_id ?? $entry->employee?->id);
                    $lateMinutes = $getDisplayedLateMinutes($entry);
                    $latePenalty = $getDisplayedLatePenalty($entry);
                    $absentDays = $entry->unpaid_leave_days ?: ($entry->absent_days ?: 0);
                    $fineAmount = $getManualFineAmount($entry);
                    $hasBonus = (float) ($entry->profile_bonus_amount ?? 0) > 0;
                @endphp
                <td class="payroll-slip-cell">
                    <div class="payroll-slip">
                        <table class="payroll-slip-table">
                            <tbody>
                            <tr class="payroll-slip-head">
                                <th class="payroll-slip-employee" colspan="2">{{ $entry->employee?->name ?? '-' }}</th>
                                <th class="payroll-slip-total-head">
                                    {{ __('TOTAL') }}
                                    <span>{{ $formatPayrollAmount($entry->net_pay) }}</span>
                                </th>
                            </tr>
                            <tr class="payroll-slip-meta">
                                <td>{{ __('Employee ID') }}</td>
                                <td>{{ $employeeNumber }}</td>
                                <td>{{ $entry->employee?->employee?->department?->name ?? '-' }}</td>
                            </tr>
                            <tr>
                                <td>{{ __('LATE') }}</td>
                                <td>{{ $formatMinutes($lateMinutes) }}</td>
                                <td class="amount danger">{{ $formatDeductionAmount($latePenalty) }}</td>
                            </tr>
                            <tr>
                                <td>{{ __('ABSENT') }}</td>
                                <td>{{ $formatDays($absentDays) }} {{ __('days') }}</td>
                                <td class="amount danger">{{ $formatDeductionAmount($entry->absence_deduction) }}</td>
                            </tr>
                            <tr>
                                <td>{{ __('FINE') }}</td>
                                <td>{{ $formatPayrollAmount($fineAmount) }}</td>
                                <td class="amount danger">{{ $formatDeductionAmount($fineAmount) }}</td>
                            </tr>
                            @if ($hasBonus)
                                <tr>
                                    <td>{{ __('BONUS') }}</td>
                                    <td>{{ $formatPayrollAmount($entry->bonus_amount) }}</td>
                                    <td class="amount success">{{ $formatPayrollAmount($entry->bonus_amount) }}</td>
                                </tr>
                            @endif
                            <tr>
                                <td>{{ __('Salary') }}</td>
                                <td>{{ $formatPayrollAmount($entry->basic_salary) }}</td>
                                <td class="amount">{{ $formatPayrollAmount($entry->basic_salary) }}</td>
                            </tr>
                            <tr>
                                <td>{{ __('Advance') }}</td>
                                <td>{{ $formatPayrollAmount($entry->advance_deduction) }}</td>
                                <td class="amount danger">{{ $formatDeductionAmount($entry->advance_deduction) }}</td>
                            </tr>
                            </tbody>
                        </table>
                    </div>
                </td>
            @endforeach
            @if ($rowEntries->count() === 1)
                <td class="payroll-slip-cell"></td>
            @endif
        </tr>
    @endforeach
    </tbody>
</table>
</body>
</html>
