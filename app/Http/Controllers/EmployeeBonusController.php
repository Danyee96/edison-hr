<?php

namespace App\Http\Controllers;

use App\Models\EmployeeBonus;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class EmployeeBonusController extends Controller
{
    public function index(Request $request)
    {
        if (! Auth::user()->can('manage-employee-bonuses')) {
            return redirect()->back()->with('error', __('Permission Denied.'));
        }

        $query = EmployeeBonus::with('employee')
            ->whereIn('created_by', getCompanyAndUsersId());

        if ($request->filled('employee_id') && $request->employee_id !== 'all') {
            $query->where('employee_id', $request->employee_id);
        }
        if ($request->filled('bonus_type') && $request->bonus_type !== 'all') {
            $query->where('bonus_type', $request->bonus_type);
        }
        if ($request->filled('date_from')) {
            $query->whereDate('bonus_date', '>=', $request->date_from);
        }
        if ($request->filled('date_to')) {
            $query->whereDate('bonus_date', '<=', $request->date_to);
        }

        $bonuses = $query->orderByDesc('bonus_date')->paginate($request->per_page ?? 50);
        $employees = User::emp()
            ->whereIn('created_by', getCompanyAndUsersId())
            ->where('status', 'active')
            ->with('employee.department')
            ->get(['id', 'name'])
            ->map(fn (User $employee) => [
                'id' => $employee->id,
                'name' => $employee->name,
                'employee_id' => $employee->employee?->employee_id_display,
                'department_name' => $employee->employee?->department?->name,
            ]);

        return Inertia::render('hr/bonus-management/index', [
            'bonuses' => $bonuses,
            'employees' => $employees,
            'filters' => $request->all(['employee_id', 'bonus_type', 'date_from', 'date_to', 'per_page']),
        ]);
    }

    public function store(Request $request)
    {
        if (! Auth::user()->can('create-employee-bonuses')) {
            return redirect()->back()->with('error', __('Permission Denied.'));
        }

        $validated = $request->validate([
            'employee_id' => 'required|exists:users,id',
            'bonus_type' => 'required|in:performance,eid,annual,custom',
            'amount' => 'required|numeric|min:0.01',
            'bonus_date' => 'required|date',
            'notes' => 'nullable|string',
        ]);

        $validated['created_by'] = creatorId();
        EmployeeBonus::create($validated);

        return redirect()->back()->with('success', __('Bonus created successfully.'));
    }

    public function update(Request $request, EmployeeBonus $bonus)
    {
        if (! Auth::user()->can('edit-employee-bonuses') || ! in_array($bonus->created_by, getCompanyAndUsersId())) {
            return redirect()->back()->with('error', __('Permission Denied.'));
        }

        $validated = $request->validate([
            'employee_id' => 'required|exists:users,id',
            'bonus_type' => 'required|in:performance,eid,annual,custom',
            'amount' => 'required|numeric|min:0.01',
            'bonus_date' => 'required|date',
            'notes' => 'nullable|string',
        ]);

        $bonus->update($validated);

        return redirect()->back()->with('success', __('Bonus updated successfully.'));
    }

    public function destroy(EmployeeBonus $bonus)
    {
        if (! Auth::user()->can('delete-employee-bonuses') || ! in_array($bonus->created_by, getCompanyAndUsersId())) {
            return redirect()->back()->with('error', __('Permission Denied.'));
        }

        $bonus->delete();

        return redirect()->back()->with('success', __('Bonus deleted successfully.'));
    }
}
