<?php

namespace App\Http\Controllers;

use App\Models\AttendanceRecord;
use App\Models\Employee;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;

class FieldAttendanceController extends Controller
{
    public function personal(Request $request)
    {
        $user = $request->user();
        abort_unless($user->type === 'employee' && $user->employee?->field_attendance, 403);
        $request->validate(['month' => 'nullable|date_format:Y-m']);
        $month = $request->input('month', now()->format('Y-m'));
        $start = Carbon::createFromFormat('!Y-m', $month);
        $records = AttendanceRecord::where('employee_id', $user->id)
            ->whereBetween('date', [$start->copy()->startOfMonth(), $start->copy()->endOfMonth()])
            ->orderBy('date')->get(['id', 'date', 'status', 'clock_in', 'clock_out', 'total_hours']);
        $today = AttendanceRecord::where('employee_id', $user->id)->whereDate('date', today())->first();
        $open = AttendanceRecord::where('employee_id', $user->id)->whereNotNull('clock_in')->whereNull('clock_out')
            ->whereExists(fn ($q) => $q->selectRaw('1')->from('field_attendance_captures')->whereColumn('field_attendance_captures.attendance_record_id', 'attendance_records.id')->where('field_attendance_captures.type', 'in'))
            ->orderByDesc('date')->first();
        return Inertia::render('field-employee-dashboard', [
            'mode' => $request->routeIs('hr.field-attendance.my') ? 'monthly' : 'today',
            'month' => $month,
            'records' => $records->map(fn ($r) => ['date'=>$r->date->toDateString(), 'status'=>$r->status, 'clock_in'=>$r->clock_in, 'clock_out'=>$r->clock_out, 'total_hours'=>$r->total_hours]),
            'todayAttendance' => $user->employee->field_attendance_test_mode ? $today : ($open ?? $today),
            'employeeName' => $user->name,
            'testMode' => (bool) $user->employee->field_attendance_test_mode,
            'serverTime' => now()->toIso8601String(),
            'timezone' => config('app.timezone', 'UTC'),
            'workingDays' => collect(app(\App\Services\WorkingScheduleService::class)->schedule())
                ->filter(fn ($day) => $day['enabled'])->keys()->map(fn ($day) => ucfirst($day))->values(),
            'shift' => $user->employee->shift ? [
                'name' => $user->employee->shift->name,
                'start_time' => $user->employee->shift->start_time,
                'end_time' => $user->employee->shift->end_time,
                'is_night_shift' => (bool) $user->employee->shift->is_night_shift,
            ] : null,
        ]);
    }

    private function admin(): void
    {
        abort_unless(auth()->user()->can('manage-attendance-records') && auth()->user()->can('manage-any-attendance-records'), 403);
    }

    public function index(Request $request)
    {
        $this->admin();
        $request->validate(['month' => 'nullable|date_format:Y-m', 'employee_id' => 'nullable|integer']);
        $employees = Employee::with(['user:id,name,email', 'department:id,name'])
            ->whereIn('created_by', getCompanyAndUsersId())->whereHas('user')->orderBy('employee_id')->get();
        $fieldEmployees = $employees->filter(fn ($employee) => (bool) $employee->field_attendance)
            ->sortBy(fn ($employee) => $employee->employee_id_display, SORT_NATURAL | SORT_FLAG_CASE)->values();
        $selected = $fieldEmployees->firstWhere('user_id', (int) $request->employee_id) ?? $fieldEmployees->first();
        $month = $request->input('month', now()->format('Y-m'));
        $view = $selected ? app(AttendanceRecordController::class)->attendanceViewData(
            $request,
            $fieldEmployees->map(fn ($employee) => [
                'id' => $employee->user_id, 'name' => $employee->user->name,
                'employee_id' => $employee->employee_id_display, 'department_name' => $employee->department?->name ?? '',
            ]),
            $selected->user_id,
        ) : ['days' => collect(), 'analytics' => []];
        $captures = DB::table('field_attendance_captures')->whereIn('attendance_record_id', $view['days']->pluck('id')->filter())->get()->groupBy('attendance_record_id');
        $days = $view['days']->map(function ($day) use ($captures) {
            $day['captures'] = ($captures[$day['id']] ?? collect())->map(fn ($capture) => [
                'id' => $capture->id, 'type' => $capture->type, 'latitude' => $capture->latitude,
                'longitude' => $capture->longitude, 'accuracy' => $capture->accuracy, 'captured_at' => $capture->captured_at,
            ])->values();
            return $day;
        });
        return Inertia::render('hr/field-attendance/index', [
            'employees' => $employees->map(fn ($e) => ['id'=>$e->id, 'user_id'=>$e->user_id, 'name'=>$e->user->name, 'email'=>$e->user->email, 'employee_id'=>$e->employee_id_display, 'department'=>$e->department?->name, 'field_attendance'=>(bool)$e->field_attendance]),
            'selectedEmployee' => $selected?->user_id, 'month' => $month,
            'attendanceDays' => $days, 'attendanceAnalytics' => $view['analytics'],
        ]);
    }

