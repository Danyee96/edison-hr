<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employee_bonuses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained('users')->onDelete('cascade');
            $table->enum('bonus_type', ['performance', 'eid', 'annual', 'custom'])->default('custom');
            $table->decimal('amount', 12, 2);
            $table->date('bonus_date');
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->constrained('users')->onDelete('cascade');
            $table->timestamps();

            $table->index(['employee_id', 'bonus_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_bonuses');
    }
};
