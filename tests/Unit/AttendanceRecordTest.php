<?php

use App\Models\AttendanceRecord;

it('keeps early departure minutes out of payable late time', function () {
    $record = new AttendanceRecord([
        'is_late' => false,
        'late_minutes' => 68,
        'is_early_departure' => true,
        'early_leave_minutes' => 68,
    ]);

    expect($record->payableLateMinutes())->toBe(0)
        ->and($record->early_leave_minutes)->toBe(68);
});

it('returns only actual late-arrival minutes for payroll', function () {
    $record = new AttendanceRecord([
        'is_late' => true,
        'late_minutes' => 25,
        'is_early_departure' => true,
        'early_leave_minutes' => 68,
    ]);

    expect($record->payableLateMinutes())->toBe(25)
        ->and($record->early_leave_minutes)->toBe(68);
});
