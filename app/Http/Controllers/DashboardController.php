<?php

namespace App\Http\Controllers;

use App\Models\Announcement;
use App\Models\AttendanceRecord;
use App\Models\Branch;
use App\Models\Candidate;
use App\Models\Department;
use App\Models\Employee;
use App\Models\JobPosting;
use App\Models\LeaveApplication;
use App\Models\LeaveType;
use App\Models\Meeting;
use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\User;
use App\Models\Plan;
use App\Models\PlanOrder;
use App\Models\PlanRequest;
use App\Models\PayrollRun;
use App\Services\WorkingScheduleService;
use Carbon\Carbon;
use Illuminate\Support\Facades\Schema;


class DashboardController extends Controller
{
    public function index()
    {
        $user = auth()->user();

        if ($user->type === 'employee' && $user->employee?->field_attendance) {
            return app(FieldAttendanceController::class)->personal(request());
        }

        // Super admin always gets dashboard
        if ($user->type === 'superadmin' || $user->type === 'super admin') {
            return $this->renderDashboard();
        }

        // Check if user has dashboard permission (skip if permission doesn't exist)
        try {
            if ($user->hasPermissionTo('manage-dashboard')) {
                return $this->renderDashboard();
            }
        } catch (\Exception $e) {
            // Permission doesn't exist, continue to dashboard for authenticated users
            return $this->renderDashboard();
        }

        // Redirect to first available page
        return $this->redirectToFirstAvailablePage();
    }

    public function redirectToFirstAvailablePage()
    {
        $user = auth()->user();

        // Define available routes with their permissions
        $routes = [
            ['route' => 'users.index', 'permission' => 'manage-users'],
            ['route' => 'roles.index', 'permission' => 'manage-roles'],

            ['route' => 'plans.index', 'permission' => 'manage-plans'],
            ['route' => 'referral.index', 'permission' => 'manage-referral'],
            ['route' => 'settings.index', 'permission' => 'manage-settings'],
        ];

        // Find first available route
        foreach ($routes as $routeData) {
            if ($user->hasPermissionTo($routeData['permission'])) {
                return redirect()->route($routeData['route']);
            }
        }

        // If no permissions found, logout user
        auth()->logout();
        return redirect()->route('login')->with('error', __('No access permissions found.'));
    }

    private function renderDashboard()
    {
        $user = auth()->user();

        if ($user->type === 'superadmin' || $user->type === 'super admin') {
            return $this->renderSuperAdminDashboard();
        } else {
            return $this->renderCompanyDashboard();
        }
    }

    private function renderSuperAdminDashboard()
    {
        // Get system-wide statistics
        $totalCompanies = User::where('type', 'company')->count();
        $totalUsers = User::where('type', '!=', 'superadmin')->where('type', '!=', 'super admin')->count();
        $totalRevenue = Schema::hasTable('plan_orders') && Schema::hasColumn('plan_orders', 'final_price')
            ? (float) PlanOrder::where('status', 'approved')->sum('final_price')
            : 0;
        $activePlans = Schema::hasColumn('plans', 'is_plan_enable')
            ? Plan::where('is_plan_enable', 'on')->count()
            : Plan::count();

        $pendingRequests = PlanRequest::where('status', 'pending')->count();

        // Calculate monthly growth for companies
        $currentMonthCompanies = User::where('type', 'company')
            ->whereMonth('created_at', now()->month)
            ->whereYear('created_at', now()->year)
            ->count();
        $previousMonthCompanies = User::where('type', 'company')
            ->whereMonth('created_at', now()->subMonth()->month)
            ->whereYear('created_at', now()->subMonth()->year)
            ->count();
        $monthlyGrowth = $previousMonthCompanies > 0
            ? round((($currentMonthCompanies - $previousMonthCompanies) / $previousMonthCompanies) * 100, 1)
            : ($currentMonthCompanies > 0 ? 100 : 0);

        $dashboardData = [
            'stats' => [
                'totalCompanies' => $totalCompanies,
                'totalUsers' => $totalUsers,
                'totalRevenue' => $totalRevenue,
                'activePlans' => $activePlans,
                'pendingRequests' => $pendingRequests,
                'monthlyGrowth' => $monthlyGrowth,
            ],
            'recentActivity' => User::where('type', 'company')
                ->orderBy('created_at', 'desc')
                ->take(5)
                ->get(['id', 'name', 'email', 'created_at'])
                ->map(function ($company) {
                    return [
                        'id' => $company->id,
                        'name' => $company->name,
                        'email' => $company->email,
                        'registered_at' => $company->created_at->diffForHumans(),
                        'status' => 'active'
                    ];
                }),
            'topPlans' => Plan::query()
                ->withCount('users')
                ->orderByDesc('users_count')
                ->take(5)
                ->get()
                ->map(function ($plan) {
                    return [
                        'name' => $plan->name,
                        'subscribers' => $plan->users_count,
                        'revenue' => $plan->users_count * $plan->price,
                    ];
                })
        ];

        return Inertia::render('superadmin/dashboard', [
            'dashboardData' => $dashboardData
        ]);
    }

