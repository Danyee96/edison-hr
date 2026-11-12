<?php

namespace App\Http\Controllers;

use App\Models\AdvanceSalary;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;

class AdvanceSalaryReceiptController extends Controller
{
    public function show(Request $request, AdvanceSalary $advanceSalary)
    {
        $this->ensureValidSignature($request);

        $receipt = $this->receiptData($advanceSalary);
        $imageUrl = URL::temporarySignedRoute('advance-salary-receipts.image', now()->addDays(7), [
            'advanceSalary' => $advanceSalary,
            'v' => 'fontfix-20260710',
        ], false);
        $imageContentType = $this->canRenderRasterReceipt() ? 'image/png' : 'image/svg+xml';

        return response()->view('advance-salary-receipts.show', [
            'receipt' => $receipt,
            'imageUrl' => $imageUrl,
            'absoluteImageUrl' => $this->publicOrigin($request).$imageUrl,
            'imageContentType' => $imageContentType,
            'pageUrl' => $request->fullUrl(),
        ]);
    }

    public function image(Request $request, AdvanceSalary $advanceSalary)
    {
        $this->ensureValidSignature($request);

        $receipt = $this->receiptData($advanceSalary);

        if (! $this->canRenderGdReceipt()) {
            $svg = $this->svgReceipt($receipt);
            $png = $this->pngFromSvg($svg);

            if ($png) {
                return response($png, 200, [
                    'Content-Type' => 'image/png',
                    'Cache-Control' => 'public, max-age=86400',
                ]);
            }

            return response($svg, 200, [
                'Content-Type' => 'image/svg+xml',
                'Cache-Control' => 'public, max-age=86400',
            ]);
        }

        $width = 1200;
        $height = 630;
        $scale = 2;
        $image = imagecreatetruecolor($width * $scale, $height * $scale);

        $white = imagecolorallocate($image, 255, 255, 255);
        $black = imagecolorallocate($image, 17, 24, 39);
        $red = imagecolorallocate($image, 220, 38, 38);

        imageantialias($image, true);
        imagefilledrectangle($image, 0, 0, $width * $scale, $height * $scale, $white);

        $this->centerText($image, "Name: {$receipt['employee_name']}", 88 * $scale, 54 * $scale, $black, true, 1080 * $scale);
        $this->centerText($image, "Dept: {$receipt['department_name']}", 150 * $scale, 46 * $scale, $black, true, 1080 * $scale);
        $this->centerText($image, 'Advance taken', 235 * $scale, 64 * $scale, $black, true);
        $this->centerText($image, 'Rs '.$receipt['amount'], 325 * $scale, 86 * $scale, $red, true);
        $this->centerText($image, $receipt['date'], 390 * $scale, 42 * $scale, $black);

        imagesetthickness($image, 4 * $scale);
        imageline($image, 210 * $scale, 455 * $scale, 990 * $scale, 455 * $scale, $black);

        $this->centerText($image, 'Total Advance taken this month:', 515 * $scale, 44 * $scale, $black, true, 1080 * $scale);
        $this->centerText($image, 'Rs '.$receipt['month_total'], 580 * $scale, 66 * $scale, $red, true);

        ob_start();
        imagepng($image);
        $png = ob_get_clean();
        imagedestroy($image);

        return response($png, 200, [
            'Content-Type' => 'image/png',
            'Cache-Control' => 'public, max-age=86400',
        ]);
    }

    private function receiptData(AdvanceSalary $advanceSalary): array
    {
        $advanceSalary->loadMissing('employee.employee.department');

        $date = $advanceSalary->request_date ?: now();
        $monthStart = $date->copy()->startOfMonth();
        $monthEnd = $date->copy()->endOfMonth();
        $monthTotal = AdvanceSalary::where('employee_id', $advanceSalary->employee_id)
            ->whereBetween('request_date', [$monthStart->toDateString(), $monthEnd->toDateString()])
            ->sum('amount');

        return [
            'employee_name' => $this->receiptText($advanceSalary->employee?->name ?: '-'),
            'department_name' => $this->receiptText($advanceSalary->employee?->employee?->department?->name ?: 'Unassigned'),
            'amount' => number_format((float) $advanceSalary->amount),
            'date' => Carbon::parse($date)->format('j F Y'),
            'month_total' => number_format((float) $monthTotal),
            'notes' => $advanceSalary->notes,
        ];
    }

