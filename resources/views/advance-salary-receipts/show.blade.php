<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Salary Advance - {{ $receipt['employee_name'] }}</title>
    <link rel="canonical" href="{{ $pageUrl }}">
    <meta name="description" content="Advance taken Rs {{ $receipt['amount'] }} on {{ $receipt['date'] }}. Total this month Rs {{ $receipt['month_total'] }}.">

    <meta property="og:type" content="website">
    <meta property="og:url" content="{{ $pageUrl }}">
    <meta property="og:title" content="{{ $receipt['employee_name'] }} - Advance taken Rs {{ $receipt['amount'] }}">
    <meta property="og:description" content="Dept: {{ $receipt['department_name'] }} · {{ $receipt['date'] }} · Total this month Rs {{ $receipt['month_total'] }}">
    <meta property="og:image" content="{{ $absoluteImageUrl }}">
    <meta property="og:image:secure_url" content="{{ $absoluteImageUrl }}">
    <meta property="og:image:type" content="{{ $imageContentType }}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="Salary advance receipt for {{ $receipt['employee_name'] }}">
    <meta itemprop="image" content="{{ $absoluteImageUrl }}">

    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:url" content="{{ $pageUrl }}">
    <meta name="twitter:title" content="{{ $receipt['employee_name'] }} - Advance taken Rs {{ $receipt['amount'] }}">
    <meta name="twitter:description" content="Dept: {{ $receipt['department_name'] }} · {{ $receipt['date'] }} · Total this month Rs {{ $receipt['month_total'] }}">
    <meta name="twitter:image" content="{{ $absoluteImageUrl }}">

    <style>
        body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f1f5f9; font-family: Arial, sans-serif; color: #111827; }
        .receipt { width: min(1000px, calc(100vw - 32px)); background: #fff; padding: 24px; box-shadow: 0 20px 45px rgba(15, 23, 42, .12); }
        img { display: block; width: 100%; height: auto; }
        .fallback { text-align: center; padding: 40px 16px; }
        .fallback h1 { margin: 18px 0; font-size: clamp(32px, 8vw, 60px); color: #dc2626; }
        .fallback p { margin: 10px 0; font-size: clamp(18px, 4vw, 38px); }
        .fallback .label { font-weight: 700; }
        .fallback hr { width: 62%; border: 0; border-top: 5px solid #111827; margin: 32px auto; }
    </style>
</head>
<body>
    <main class="receipt">
        <img src="{{ $imageUrl }}" alt="Salary advance receipt for {{ $receipt['employee_name'] }}" onerror="this.hidden=true;document.querySelector('.fallback').hidden=false">
        <section class="fallback" hidden>
            <p>Name: {{ $receipt['employee_name'] }}</p>
            <p>Dept: {{ $receipt['department_name'] }}</p>
            <p class="label">Advance taken</p>
            <h1>Rs {{ $receipt['amount'] }}</h1>
            <p class="label">{{ $receipt['date'] }}</p>
            <hr>
            <p class="label">Total Advance taken this month:</p>
            <h1>Rs {{ $receipt['month_total'] }}</h1>
        </section>
    </main>
</body>
</html>