    private function renderCompanyDashboard()
    {
        $user = auth()->user();

        // If user is employee, show limited dashboard
        if ($user->type === 'employee') {
            return $this->renderEmployeeDashboard();
        }

        $companyUserIds = $this->getCompanyUserIds();

        $monthStart = now()->startOfMonth();
        $monthEnd = now()->endOfMonth();
        $workingSchedule = app(WorkingScheduleService::class);

        $totalEmployees = User::where('type', 'employee')
            ->whereIn('created_by', $companyUserIds)
            ->whereHas('employee', fn ($query) => $query->whereIn('employee_status', ['active', 'probation']))
            ->count();
        $totalDepartments = Department::whereIn('created_by', $companyUserIds)->count();

        $presentToday = AttendanceRecord::whereIn('created_by', $companyUserIds)
            ->whereDate('date', today())
            ->where(function ($query) {
                $query->whereNotNull('clock_in')
                    ->orWhere('status', 'present');
            })
            ->count();
        $noClockoutToday = AttendanceRecord::whereIn('created_by', $companyUserIds)
            ->whereDate('date', today())
            ->whereNotNull('clock_in')
            ->whereNull('clock_out')
            ->count();
        $attendanceRate = $totalEmployees > 0 ? round(($presentToday / $totalEmployees) * 100, 1) : 0;

        $monthPresent = AttendanceRecord::whereIn('created_by', $companyUserIds)
            ->whereBetween('date', [$monthStart->toDateString(), $monthEnd->toDateString()])
            ->where(function ($query) {
                $query->whereNotNull('clock_in')
                    ->orWhere('status', 'present');
            })
            ->count();
        $monthAbsent = AttendanceRecord::whereIn('created_by', $companyUserIds)
            ->whereBetween('date', [$monthStart->toDateString(), $monthEnd->toDateString()])
            ->where('status', 'absent')
            ->count();
        $monthNoClockout = AttendanceRecord::whereIn('created_by', $companyUserIds)
            ->whereBetween('date', [$monthStart->toDateString(), $monthEnd->toDateString()])
            ->whereNotNull('clock_in')
            ->whereNull('clock_out')
            ->count();

        $latestPayrollRun = PayrollRun::whereIn('created_by', $companyUserIds)
            ->orderByDesc('pay_period_end')
            ->orderByDesc('id')
            ->first();
        $draftPayrollRuns = PayrollRun::whereIn('created_by', $companyUserIds)
            ->where('status', 'draft')
            ->count();

        $workingDaysPerWeek = count($workingSchedule->workingDayIndices());
        $weeklyHours = round($workingSchedule->totalWorkingMinutes(now()->startOfWeek(), now()->endOfWeek()) / 60, 1);
        $holidaysThisMonth = collect($workingSchedule->holidays())
            ->filter(fn ($date) => Carbon::parse($date)->betweenIncluded($monthStart, $monthEnd))
            ->count();

        $colors = ['#5b8ff9', '#39d486', '#ffad3d', '#ff5a62', '#19c7d0', '#7c3aed'];
        $departmentStats = Department::whereIn('created_by', $companyUserIds)
            ->withCount(['employees' => fn ($query) => $query->whereIn('employee_status', ['active', 'probation'])])
            ->orderByDesc('employees_count')
            ->take(8)
            ->get()
            ->map(fn ($department, $index) => [
                'name' => $department->name,
                'employees' => $department->employees_count,
                'color' => $colors[$index % count($colors)],
            ]);

        $recentPayrollRuns = PayrollRun::whereIn('created_by', $companyUserIds)
            ->orderByDesc('pay_period_end')
            ->orderByDesc('id')
            ->take(5)
            ->get(['id', 'title', 'pay_period_start', 'pay_period_end', 'employee_count', 'total_net_pay', 'status']);

        $dashboardData = [
            'stats' => [
                'totalEmployees' => $totalEmployees,
                'totalDepartments' => $totalDepartments,
                'attendanceRate' => $attendanceRate,
                'presentToday' => $presentToday,
                'noClockoutToday' => $noClockoutToday,
                'monthPresent' => $monthPresent,
                'monthAbsent' => $monthAbsent,
                'monthNoClockout' => $monthNoClockout,
                'latestPayrollNetPay' => $latestPayrollRun ? (float) $latestPayrollRun->total_net_pay : 0,
                'latestPayrollTitle' => $latestPayrollRun?->title,
                'latestPayrollStatus' => $latestPayrollRun?->status,
                'draftPayrollRuns' => $draftPayrollRuns,
                'workingDaysPerWeek' => $workingDaysPerWeek,
                'weeklyHours' => $weeklyHours,
                'holidaysThisMonth' => $holidaysThisMonth,
            ],
            'charts' => [
                'departmentStats' => $departmentStats,
                'attendanceSummary' => [
                    ['name' => 'Present', 'value' => $monthPresent, 'color' => '#39d486'],
                    ['name' => 'Absent', 'value' => $monthAbsent, 'color' => '#ff5a62'],
                    ['name' => 'No Clockout', 'value' => $monthNoClockout, 'color' => '#ffad3d'],
                ],
            ],
            'recentActivities' => [
                'payrollRuns' => $recentPayrollRuns,
            ],
            'fieldAttendance' => (bool) $user->employee?->field_attendance,
            'userType' => $user->type
        ];

        return Inertia::render('dashboard', [
            'dashboardData' => $dashboardData
        ]);
    }

