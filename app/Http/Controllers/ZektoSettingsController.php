<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Validator;

class ZektoSettingsController extends Controller
{
    public function index()
    {
        $settings = settings();

        return \Inertia\Inertia::render('hr/biometric-settings/index', [
            'zektoSettings' => array_intersect_key($settings, array_flip([
                'zkteco_api_url', 'zkteco_username', 'zkteco_password', 'zkteco_auth_token',
            ])),
        ]);
    }

    /**
     * Update Zekto settings
     */
    public function update(Request $request)
    {
        if (Auth::user()->can('manage-biomatric-attedance-settings')) {
            $validator = Validator::make($request->all(), [
                'zkteco_api_url' => 'required|url',
                'zkteco_username' => 'required|string|max:255',
                'zkteco_password' => 'required|string|max:255',
            ]);

            if ($validator->fails()) {
                return redirect()->back()->withErrors($validator)->withInput();
            }

            $current = settings();
            $credentialsChanged = collect(['zkteco_api_url', 'zkteco_username', 'zkteco_password'])
                ->contains(fn ($key) => ($current[$key] ?? '') !== $request->input($key));

            // Update settings
            updateSetting('zkteco_api_url', $request->zkteco_api_url);
            updateSetting('zkteco_username', $request->zkteco_username);
            updateSetting('zkteco_password', $request->zkteco_password);
            if ($credentialsChanged) {
                updateSetting('isZktecoSync', 0);
                updateSetting('zkteco_auth_token', '');
            }

            return redirect()->back()->with('success', __('Zekto settings updated successfully'));
        } else {
            return redirect()->back()->with('error', __('Permission Denied.'));
        }
    }

    /**
     * Generate auth token from Zekto API
     */
    public function generateToken(Request $request)
    {
        if (Auth::user()->can('manage-biomatric-attedance-settings')) {
            $validator = Validator::make($request->all(), [
                'zkteco_api_url' => 'required|url',
                'zkteco_username' => 'required|string',
                'zkteco_password' => 'required|string',
            ]);

            if ($validator->fails()) {
                return redirect()->back()->withErrors($validator)->withInput();
            }

            try {
                $url = rtrim($request->zkteco_api_url, '/') . '/api-token-auth/';
                $headers = array(
                    "Content-Type: application/json"
                );
                $data = array(
                    "username" => $request->zkteco_username,
                    "password" => $request->zkteco_password
                );

                $ch = curl_init();
                curl_setopt($ch, CURLOPT_URL, $url);
                curl_setopt($ch, CURLOPT_POST, true);
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
                curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_TIMEOUT, 15);

                $response = curl_exec($ch);
                curl_close($ch);
                $auth_token = json_decode($response, true);
                if (isset($auth_token['token'])) {
                    // Keep the credentials used to generate the token together.
                    updateSetting('zkteco_api_url', $request->zkteco_api_url);
                    updateSetting('zkteco_username', $request->zkteco_username);
                    updateSetting('zkteco_password', $request->zkteco_password);
                    updateSetting('isZktecoSync', 1);
                    updateSetting('zkteco_auth_token', $auth_token['token']);

                    return redirect()->back()->with([
                        'success' => __('Auth token generated successfully'),
                        'token' => $auth_token['token']
                    ]);
                } else {
                    throw new \Exception(isset($auth_token['non_field_errors']) ? $auth_token['non_field_errors'][0] : "Something went wrong please try again");
                }
            } catch (\Exception $e) {

                return redirect()->back()->with('error', $e->getMessage());
            }
        } else {
            return redirect()->back()->with('error', __('Permission Denied.'));
        }
    }
}
