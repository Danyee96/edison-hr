<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('users')) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'referral_code')) {
                $table->string('referral_code')->nullable()->change();
            }

            if (Schema::hasColumn('users', 'used_referral_code')) {
                $table->string('used_referral_code')->nullable()->change();
            }
        });
    }

    public function down(): void
    {
        // Keep referral codes as strings. Existing values may include prefixes like REF.
    }
};