    private function renderEmployeeDashboard()
    {
        $user = auth()->user();
        $companyUserIds = $this->getCompanyUserIds();

        // Recent Announcements
        $recentAnnouncements = \App\Models\Announcement::whereIn('created_by', $companyUserIds)
            ->orderBy('created_at', 'desc')
            ->take(5)
            ->get();

        // Recent Meetings - get meetings where user is organizer
        $recentMeetings = \App\Models\Meeting::with('attendees')
            ->whereIn('created_by', $companyUserIds)
            ->where('organizer_id', $user->id)
            ->orderBy('created_at', 'desc')
            ->get();

        // Get meetings where user is attendee
        $meetingAttendee = \App\Models\MeetingAttendee::with('meeting')
            ->where('user_id', $user->id)
            ->get();


        // Extract meetings from attendee records
        $attendeeMeetings = $meetingAttendee->pluck(value: 'meeting')->filter();

        // Merge and remove duplicates
        $recentMeetings = $recentMeetings->merge($attendeeMeetings)
            ->unique('id')
            ->filter(function ($meeting) {
                return $meeting->meeting_date >= today();
            })
            ->sortByDesc('created_at')
            ->values();

        // Employee Stats
        $totalAwards = \App\Models\Award::where('employee_id', $user->id)->count();
        $totalWarnings = \App\Models\Warning::where('employee_id', $user->id)->count();
        $totalComplaints = \App\Models\Complaint::where('against_employee_id', $user->id)->count();

        // Get shifts and attendance policies for clock in functionality
        $shifts = \App\Models\Shift::whereIn('created_by', $companyUserIds)
            ->where('status', 'active')
            ->get(['id', 'name', 'start_time', 'end_time']);

        $attendancePolicies = \App\Models\AttendancePolicy::whereIn('created_by', $companyUserIds)
            ->where('status', 'active')
            ->get(['id', 'name']);

        // Get today's attendance for the employee
        $todayAttendance = \App\Models\AttendanceRecord::where('employee_id', $user->id)
            ->where('date', \Carbon\Carbon::today())
            ->first();

        if ($user->employee?->field_attendance) {
            $todayAttendance = \App\Models\AttendanceRecord::where('employee_id', $user->id)->whereNotNull('clock_in')->whereNull('clock_out')
                ->whereExists(fn ($q) => $q->selectRaw('1')->from('field_attendance_captures')->whereColumn('field_attendance_captures.attendance_record_id', 'attendance_records.id')->where('field_attendance_captures.type', 'in'))
                ->orderByDesc('date')->first() ?? $todayAttendance;
        }

        // Get employee's assigned shift
        $employeeShift = null;
        $employee = \App\Models\Employee::where('user_id', $user->id)->first();
        if ($employee && $employee->shift_id) {
            $employeeShift = \App\Models\Shift::find($employee->shift_id);
        }

        // Auto clock out previous days like yesterday and alll thing if not clocked out
        $previousAttendance = \App\Models\AttendanceRecord::where('employee_id', $user->id)
            ->where('date', '<', \Carbon\Carbon::today())
            ->whereNotNull('clock_in')
            ->whereNull('clock_out')
            ->get();

        foreach ($previousAttendance as $record) {
            if ($user->employee?->field_attendance) continue;
            $recordDate = \Carbon\Carbon::parse($record->date);
            $shift = \App\Models\Shift::find($record->shift_id) ?? $employeeShift;

            if ($shift) {
                $record->update([
                    'clock_out' => $shift->end_time,
                ]);

                if (method_exists($record, 'processAttendance')) {
                    $record->processAttendance();
                }
            }
        }

        // Auto clock out if shift end time has passed for today
        if (!$user->employee?->field_attendance && $todayAttendance && $todayAttendance->clock_in && !$todayAttendance->clock_out && $employeeShift) {
            $now = \Carbon\Carbon::now();
            $shiftEndTime = \Carbon\Carbon::today()->setTimeFromTimeString($employeeShift->end_time);

            if ($now->greaterThan($shiftEndTime)) {
                $todayAttendance->update([
                    'clock_out' => $employeeShift->end_time,
                ]);

                if (method_exists($todayAttendance, 'processAttendance')) {
                    $todayAttendance->processAttendance();
                }

                $todayAttendance = $todayAttendance->fresh();
            }
        }

        $dashboardData = [
            'stats' => [
                'totalAwards' => $totalAwards,
                'totalWarnings' => $totalWarnings,
                'totalComplaints' => $totalComplaints
            ],
            'recentActivities' => [
                'announcements' => $recentAnnouncements,
                'meetings' => $recentMeetings
            ],
            'shifts' => $shifts,
            'attendancePolicies' => $attendancePolicies,
            'todayAttendance' => $todayAttendance,
            'currentTime' => \Carbon\Carbon::now()->format('H:i:s'),
            'employeeShift' => $employeeShift,
            'fieldAttendance' => (bool) $user->employee?->field_attendance,
            'userType' => $user->type
        ];
        return Inertia::render('employee-dashboard', [
            'dashboardData' => $dashboardData
        ]);
    }

    // private function getCompanyUserIds()
    // {
    //     $user = auth()->user();
    //     if ($user->type === 'company') {
    //         $companyUserIds = User::where('created_by', $user->id)->pluck('id')->toArray();
    //         $companyUserIds[] = $user->id;
    //         return $companyUserIds;
    //     } else {
    //         $userCreatedBy = User::where('id', $user->created_by)->value('id');
    //         $companyUserIds = User::where('created_by', $userCreatedBy)->pluck('id')->toArray();
    //         $companyUserIds[] = $userCreatedBy;
    //         return $companyUserIds;
    //     }
    // }


    private function getCompanyUserIds()
    {
        $user = auth()->user();
        if ($user->type === 'company') {
            $companyId = getCompanyId($user->id);
            if ($companyId) {
                $allUsers = getAllCompanyUsers($companyId);
                $allUsers[] = $companyId; // Include company itself
                return array_unique($allUsers);
            }
            return [];
        } else {
            $companyId = getCompanyId($user->id);
            if ($companyId) {
                $allUsers = getAllCompanyUsers($companyId);
                $allUsers[] = $companyId; // Include company itself
                return array_unique($allUsers);
            }
            return [];
        }
    }
}