    public function updateEmployee(Request $request, Employee $employee)
    {
        $this->admin();
        abort_unless(in_array($employee->created_by, getCompanyAndUsersId()), 404);
        $data = $request->validate(['field_attendance'=>'required|boolean']);
        $employee->field_attendance = $data['field_attendance'];
        $employee->save();
        return back()->with('success', __('Attendance type updated.'));
    }

    public function updateLogin(Request $request, Employee $employee)
    {
        $this->admin();
        abort_unless($request->user()->can('edit-employees'), 403);
        abort_unless(in_array($employee->created_by, getCompanyAndUsersId()), 404);
        $user = $employee->user()->firstOrFail();
        $data = $request->validate([
            'email' => ['required', 'email', 'max:255', \Illuminate\Validation\Rule::unique('users', 'email')->ignore($user->id)],
            'password' => 'nullable|string|min:8|confirmed',
        ]);
        $user->email = $data['email'];
        if (!empty($data['password'])) $user->password = \Illuminate\Support\Facades\Hash::make($data['password']);
        $user->save();
        return back()->with('success', __('Employee login updated.'));
    }

    public function startAttempt(Request $request)
    {
        abort_unless($request->user()->type === 'employee' && $request->user()->employee?->field_attendance, 403);
        $data = $request->validate(['type' => 'required|in:in,out']);
        $token = Str::random(48);
        $request->session()->put('field_attendance_attempt', [
            'token' => $token, 'user_id' => $request->user()->id,
            'type' => $data['type'], 'expires_at' => now()->timestamp + 120,
        ]);
        return response()->json(['token' => $token, 'seconds' => 120]);
    }

