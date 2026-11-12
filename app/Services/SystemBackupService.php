<?php

namespace App\Services;

use Carbon\Carbon;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use RuntimeException;

class SystemBackupService
{
    private const FORMAT = 'hrm-system-backup-v1';

    public function list(): array
    {
        $this->ensureDirectory();

        return collect(File::files($this->directory()))
            ->filter(fn ($file) => $file->getExtension() === 'json')
            ->map(fn ($file) => $this->summary($file->getPathname()))
            ->filter()
            ->sortByDesc('created_at')
            ->values()
            ->all();
    }

    public function create(?string $name = null, string $source = 'manual'): array
    {
        $this->ensureDirectory();

        $createdAt = now();
        $id = (string) Str::uuid();
        $tables = $this->tables();
        $payload = [
            'format' => self::FORMAT,
            'id' => $id,
            'name' => $this->cleanName($name ?: 'System Backup '.$createdAt->format('Y-m-d H:i')),
            'source' => $source,
            'created_at' => $createdAt->toIso8601String(),
            'database' => DB::connection()->getDriverName(),
            'tables' => [],
        ];

        foreach ($tables as $table) {
            $rows = DB::table($table)->get()->map(fn ($row) => (array) $row)->all();
            $payload['tables'][$table] = [
                'count' => count($rows),
                'rows' => $rows,
            ];
        }

        File::put($this->path($id), json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        return $this->summary($this->path($id));
    }

    public function upload(UploadedFile $file): array
    {
        $this->ensureDirectory();

        $payload = $this->readPayload($file->getRealPath());
        $id = (string) Str::uuid();
        $payload['id'] = $id;
        $payload['name'] = $this->cleanName($payload['name'] ?? pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME));
        $payload['uploaded_at'] = now()->toIso8601String();

        File::put($this->path($id), json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        return $this->summary($this->path($id));
    }

    public function rename(string $id, string $name): array
    {
        $path = $this->existingPath($id);
        $payload = $this->readPayload($path);
        $payload['name'] = $this->cleanName($name);
        $payload['renamed_at'] = now()->toIso8601String();

        File::put($path, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        return $this->summary($path);
    }

    public function restore(string $id): void
    {
        $payload = $this->readPayload($this->existingPath($id));
        $tables = $payload['tables'] ?? [];

        if (! is_array($tables) || empty($tables)) {
            throw new RuntimeException(__('The selected backup does not contain any table data.'));
        }

        $existingTables = collect($this->tables())->flip();
        $driver = DB::connection()->getDriverName();

        DB::beginTransaction();
        try {
            $this->disableForeignKeys($driver);

            foreach ($tables as $table => $data) {
                if (! $existingTables->has($table)) {
                    continue;
                }

                $this->clearTable($driver, $table);
                $rows = $data['rows'] ?? [];

                foreach (array_chunk($rows, 500) as $chunk) {
                    if (! empty($chunk)) {
                        DB::table($table)->insert($chunk);
                    }
                }
            }

            $this->enableForeignKeys($driver);
            DB::commit();
        } catch (\Throwable $e) {
            $this->enableForeignKeys($driver);
            DB::rollBack();
            throw $e;
        }
    }

    public function delete(string $id): void
    {
        File::delete($this->existingPath($id));
    }

    public function downloadPath(string $id): string
    {
        return $this->existingPath($id);
    }

    private function summary(string $path): ?array
    {
        try {
            $payload = $this->readPayload($path);
        } catch (\Throwable) {
            return null;
        }

        $tableCount = count($payload['tables'] ?? []);
        $rowCount = collect($payload['tables'] ?? [])->sum(fn ($table) => (int) ($table['count'] ?? count($table['rows'] ?? [])));

        return [
            'id' => $payload['id'] ?? basename($path, '.json'),
            'name' => $payload['name'] ?? basename($path, '.json'),
            'created_at' => $payload['created_at'] ?? Carbon::createFromTimestamp(File::lastModified($path))->toIso8601String(),
            'uploaded_at' => $payload['uploaded_at'] ?? null,
            'source' => $payload['source'] ?? (($payload['uploaded_at'] ?? null) ? 'uploaded' : 'manual'),
            'size' => File::size($path),
            'tables' => $tableCount,
            'rows' => $rowCount,
        ];
    }

    private function readPayload(?string $path): array
    {
        if (! $path || ! is_file($path)) {
            throw new RuntimeException(__('Backup file could not be read.'));
        }

        $payload = json_decode((string) File::get($path), true);
        if (! is_array($payload) || ($payload['format'] ?? null) !== self::FORMAT) {
            throw new RuntimeException(__('This is not a valid system backup file.'));
        }

        return $payload;
    }

    private function tables(): array
    {
        $driver = DB::connection()->getDriverName();

        if ($driver === 'mysql') {
            return collect(DB::select('SHOW FULL TABLES'))
                ->filter(function ($row) {
                    $values = array_values((array) $row);

                    return ($values[1] ?? 'BASE TABLE') === 'BASE TABLE';
                })
                ->map(fn ($row) => array_values((array) $row)[0])
                ->values()
                ->all();
        }

        if ($driver === 'sqlite') {
            return collect(DB::select("select name from sqlite_master where type = 'table' and name not like 'sqlite_%'"))
                ->pluck('name')
                ->values()
                ->all();
        }

        if ($driver === 'pgsql') {
            return collect(DB::select("select tablename from pg_tables where schemaname = 'public'"))
                ->pluck('tablename')
                ->values()
                ->all();
        }

        throw new RuntimeException(__('Database backups are not supported for this database driver.'));
    }

    private function clearTable(string $driver, string $table): void
    {
        DB::table($table)->delete();
    }

    private function disableForeignKeys(string $driver): void
    {
        match ($driver) {
            'mysql' => DB::statement('SET FOREIGN_KEY_CHECKS=0'),
            'sqlite' => DB::statement('PRAGMA foreign_keys = OFF'),
            'pgsql' => DB::statement('SET CONSTRAINTS ALL DEFERRED'),
            default => null,
        };
    }

    private function enableForeignKeys(string $driver): void
    {
        match ($driver) {
            'mysql' => DB::statement('SET FOREIGN_KEY_CHECKS=1'),
            'sqlite' => DB::statement('PRAGMA foreign_keys = ON'),
            default => null,
        };
    }

    private function existingPath(string $id): string
    {
        $path = $this->path($id);
        if (! is_file($path)) {
            throw new RuntimeException(__('Backup not found.'));
        }

        return $path;
    }

    private function cleanName(?string $name): string
    {
        $name = trim((string) $name);

        return $name !== '' ? Str::limit($name, 120, '') : 'System Backup';
    }

    private function path(string $id): string
    {
        return $this->directory().DIRECTORY_SEPARATOR.basename($id, '.json').'.json';
    }

    private function directory(): string
    {
        return storage_path('app/system-backups');
    }

    private function ensureDirectory(): void
    {
        File::ensureDirectoryExists($this->directory());
    }
}
