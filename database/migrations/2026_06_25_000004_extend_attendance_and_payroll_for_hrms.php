<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('employees')) {
            Schema::table('employees', function (Blueprint $table) {
                if (! Schema::hasColumn('employees', 'cnic')) {
                    $table->string('cnic')->nullable()->after('phone');
                }
                if (! Schema::hasColumn('employees', 'overtime_rate')) {
                    $table->decimal('overtime_rate', 10, 2)->nullable()->after('base_salary');
                }
            });
        }

        if (Schema::hasTable('attendance_records')) {
            Schema::table('attendance_records', function (Blueprint $table) {
                if (! Schema::hasColumn('attendance_records', 'on_duty')) {
                    $table->time('on_duty')->nullable()->after('date');
                }
                if (! Schema::hasColumn('attendance_records', 'off_duty')) {
                    $table->time('off_duty')->nullable()->after('on_duty');
                }
                if (! Schema::hasColumn('attendance_records', 'late_minutes')) {
                    $table->unsignedInteger('late_minutes')->default(0)->after('is_late');
                }
                if (! Schema::hasColumn('attendance_records', 'early_leave_minutes')) {
                    $table->unsignedInteger('early_leave_minutes')->default(0)->after('is_early_departure');
                }
                if (! Schema::hasColumn('attendance_records', 'work_time')) {
                    $table->string('work_time')->nullable()->after('total_hours');
                }
            });
        }

        if (Schema::hasTable('payroll_entries')) {
            Schema::table('payroll_entries', function (Blueprint $table) {
                foreach ([
                    'bonus_amount',
                    'advance_deduction',
                    'absence_deduction',
                    'late_penalty',
                    'other_deductions',
                ] as $column) {
                    if (! Schema::hasColumn('payroll_entries', $column)) {
                        $table->decimal($column, 10, 2)->default(0);
                    }
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('employees')) {
            Schema::table('employees', function (Blueprint $table) {
                foreach (['cnic', 'overtime_rate'] as $column) {
                    if (Schema::hasColumn('employees', $column)) {
                        $table->dropColumn($column);
                    }
                }
            });
        }

        if (Schema::hasTable('attendance_records')) {
            Schema::table('attendance_records', function (Blueprint $table) {
                foreach (['on_duty', 'off_duty', 'late_minutes', 'early_leave_minutes', 'work_time'] as $column) {
                    if (Schema::hasColumn('attendance_records', $column)) {
                        $table->dropColumn($column);
                    }
                }
            });
        }

        if (Schema::hasTable('payroll_entries')) {
            Schema::table('payroll_entries', function (Blueprint $table) {
                foreach (['bonus_amount', 'advance_deduction', 'absence_deduction', 'late_penalty', 'other_deductions'] as $column) {
                    if (Schema::hasColumn('payroll_entries', $column)) {
                        $table->dropColumn($column);
                    }
                }
            });
        }
    }
};
