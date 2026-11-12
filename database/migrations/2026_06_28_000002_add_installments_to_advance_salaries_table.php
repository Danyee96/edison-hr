<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('advance_salaries', function (Blueprint $table) {
            $table->enum('repayment_type', ['full', 'installment'])->default('full')->after('deducted_amount');
            $table->enum('repayment_source', ['salary', 'bonus'])->default('salary')->after('repayment_type');
            $table->unsignedSmallInteger('installment_months')->nullable()->after('repayment_source');
            $table->decimal('monthly_installment_amount', 12, 2)->nullable()->after('installment_months');
            $table->date('installment_start_date')->nullable()->after('monthly_installment_amount');

            $table->index(['repayment_type', 'installment_start_date']);
        });
    }

    public function down(): void
    {
        Schema::table('advance_salaries', function (Blueprint $table) {
            $table->dropIndex(['repayment_type', 'installment_start_date']);
            $table->dropColumn([
                'repayment_type',
                'repayment_source',
                'installment_months',
                'monthly_installment_amount',
                'installment_start_date',
            ]);
        });
    }
};
