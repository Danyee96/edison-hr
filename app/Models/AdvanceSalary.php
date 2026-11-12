<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Support\Str;

class AdvanceSalary extends BaseModel
{
    use HasFactory;

    protected $fillable = [
        'employee_id',
        'payroll_run_id',
        'payroll_entry_id',
        'amount',
        'deducted_amount',
        'repayment_type',
        'repayment_source',
        'installment_months',
        'monthly_installment_amount',
        'installment_start_date',
        'request_date',
        'approval_date',
        'status',
        'notes',
        'receipt_token',
        'created_by',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'deducted_amount' => 'decimal:2',
        'monthly_installment_amount' => 'decimal:2',
        'installment_start_date' => 'date',
        'request_date' => 'date',
        'approval_date' => 'date',
    ];

    public function employee()
    {
        return $this->belongsTo(User::class, 'employee_id');
    }

    public function payrollRun()
    {
        return $this->belongsTo(PayrollRun::class);
    }

    public function payrollEntry()
    {
        return $this->belongsTo(PayrollEntry::class);
    }

    protected static function booted(): void
    {
        static::creating(function (AdvanceSalary $advanceSalary) {
            if (! $advanceSalary->receipt_token) {
                $advanceSalary->receipt_token = static::generateReceiptToken();
            }
        });
    }

    public static function generateReceiptToken(): string
    {
        do {
            $token = Str::random(8);
        } while (static::where('receipt_token', $token)->exists());

        return $token;
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function getOutstandingAmountAttribute(): float
    {
        return max(0, (float) $this->amount - (float) $this->deducted_amount);
    }
}
