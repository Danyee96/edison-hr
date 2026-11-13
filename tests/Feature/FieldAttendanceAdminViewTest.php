<?php

use App\Models\AttendanceRecord;
use App\Models\Employee;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;

beforeEach(function () {
    $this->withoutMiddleware(\App\Http\Middleware\CheckPlanAccess::class);
    $this->company = User::factory()->create(['type'=>'company']);
    foreach (['manage-attendance-records', 'manage-any-attendance-records'] as $name) $this->company->givePermissionTo(Permission::findOrCreate($name, 'web'));
    $this->fieldUser = User::factory()->create(['type'=>'employee','created_by'=>$this->company->id]);
    $employee = Employee::create(['user_id'=>$this->fieldUser->id,'created_by'=>$this->company->id,'employee_id'=>'FIELD-123','employee_status'=>'active']);
    $employee->field_attendance = true; $employee->save();
    $this->actingAs($this->company);
});

test('field view uses regular attendance calculations and includes capture details', function () {
    $record = AttendanceRecord::create(['employee_id'=>$this->fieldUser->id, 'created_by'=>$this->company->id, 'date'=>'2026-11-02', 'status'=>'present', 'clock_in'=>'09:00']);
    \Illuminate\Support\Facades\DB::table('field_attendance_captures')->insert(['attendance_record_id'=>$record->id,'type'=>'in','selfie_path'=>'private-selfie','area_path'=>'private-area','latitude'=>31.5,'longitude'=>74.3,'accuracy'=>20,'captured_at'=>now(),'created_at'=>now(),'updated_at'=>now()]);
    $this->get(route('hr.field-attendance.index', ['employee_id'=>$this->fieldUser->id, 'month'=>'2026-11']))->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('hr/field-attendance/index')->where('selectedEmployee', $this->fieldUser->id)->where('attendanceAnalytics.present', 1)->has('attendanceDays', 30)->where('attendanceDays.1.status', 'present')->has('attendanceDays.1.captures', 1)->where('attendanceDays.1.captures.0.type', 'in')->missing('attendanceDays.1.captures.0.selfie_path'));
});

test('field view does not select an employee outside the company', function () {
    $other = User::factory()->create(['type'=>'employee']);
    $this->get(route('hr.field-attendance.index', ['employee_id'=>$other->id, 'month'=>'2026-11']))->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('selectedEmployee', $this->fieldUser->id));
});
