<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('employees', fn (Blueprint $table) => $table->boolean('field_attendance')->default(false));
        Schema::create('field_attendance_captures', function (Blueprint $table) {
            $table->id();
            $table->foreignId('attendance_record_id')->constrained('attendance_records')->cascadeOnDelete();
            $table->string('type', 10);
            $table->string('selfie_path');
            $table->string('area_path');
            $table->decimal('latitude', 10, 7);
            $table->decimal('longitude', 10, 7);
            $table->unsignedInteger('accuracy');
            $table->timestamp('captured_at');
            $table->timestamps();
            $table->unique(['attendance_record_id', 'type']);
        });
    }
    public function down(): void
    {
        Schema::dropIfExists('field_attendance_captures');
        Schema::table('employees', fn (Blueprint $table) => $table->dropColumn('field_attendance'));
    }
};
