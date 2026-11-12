<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;

class AttendanceImportLog extends BaseModel
{
    use HasFactory;

    protected $fillable = [
        'file_name',
        'total_rows',
        'imported_rows',
        'skipped_rows',
        'created_employees',
        'errors',
        'created_by',
    ];

    protected $casts = [
        'errors' => 'array',
    ];

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
