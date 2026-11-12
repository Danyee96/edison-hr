<?php

namespace App\Console\Commands;

use App\Services\SystemBackupService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class CreateAutomaticSystemBackup extends Command
{
    protected $signature = 'system-backups:auto';

    protected $description = 'Create an automatic system backup.';

    public function handle(SystemBackupService $backups): int
    {
        $createdAt = now();

        try {
            $backup = $backups->create('Auto Backup '.$createdAt->format('Y-m-d H:i'), 'auto');
        } catch (\Throwable $e) {
            Log::error('Automatic system backup failed.', [
                'error' => $e->getMessage(),
            ]);

            $this->error('Automatic system backup failed: '.$e->getMessage());

            return self::FAILURE;
        }

        Log::info('Automatic system backup created.', [
            'id' => $backup['id'] ?? null,
            'tables' => $backup['tables'] ?? null,
            'rows' => $backup['rows'] ?? null,
            'size' => $backup['size'] ?? null,
        ]);

        $this->info(sprintf(
            'Automatic system backup created: %s (%s tables, %s rows, %s bytes).',
            $backup['id'] ?? 'unknown',
            number_format((int) ($backup['tables'] ?? 0)),
            number_format((int) ($backup['rows'] ?? 0)),
            number_format((int) ($backup['size'] ?? 0)),
        ));

        return self::SUCCESS;
    }
}
