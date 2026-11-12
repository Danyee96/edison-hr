<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('employees') || ! Schema::hasColumn('employees', 'employee_id')) {
            return;
        }

        $duplicates = DB::table('employees')
            ->select('employee_id', DB::raw('COUNT(*) as duplicate_count'))
            ->whereNotNull('employee_id')
            ->groupBy('employee_id')
            ->havingRaw('COUNT(*) > 1')
            ->pluck('duplicate_count', 'employee_id');

        if ($duplicates->isNotEmpty()) {
            $sample = $duplicates
                ->take(10)
                ->map(fn ($count, $employeeId) => "{$employeeId} ({$count})")
                ->implode(', ');

            throw new RuntimeException("Duplicate employee IDs must be resolved before adding the unique index: {$sample}");
        }

        if ($this->employeeIdUniqueIndexExists()) {
            return;
        }

        Schema::table('employees', function (Blueprint $table) {
            $table->unique('employee_id', 'employees_employee_id_unique');
        });
    }

    public function down(): void
    {
        // Keep the uniqueness guarantee in place.
    }

    private function employeeIdUniqueIndexExists(): bool
    {
        $driver = DB::connection()->getDriverName();

        if ($driver === 'mysql') {
            $indexes = collect(DB::select('SHOW INDEX FROM employees WHERE Non_unique = 0'))
                ->groupBy('Key_name')
                ->map(fn ($columns) => $columns
                    ->sortBy('Seq_in_index')
                    ->pluck('Column_name')
                    ->values()
                    ->all());

            return $indexes->contains(fn ($columns) => $columns === ['employee_id']);
        }

        if ($driver === 'pgsql') {
            return ! empty(DB::select(
                "select 1
                 from pg_index i
                 join pg_class t on t.oid = i.indrelid
                 join lateral unnest(i.indkey) with ordinality as indexed_columns(attnum, position) on true
                 join pg_attribute a on a.attrelid = t.oid and a.attnum = indexed_columns.attnum
                 where t.relname = 'employees'
                   and i.indisunique = true
                 group by i.indexrelid
                 having count(*) = 1 and max(a.attname) = 'employee_id'
                 limit 1"
            ));
        }

        if ($driver === 'sqlite') {
            foreach (DB::select('PRAGMA index_list(employees)') as $index) {
                if (! (bool) ($index->unique ?? false)) {
                    continue;
                }

                $columns = collect(DB::select("PRAGMA index_info({$index->name})"))
                    ->sortBy('seqno')
                    ->pluck('name')
                    ->values()
                    ->all();

                if ($columns === ['employee_id']) {
                    return true;
                }
            }
        }

        return false;
    }
};
