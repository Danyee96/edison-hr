<?php

namespace App\Http\Controllers;

use App\Services\SystemBackupService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class SystemBackupController extends Controller
{
    public function index(SystemBackupService $backups)
    {
        $this->authorizeAccess();

        return Inertia::render('system-backups/index', [
            'backups' => $backups->list(),
        ]);
    }

    public function store(Request $request, SystemBackupService $backups)
    {
        $this->authorizeAccess();

        $validated = $request->validate([
            'name' => 'nullable|string|max:120',
        ]);

        try {
            $backups->create($validated['name'] ?? null);
        } catch (\Throwable $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }

        return redirect()->back()->with('success', __('Backup created successfully.'));
    }

    public function upload(Request $request, SystemBackupService $backups)
    {
        $this->authorizeAccess();

        $validated = $request->validate([
            'file' => 'required|file|max:102400|mimes:json,txt',
        ]);

        try {
            $backups->upload($validated['file']);
        } catch (\Throwable $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }

        return redirect()->back()->with('success', __('Backup uploaded successfully.'));
    }

    public function rename(Request $request, string $backup, SystemBackupService $backups)
    {
        $this->authorizeAccess();

        $validated = $request->validate([
            'name' => 'required|string|max:120',
        ]);

        try {
            $backups->rename($backup, $validated['name']);
        } catch (\Throwable $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }

        return redirect()->back()->with('success', __('Backup renamed successfully.'));
    }

    public function restore(string $backup, SystemBackupService $backups)
    {
        $this->authorizeAccess();

        try {
            $backups->restore($backup);
        } catch (\Throwable $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }

        return redirect()->route('system-backups.index')->with('success', __('Backup restored successfully.'));
    }

    public function download(string $backup, SystemBackupService $backups)
    {
        $this->authorizeAccess();

        try {
            $path = $backups->downloadPath($backup);
        } catch (\Throwable $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }

        return response()->download($path);
    }

    public function destroy(string $backup, SystemBackupService $backups)
    {
        $this->authorizeAccess();

        try {
            $backups->delete($backup);
        } catch (\Throwable $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }

        return redirect()->back()->with('success', __('Backup deleted successfully.'));
    }

    private function authorizeAccess(): void
    {
        abort_unless(Auth::user()?->can('manage-settings') || Auth::user()?->type === 'superadmin', 403);
    }
}
