<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Models\Department;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class DepartmentController extends Controller
{
    public function index(Request $request)
    {
        if (Auth::user()->can('manage-departments')) {

            $query = Department::with(['employees.user:id,name'])
                ->withCount('employees')
                ->where(function ($q) {
                if (Auth::user()->can('manage-any-departments')) {
                    $q->whereIn('created_by',  getCompanyAndUsersId());
                } elseif (Auth::user()->can('manage-own-departments')) {
                    $q->where('created_by', Auth::id());
                } else {
                    $q->whereRaw('1 = 0');
                }
            });

            // Handle search
            if ($request->has('search') && !empty($request->search)) {
                $query->where(function ($q) use ($request) {
                    $q->where('name', 'like', '%' . $request->search . '%');
                });
            }

            // Handle sorting
            if ($request->has('sort_field') && !empty($request->sort_field)) {
                $query->orderBy($request->sort_field, $request->sort_direction ?? 'asc');
            } else {
                $query->orderBy('created_at', 'desc');
            }

            $departments = $query->paginate($request->per_page ?? 50);

            $employees = User::with('employee.department')
                ->where('type', 'employee')
                ->whereIn('created_by', getCompanyAndUsersId())
                ->orderBy('name')
                ->get(['id', 'name']);

            return Inertia::render('hr/departments/index', [
                'departments' => $departments,
                'employees' => $employees,
                'filters' => $request->all(['search', 'sort_field', 'sort_direction', 'per_page']),
            ]);
        } else {
            return redirect()->back()->with('error', __('Permission Denied.'));
        }
    }

    public function store(Request $request)
    {
        if (Auth::user()->can('create-departments')) {
            $validated = $request->validate([
                'name' => 'required|string|max:255',
                'employee_ids' => 'nullable|array',
                'employee_ids.*' => 'exists:users,id',
            ]);

            $validated['created_by'] = creatorId();
            $validated['branch_id'] = $this->defaultBranch()->id;
            $validated['status'] = 'active';

            // Check if department with same name already exists in this branch
            $exists = Department::where('name', $validated['name'])
                ->where('branch_id', $validated['branch_id'])
                ->whereIn('created_by', getCompanyAndUsersId())
                ->exists();

            if ($exists) {
                return redirect()->back()->with('error', __('Department with this name already exists in the selected branch.'));
            }

            $employeeIds = $validated['employee_ids'] ?? [];
            unset($validated['employee_ids']);

            $department = Department::create($validated);
            $this->assignEmployees($department, $employeeIds);

            return redirect()->back()->with('success', __('Department created successfully.'));
        } else {
            return redirect()->back()->with('error', __('Permission Denied.'));
        }
    }

    public function update(Request $request, $departmentId)
    {
        if (Auth::user()->can('edit-departments')) {
            $department = Department::where('id', $departmentId)
                ->whereIn('created_by', getCompanyAndUsersId())
                ->first();

            if ($department) {
                try {
                    $validated = $request->validate([
                        'name' => 'required|string|max:255',
                        'employee_ids' => 'nullable|array',
                        'employee_ids.*' => 'exists:users,id',
                    ]);

                    $validated['branch_id'] = $department->branch_id ?: $this->defaultBranch()->id;

                    // Check if department with same name already exists in this branch (excluding current department)
                    $exists = Department::where('name', $validated['name'])
                        ->where('branch_id', $validated['branch_id'])
                        ->whereIn('created_by', getCompanyAndUsersId())
                        ->where('id', '!=', $departmentId)
                        ->exists();

                    if ($exists) {
                        return redirect()->back()->with('error', __('Department with this name already exists in the selected branch.'));
                    }

                    $employeeIds = $validated['employee_ids'] ?? [];
                    unset($validated['employee_ids']);

                    $department->update($validated);
                    $this->syncEmployees($department, $employeeIds);

                    return redirect()->back()->with('success', __('Department updated successfully'));
                } catch (\Exception $e) {
                    return redirect()->back()->with('error', $e->getMessage() ?: __('Failed to update department'));
                }
            } else {
                return redirect()->back()->with('error', __('Department Not Found.'));
            }
        } else {
            return redirect()->back()->with('error', __('Permission Denied.'));
        }
    }

    public function destroy($departmentId)
    {
        if (Auth::user()->can('delete-departments')) {
            $department = Department::where('id', $departmentId)
                ->whereIn('created_by', getCompanyAndUsersId())
                ->first();

            if ($department) {
                try {
                    // Check if department has employees
                    if (class_exists('App\\Models\\Employee')) {
                        $employeeCount = \App\Models\User::where('type', 'employee')
                            ->whereHas('employee', function ($q) use ($departmentId) {
                                $q->where('department_id', $departmentId);
                            })->count();
                        if ($employeeCount > 0) {
                            return response()->json(['message' => __('Cannot delete department with assigned employees')], 400);
                        }
                    }
                    $department->delete();
                    return redirect()->back()->with('success', __('Department deleted successfully'));
                } catch (\Exception $e) {
                    return redirect()->back()->with('error', $e->getMessage() ?: __('Failed to delete department'));
                }
            } else {
                return redirect()->back()->with('error', __('Department Not Found.'));
            }
        } else {
            return redirect()->back()->with('error', __('Permission Denied.'));
        }
    }

    public function toggleStatus($departmentId)
    {
        if (Auth::user()->can('toggle-status-departments')) {
            $department = Department::where('id', $departmentId)
                ->whereIn('created_by', getCompanyAndUsersId())
                ->first();

            if ($department) {
                try {
                    $department->status = $department->status === 'active' ? 'inactive' : 'active';
                    $department->save();

                    return redirect()->back()->with('success', __('Department status updated successfully'));
                } catch (\Exception $e) {
                    return redirect()->back()->with('error', $e->getMessage() ?: __('Failed to update department status'));
                }
            } else {
                return redirect()->back()->with('error', __('Department Not Found.'));
            }
        } else {
            return redirect()->back()->with('error', __('Permission Denied.'));
        }
    }

    private function defaultBranch(): Branch
    {
        return Branch::whereIn('created_by', getCompanyAndUsersId())
            ->where('status', 'active')
            ->orderBy('id')
            ->first()
            ?: Branch::create([
                'name' => 'Main Branch',
                'status' => 'active',
                'created_by' => creatorId(),
            ]);
    }

    private function assignEmployees(Department $department, array $employeeIds): void
    {
        // Employee department/branch belongs to the Employee edit screen only.
    }

    private function syncEmployees(Department $department, array $employeeIds): void
    {
        // Employee department/branch belongs to the Employee edit screen only.
    }
}
