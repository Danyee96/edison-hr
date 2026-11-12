<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckSaas
{

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $isSuperAdmin = $user && in_array($user->type, ['superadmin', 'super admin'], true);

        if (!isSaas() && !$isSuperAdmin) {
            abort(404);
        }

        return $next($request);
    }
}
