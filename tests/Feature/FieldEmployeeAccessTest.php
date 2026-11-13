<?php

use App\Models\AttendanceRecord;
use App\Models\Employee;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $company = User::factory()->create(['type'=>'company']);
    $this->fieldUser = User::factory()->create(['type'=>'employee', 'created_by'=>$company->id]);
    $employee = Employee::create(['user_id'=>$this->fieldUser->id, 'created_by'=>$company->id, 'employee_id'=>'FIELD-900', 'employee_status'=>'active']);
    $employee->field_attendance = true;
    $employee->save();
    $this->actingAs($this->fieldUser);
});

test('field employee can open their attendance but cannot access management pages', function () {
    $this->get(route('dashboard'))->assertOk()->assertInertia(fn (Assert $page) => $page->component('field-employee-dashboard')->where('mode', 'today'));
    $this->get(route('hr.field-attendance.my'))->assertOk()->assertInertia(fn (Assert $page) => $page->component('field-employee-dashboard')->where('mode', 'monthly'));
    $this->get(route('users.index'))->assertRedirect(route('dashboard'));
    $this->post(route('hr.attendance.clock-in'), ['employee_id'=>$this->fieldUser->id])->assertForbidden();
});

test('monthly report only includes the signed in employee records', function () {
    $other = User::factory()->create(['type'=>'employee']);
    AttendanceRecord::create(['employee_id'=>$this->fieldUser->id, 'created_by'=>$this->fieldUser->created_by, 'date'=>'2026-11-01', 'status'=>'present', 'clock_in'=>'09:00']);
    AttendanceRecord::create(['employee_id'=>$other->id, 'created_by'=>$other->id, 'date'=>'2026-11-02', 'status'=>'present', 'clock_in'=>'10:00']);
    $this->get(route('hr.field-attendance.my', ['month'=>'2026-11']))->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('field-employee-dashboard')->has('records', 1)->where('records.0.date', '2026-11-01'));
});


test('today shows the assigned shift or indicates no shift is assigned', function () {
    $this->get(route('dashboard'))->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('field-employee-dashboard')->where('shift', null)->has('serverTime')->has('timezone'));

    $shift = \App\Models\Shift::create(['name'=>'Morning', 'start_time'=>'09:00', 'end_time'=>'18:00', 'status'=>'active', 'created_by'=>$this->fieldUser->created_by]);
    $this->fieldUser->employee->shift_id = $shift->id;
    $this->fieldUser->employee->save();
    $this->fieldUser->unsetRelation('employee');
    $this->get(route('dashboard'))->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('field-employee-dashboard')->where('shift.name', 'Morning')->where('shift.start_time', '09:00')->where('shift.end_time', '18:00'));
});