    public function capture(Request $request)
    {
        $user = $request->user();
        $employee = Employee::where('user_id', $user->id)->where('field_attendance', true)->firstOrFail();
        $data = $request->validate([
            'attempt_token'=>'required|string', 'type'=>'required|in:in,out', 'selfie'=>'required|string|max:6000000', 'area'=>'required|string|max:6000000',
            'latitude'=>'required|numeric|between:-90,90', 'longitude'=>'required|numeric|between:-180,180', 'accuracy'=>'required|numeric|min:0|max:100000',
        ]);
        $attempt = $request->session()->get('field_attendance_attempt');
        if (!is_array($attempt) || ($attempt['user_id'] ?? null) !== $user->id || ($attempt['type'] ?? null) !== $data['type']
            || !hash_equals((string) ($attempt['token'] ?? ''), $data['attempt_token']) || now()->timestamp >= ($attempt['expires_at'] ?? 0)) {
            return back()->withErrors(['attempt' => 'This attempt has expired. Please start again.']);
        }
        $images = [];
        foreach (['selfie', 'area'] as $name) {
            if (!preg_match('/^data:image\/jpeg;base64,([A-Za-z0-9+\/=]+)$/', $data[$name], $match) || !($bytes = base64_decode($match[1], true)) || strlen($bytes) > 4000000 || (getimagesizefromstring($bytes)['mime'] ?? '') !== 'image/jpeg') {
                return back()->withErrors([$name => 'Please capture a valid camera photo.']);
            }
            $images[$name] = $bytes;
        }
        $paths = [];
        $replacedPaths = [];
        try {
            DB::transaction(function () use ($user, $employee, $data, $images, $attempt, &$paths, &$replacedPaths) {
                User::whereKey($user->id)->lockForUpdate()->firstOrFail();
                if (now()->timestamp >= $attempt['expires_at']) throw \Illuminate\Validation\ValidationException::withMessages(['attempt'=>'This attempt has expired. Please start again.']);
                $now = Carbon::now(settings()['defaultTimezone'] ?? 'Asia/Karachi');
                $record = AttendanceRecord::where('employee_id', $user->id)->whereDate('date', $now->toDateString())->lockForUpdate()->first();
                if ($data['type'] === 'in') {
                    $openField = AttendanceRecord::where('employee_id', $user->id)->whereNotNull('clock_in')->whereNull('clock_out')->whereExists(fn ($q) => $q->selectRaw('1')->from('field_attendance_captures')->whereColumn('field_attendance_captures.attendance_record_id', 'attendance_records.id')->where('field_attendance_captures.type', 'in'))->exists();
                    if ($openField && !$employee->field_attendance_test_mode) throw \Illuminate\Validation\ValidationException::withMessages(['type'=>'Please check out of your previous attendance first.']);
                    if ($record && $record->clock_in && !$employee->field_attendance_test_mode) throw \Illuminate\Validation\ValidationException::withMessages(['type'=>'Already checked in today.']);
                    $record ??= new AttendanceRecord(['employee_id'=>$user->id, 'date'=>$now->toDateString(), 'created_by'=>$employee->created_by]);
                    if ($employee->field_attendance_test_mode && $record->exists) {
                        $old = DB::table('field_attendance_captures')->where('attendance_record_id', $record->id)->get(['selfie_path', 'area_path']);
                        foreach ($old as $photo) { $replacedPaths[] = $photo->selfie_path; $replacedPaths[] = $photo->area_path; }
                        DB::table('field_attendance_captures')->where('attendance_record_id', $record->id)->delete();
                        $record->fill(['clock_out'=>null, 'total_hours'=>0, 'work_time'=>null, 'overtime_hours'=>0, 'overtime_amount'=>0, 'late_minutes'=>0, 'early_leave_minutes'=>0, 'is_late'=>false, 'is_early_departure'=>false, 'is_absent'=>false]);
                    }
                    $record->fill(['clock_in'=>$now->format('H:i:s'), 'shift_id'=>$employee->shift_id, 'attendance_policy_id'=>$employee->attendance_policy_id, 'status'=>'present']);
                    $record->save();
                    if ($record->shift_id) { $record->checkLateArrival(); $record->save(); }
                } else {
                    if (!$employee->field_attendance_test_mode) {
                        $record = AttendanceRecord::where('employee_id', $user->id)->whereNotNull('clock_in')->whereNull('clock_out')->whereExists(fn ($q) => $q->selectRaw('1')->from('field_attendance_captures')->whereColumn('field_attendance_captures.attendance_record_id', 'attendance_records.id')->where('field_attendance_captures.type', 'in'))->orderByDesc('date')->lockForUpdate()->first();
                    }
                    if (!$record || !$record->clock_in || (!$employee->field_attendance_test_mode && $record->clock_out) || !DB::table('field_attendance_captures')->where('attendance_record_id', $record->id)->where('type','in')->exists()) throw \Illuminate\Validation\ValidationException::withMessages(['type'=>'A field check-in is required before check-out.']);
                    if ($employee->field_attendance_test_mode) {
                        $old = DB::table('field_attendance_captures')->where('attendance_record_id', $record->id)->where('type', 'out')->get(['selfie_path', 'area_path']);
                        foreach ($old as $photo) { $replacedPaths[] = $photo->selfie_path; $replacedPaths[] = $photo->area_path; }
                        DB::table('field_attendance_captures')->where('attendance_record_id', $record->id)->where('type', 'out')->delete();
                    }
                    $record->clock_out = $now->format('H:i:s');
                    $record->processAttendance();
                }
                foreach ($images as $name => $bytes) {
                    $path = 'field-attendance/'.Str::uuid().'.jpg';
                    if (!Storage::disk('local')->put($path, $bytes)) throw new \RuntimeException('Could not save photo.');
                    $paths[] = $path;
                }
                DB::table('field_attendance_captures')->insert(['attendance_record_id'=>$record->id, 'type'=>$data['type'], 'selfie_path'=>$paths[0], 'area_path'=>$paths[1], 'latitude'=>$data['latitude'], 'longitude'=>$data['longitude'], 'accuracy'=>(int)round($data['accuracy']), 'captured_at'=>now(), 'created_at'=>now(), 'updated_at'=>now()]);
            });
        } catch (\Throwable $e) {
            foreach ($paths as $path) Storage::disk('local')->delete($path);
            throw $e;
        }
        foreach ($replacedPaths as $path) Storage::disk('local')->delete($path);
        $request->session()->forget('field_attendance_attempt');
        return back()->with('success', __('Field attendance recorded.'));
    }

    public function photo(int $capture, string $kind)
    {
        $this->admin();
        abort_unless(in_array($kind, ['selfie','area'], true), 404);
        $row = DB::table('field_attendance_captures as c')->join('attendance_records as a','a.id','=','c.attendance_record_id')->where('c.id',$capture)->whereIn('a.created_by',getCompanyAndUsersId())->select('c.selfie_path','c.area_path')->first();
        abort_unless($row, 404);
        $path = $kind === 'selfie' ? $row->selfie_path : $row->area_path;
        abort_unless(Storage::disk('local')->exists($path), 404);
        return response()->file(Storage::disk('local')->path($path), ['Cache-Control'=>'private, no-store', 'X-Content-Type-Options'=>'nosniff']);
    }
}
