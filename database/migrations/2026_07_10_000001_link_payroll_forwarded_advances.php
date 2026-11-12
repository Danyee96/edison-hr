<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('advance_salaries')) {
            return;
        }

        Schema::table('advance_salaries', function (Blueprint $table) {
            if (! Schema::hasColumn('advance_salaries', 'payroll_run_id')) {
                $table->foreignId('payroll_run_id')
                    ->nullable()
                    ->after('employee_id')
                    ->constrained('payroll_runs')
                    ->nullOnDelete();
            }

            if (! Schema::hasColumn('advance_salaries', 'payroll_entry_id')) {
                $table->foreignId('payroll_entry_id')
                    ->nullable()
                    ->after('payroll_run_id')
                    ->constrained('payroll_entries')
                    ->nullOnDelete();
            }
        });

        if (! $this->indexExists('advance_salaries_payroll_forward_unique')) {
            Schema::table('advance_salaries', function (Blueprint $table) {
                $table->unique(['payroll_run_id', 'employee_id'], 'advance_salaries_payroll_forward_unique');
            });
        }
    }

    public function down(): void
    {
        // Keep the payroll-forward relationship so generated advances remain traceable.
    }

    private function indexExists(string $indexName): bool
    {
        $driver = DB::connection()->getDriverName();

        if ($driver === 'mysql') {
            return ! empty(DB::select('SHOW INDEX FROM advance_salaries WHERE Key_name = ?', [$indexName]));
        }

        if ($driver === 'pgsql') {
            return ! empty(DB::select('select 1 from pg_indexes where tablename = ? and indexname = ? limit 1', ['advance_salaries', $indexName]));
        }

        if ($driver === 'sqlite') {
            return collect(DB::select('PRAGMA index_list(advance_salaries)'))
                ->contains(fn ($index) => ($index->name ?? null) === $indexName);
        }

        return false;
    }
};
