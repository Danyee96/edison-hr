<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    private function supportsForeignKeyLookup(): bool
    {
        return in_array(DB::getDriverName(), ['mysql', 'mariadb'], true);
    }

    private function foreignKeyName(string $table, string $column): ?string
    {
        if (! $this->supportsForeignKeyLookup()) {
            return null;
        }

        $foreignKey = DB::select(
            "SELECT CONSTRAINT_NAME FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME LIKE ?",
            [$table, '%'.$column.'%']
        );

        return $foreignKey[0]->CONSTRAINT_NAME ?? null;
    }

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('candidate_onboarding')) {
            $driver = DB::getDriverName();
            $candidateForeignKey = $this->foreignKeyName('candidate_onboarding', 'candidate_id');
            
            if ($candidateForeignKey) {
                DB::statement('ALTER TABLE candidate_onboarding DROP FOREIGN KEY '.$candidateForeignKey);
            }
            
            Schema::table('candidate_onboarding', function (Blueprint $table) use ($driver) {
                // Make candidate_id nullable if column exists
                if ($driver !== 'sqlite' && Schema::hasColumn('candidate_onboarding', 'candidate_id')) {
                    $table->unsignedBigInteger('candidate_id')->nullable()->change();
                }

                // Add employee_id column with foreign key if it doesn't exist
                if (!Schema::hasColumn('candidate_onboarding', 'employee_id')) {
                    $table->unsignedBigInteger('employee_id')->nullable()->after('candidate_id');
                    if ($driver !== 'sqlite') {
                        $table->foreign('employee_id')->references('id')->on('users')->onDelete('cascade');
                    }
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('candidate_onboarding')) {
            $driver = DB::getDriverName();
            $employeeForeignKey = $this->foreignKeyName('candidate_onboarding', 'employee_id');
            
            if ($employeeForeignKey) {
                DB::statement('ALTER TABLE candidate_onboarding DROP FOREIGN KEY '.$employeeForeignKey);
            }
            
            Schema::table('candidate_onboarding', function (Blueprint $table) use ($driver) {
                // Drop employee_id column if it exists
                if (Schema::hasColumn('candidate_onboarding', 'employee_id')) {
                    $table->dropColumn('employee_id');
                }

                // Restore candidate_id foreign key if column exists
                if ($driver !== 'sqlite' && Schema::hasColumn('candidate_onboarding', 'candidate_id')) {
                    $table->unsignedBigInteger('candidate_id')->nullable(false)->change();
                    $table->foreign('candidate_id')->references('id')->on('candidates')->onDelete('cascade');
                }
            });
        }
    }
};
