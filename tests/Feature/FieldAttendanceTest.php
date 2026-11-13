<?php

use App\Models\AttendanceRecord;
use App\Models\Employee;
use App\Models\User;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    $this->withoutMiddleware([\App\Http\Middleware\CheckPlanAccess::class]);
    Storage::fake('local');
    $this->company = User::factory()->create(['type' => 'company']);
    $this->employeeUser = User::factory()->create(['type' => 'employee', 'created_by' => $this->company->id]);
    $this->employee = Employee::create(['user_id' => $this->employeeUser->id, 'employee_id' => 'TEST-100', 'created_by' => $this->company->id, 'field_attendance' => true]);
    $this->employee->field_attendance = true;
    $this->employee->save();
    $image = imagecreatetruecolor(10, 10);
    ob_start(); imagejpeg($image); $this->photo = 'data:image/jpeg;base64,'.base64_encode(ob_get_clean()); imagedestroy($image);
    $this->actingAs($this->employeeUser);
});

test('field check in and out require both photos and location and update attendance', function () {
    $attempt = $this->postJson(route('hr.field-attendance.start'), ['type'=>'in'])->assertOk()->json('token');
    $payload = ['attempt_token'=>$attempt, 'type'=>'in', 'selfie'=>$this->photo, 'area'=>$this->photo, 'latitude'=>31.5, 'longitude'=>74.3, 'accuracy'=>10];
    $this->post(route('hr.field-attendance.capture'), array_diff_key($payload, ['area'=>true]))->assertSessionHasErrors('area');
    expect(AttendanceRecord::count())->toBe(0);
    session()->forget('errors');
    $this->post(route('hr.field-attendance.capture'), $payload)->assertSessionHasNoErrors();
    $record = AttendanceRecord::firstOrFail();
    expect($record->clock_in)->not->toBeNull();
    $this->assertDatabaseCount('field_attendance_captures', 1);
    $attempt = $this->postJson(route('hr.field-attendance.start'), ['type'=>'in'])->assertOk()->json('token');
    $payload['attempt_token'] = $attempt;
    $this->post(route('hr.field-attendance.capture'), $payload)->assertSessionHasErrors('type');
    session()->forget('errors');
    $outAttempt = $this->postJson(route('hr.field-attendance.start'), ['type'=>'out'])->assertOk()->json('token');
    $this->post(route('hr.field-attendance.capture'), [...$payload, 'attempt_token'=>$outAttempt, 'type'=>'out'])->assertSessionHasNoErrors();
    expect($record->fresh()->clock_out)->not->toBeNull();
    $this->assertDatabaseCount('field_attendance_captures', 2);
    expect(Storage::disk('local')->allFiles('field-attendance'))->toHaveCount(4);
});

test('ordinary clock in cannot bypass field attendance', function () {
    $this->post(route('hr.attendance.clock-in'), ['employee_id'=>$this->employeeUser->id])->assertForbidden();
});



test('an expired attempt cannot record attendance and must be restarted', function () {
    $attempt = $this->postJson(route('hr.field-attendance.start'), ['type'=>'in'])->assertOk()->json('token');
    $this->travel(121)->seconds();
    $payload = ['attempt_token'=>$attempt, 'type'=>'in', 'selfie'=>$this->photo, 'area'=>$this->photo, 'latitude'=>31.5, 'longitude'=>74.3, 'accuracy'=>10];
    $this->post(route('hr.field-attendance.capture'), $payload)->assertSessionHasErrors('attempt');
    expect(AttendanceRecord::count())->toBe(0);
    session()->forget('errors');
    $replacement = $this->postJson(route('hr.field-attendance.start'), ['type'=>'in'])->assertOk()->json('token');
    expect($replacement)->not->toBe($attempt);
    $this->post(route('hr.field-attendance.capture'), [...$payload, 'attempt_token'=>$replacement])->assertSessionHasNoErrors();
    expect(AttendanceRecord::count())->toBe(1);
});
