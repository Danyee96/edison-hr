<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class RestrictFieldEmployee
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();
        if ($user?->type === 'employee' && $user->employee?->field_attendance) {
            if (! $request->routeIs('dashboard', 'hr.field-attendance.my', 'hr.field-attendance.capture', 'hr.field-attendance.start', 'logout', 'initial-locale', 'translations', 'verification.*')) {
                if ($request->isMethod('GET')) return redirect()->route('dashboard');
                abort(403);
            }
        }
        return $next($request);
    }
}
