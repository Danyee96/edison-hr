<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('advance_salaries', function (Blueprint $table) {
            if (! Schema::hasColumn('advance_salaries', 'receipt_token')) {
                $table->string('receipt_token', 16)->nullable()->unique()->after('notes');
            }
        });
    }

    public function down(): void
    {
        Schema::table('advance_salaries', function (Blueprint $table) {
            if (Schema::hasColumn('advance_salaries', 'receipt_token')) {
                $table->dropUnique(['receipt_token']);
                $table->dropColumn('receipt_token');
            }
        });
    }
};
