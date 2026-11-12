<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Salary Advance - {{ $monthLabel }}</title>
    <style>
        body { color: #111827; font-family: DejaVu Sans, Arial, sans-serif; font-size: 11px; margin: 20px; }
        .header { margin-bottom: 18px; text-align: center; }
        .header h1 { font-size: 22px; margin: 0 0 6px; }
        .header p { color: #4b5563; margin: 0; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #d1d5db; padding: 6px 7px; text-align: left; }
        th { background: #eef2ff; color: #1f2937; font-weight: 700; }
        .number { text-align: right; }
        .muted { color: #6b7280; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Salary Advance Sheet</h1>
        <p>{{ $monthLabel }} · Generated on {{ now()->format('F j, Y') }}</p>
    </div>

    <table>
        <thead>
            <tr>
                <th>Employee ID</th>
                <th>Name</th>
                <th>Department</th>
                <th class="number">Salary</th>
                <th class="number">Amount</th>
                <th>Date</th>
                <th>Notes</th>
                <th class="number">Remaining Salary</th>
            </tr>
        </thead>
        <tbody>
            @forelse($rows as $row)
                <tr>
                    <td>{{ $row['employee_id'] ?: '-' }}</td>
                    <td>{{ $row['name'] }}</td>
                    <td>{{ $row['department'] ?: '-' }}</td>
                    <td class="number">{{ number_format((float) $row['salary'], 2) }}</td>
                    <td class="number">{{ $row['amount'] !== '' ? number_format((float) $row['amount'], 2) : '' }}</td>
                    <td>{{ $row['date'] }}</td>
                    <td>{{ $row['notes'] }}</td>
                    <td class="number">{{ number_format((float) $row['remaining_salary'], 2) }}</td>
                </tr>
            @empty
                <tr>
                    <td colspan="8" class="muted" style="text-align: center;">No employees found.</td>
                </tr>
            @endforelse
        </tbody>
    </table>
</body>
</html>