    private function ensureValidSignature(Request $request): void
    {
        if (! URL::hasValidSignature($request) && ! URL::hasValidSignature($request, false)) {
            abort(403);
        }
    }

    private function receiptText(?string $value): string
    {
        $text = trim((string) $value);

        if ($text === '') {
            return '-';
        }

        if (function_exists('iconv')) {
            $converted = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $text);
            if ($converted !== false) {
                $text = $converted;
            }
        }

        $text = preg_replace('/[^\x20-\x7E]/', '', $text) ?: $text;
        $text = preg_replace('/\s+/', ' ', $text) ?: $text;

        return trim($text) ?: '-';
    }

    private function publicOrigin(Request $request): string
    {
        $proto = $request->headers->get('x-forwarded-proto') ?: $request->getScheme();
        $host = $request->headers->get('x-forwarded-host') ?: $request->getHost();

        $proto = trim(explode(',', $proto)[0]);
        $host = trim(explode(',', $host)[0]);

        return $proto.'://'.$host;
    }

    private function centerText($image, string $text, int $y, int $size, int $color, bool $bold = false, int $maxWidth = 940): void
    {
        $font = $this->fontPath($bold);

        if ($font && function_exists('imagettfbbox') && function_exists('imagettftext')) {
            while ($size > 18) {
                $box = imagettfbbox($size, 0, $font, $text);
                $width = $box[2] - $box[0];

                if ($width <= $maxWidth) {
                    break;
                }

                $size -= 2;
            }

            $box = imagettfbbox($size, 0, $font, $text);
            $width = $box[2] - $box[0];
            $x = (int) ((imagesx($image) - $width) / 2 - $box[0]);
            $baselineY = (int) ($y - (($box[7] + $box[1]) / 2));
            imagettftext($image, $size, 0, $x, $baselineY, $color, $font, $text);
            return;
        }

        $this->centerBitmapText($image, $text, $y, $size, $color, $maxWidth);
    }

    private function centerBitmapText($image, string $text, int $y, int $size, int $color, int $maxWidth): void
    {
        $font = 5;
        $sourceWidth = imagefontwidth($font) * strlen($text);
        $sourceHeight = imagefontheight($font);

        if ($sourceWidth <= 0 || $sourceHeight <= 0) {
            return;
        }

        $targetHeight = max(18, $size);
        $targetWidth = (int) round($sourceWidth * ($targetHeight / $sourceHeight));

        if ($targetWidth > $maxWidth) {
            $ratio = $maxWidth / $targetWidth;
            $targetWidth = (int) round($targetWidth * $ratio);
            $targetHeight = (int) round($targetHeight * $ratio);
        }

        $textImage = imagecreatetruecolor($sourceWidth, $sourceHeight);
        imagealphablending($textImage, false);
        imagesavealpha($textImage, true);
        $transparent = imagecolorallocatealpha($textImage, 255, 255, 255, 127);
        $colorParts = imagecolorsforindex($image, $color);
        $textColor = imagecolorallocate($textImage, $colorParts['red'], $colorParts['green'], $colorParts['blue']);
        imagefilledrectangle($textImage, 0, 0, $sourceWidth, $sourceHeight, $transparent);
        imagestring($textImage, $font, 0, 0, $text, $textColor);

        $x = (int) ((imagesx($image) - $targetWidth) / 2);
        $top = (int) ($y - ($targetHeight / 2));
        imagecopyresampled($image, $textImage, $x, $top, 0, 0, $targetWidth, $targetHeight, $sourceWidth, $sourceHeight);
        imagedestroy($textImage);
    }

    private function svgReceipt(array $receipt): string
    {
        $employeeName = htmlspecialchars($receipt['employee_name'], ENT_QUOTES, 'UTF-8');
        $departmentName = htmlspecialchars($receipt['department_name'], ENT_QUOTES, 'UTF-8');
        $amount = htmlspecialchars($receipt['amount'], ENT_QUOTES, 'UTF-8');
        $date = htmlspecialchars($receipt['date'], ENT_QUOTES, 'UTF-8');
        $monthTotal = htmlspecialchars($receipt['month_total'], ENT_QUOTES, 'UTF-8');

        return <<<SVG
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#ffffff"/>
  <text x="600" y="88" text-anchor="middle" dominant-baseline="middle" font-family="Poppins, Arial, Helvetica, sans-serif" font-size="54" font-weight="700" fill="#111827">Name: {$employeeName}</text>
  <text x="600" y="150" text-anchor="middle" dominant-baseline="middle" font-family="Poppins, Arial, Helvetica, sans-serif" font-size="46" font-weight="700" fill="#111827">Dept: {$departmentName}</text>
  <text x="600" y="235" text-anchor="middle" dominant-baseline="middle" font-family="Poppins, Arial, Helvetica, sans-serif" font-size="64" font-weight="700" fill="#111827">Advance taken</text>
  <text x="600" y="325" text-anchor="middle" dominant-baseline="middle" font-family="Poppins, Arial, Helvetica, sans-serif" font-size="86" font-weight="800" fill="#dc2626">Rs {$amount}</text>
  <text x="600" y="390" text-anchor="middle" dominant-baseline="middle" font-family="Poppins, Arial, Helvetica, sans-serif" font-size="42" font-weight="600" fill="#111827">{$date}</text>
  <line x1="210" y1="455" x2="990" y2="455" stroke="#111827" stroke-width="4"/>
  <text x="600" y="515" text-anchor="middle" dominant-baseline="middle" font-family="Poppins, Arial, Helvetica, sans-serif" font-size="44" font-weight="700" fill="#111827">Total Advance taken this month:</text>
  <text x="600" y="580" text-anchor="middle" dominant-baseline="middle" font-family="Poppins, Arial, Helvetica, sans-serif" font-size="66" font-weight="800" fill="#dc2626">Rs {$monthTotal}</text>
</svg>
SVG;
    }

    private function fontPath(bool $bold): ?string
    {
        $paths = $bold
            ? [
                resource_path('fonts/Poppins-Bold.ttf'),
                resource_path('fonts/Arial-Bold.ttf'),
                '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
                '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
                '/usr/share/fonts/truetype/msttcorefonts/Arial_Bold.ttf',
                '/usr/share/fonts/truetype/msttcorefonts/Arial Bold.ttf',
                '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
                '/Library/Fonts/Arial Bold.ttf',
            ]
            : [
                resource_path('fonts/Poppins-Regular.ttf'),
                resource_path('fonts/Arial.ttf'),
                '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
                '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
                '/usr/share/fonts/truetype/msttcorefonts/Arial.ttf',
                '/System/Library/Fonts/Supplemental/Arial.ttf',
                '/Library/Fonts/Arial.ttf',
            ];

        foreach ($paths as $path) {
            if (is_file($path)) {
                return $path;
            }
        }

        return null;
    }

    private function canRenderRasterReceipt(): bool
    {
        return $this->canRenderGdReceipt() || $this->canRenderImagickPngReceipt();
    }

    private function canRenderGdReceipt(): bool
    {
        return function_exists('imagecreatetruecolor')
            && function_exists('imagepng')
            && function_exists('imagestring')
            && function_exists('imagecopyresampled');
    }

    private function pngFromSvg(string $svg): ?string
    {
        if (! $this->canRenderImagickPngReceipt()) {
            return null;
        }

        try {
            $image = new \Imagick();
            $image->setBackgroundColor(new \ImagickPixel('white'));
            $image->setResolution(192, 192);
            $image->readImageBlob($svg);
            $image->setImageFormat('png');
            $image->setImageDepth(8);

            $png = $image->getImagesBlob();

            $image->clear();
            $image->destroy();

            return $png ?: null;
        } catch (\Throwable) {
            return null;
        }
    }

    private function canRenderImagickPngReceipt(): bool
    {
        static $canRender = null;

        if ($canRender !== null) {
            return $canRender;
        }

        if (! class_exists(\Imagick::class)) {
            return $canRender = false;
        }

        try {
            $image = new \Imagick();
            $image->setBackgroundColor(new \ImagickPixel('white'));
            $image->readImageBlob('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="#fff"/></svg>');
            $image->setImageFormat('png');
            $canRender = (bool) $image->getImagesBlob();
            $image->clear();
            $image->destroy();

            return $canRender;
        } catch (\Throwable) {
            return $canRender = false;
        }
    }
}
