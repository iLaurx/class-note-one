# Run after tests/db/excel-export.test.ts. Uses only its synthetic seven-student workbooks.
param([switch]$Render)
$ErrorActionPreference = 'Stop'
$reportRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../../test-results/reports')).Path
$excel = $null
$checks = @()
try {
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    $excel.EnableEvents = $false
    $excel.AutomationSecurity = 3
    foreach ($name in @('semanal-siete', 'mensual-siete', 'ciclo-siete', 'mensual-semanas')) {
        $workbook = $null
        try {
            $workbook = $excel.Workbooks.Open((Join-Path $reportRoot "$name.xlsx"), 0, $true)
            $names = @($workbook.Worksheets | ForEach-Object { $_.Name })
            if (($names -join ',') -ne 'Resumen,Asistencia,Tareas,Lecturas') { throw 'Hojas inesperadas.' }
            foreach ($sheet in $workbook.Worksheets) {
                if ($sheet.UsedRange.HasFormula -ne $false) { throw 'El reporte debe ser una captura de los registros, sin fórmulas.' }
            }
            if ($Render) { $workbook.ExportAsFixedFormat(0, (Join-Path $reportRoot "$name.pdf")) }
            $checks += @{ file = "$name.xlsx"; normalReadOnlyOpen = $true; sheets = $names; rendered = [bool]$Render }
            Write-Output "$name : apertura normal de las cuatro hojas en Microsoft Excel."
        } finally { if ($null -ne $workbook) { $workbook.Close($false) } }
    }
    @{ excelVersion = $excel.Version; workbooks = $checks } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $reportRoot 'excel-check.json') -Encoding utf8
} finally {
    if ($null -ne $excel) { $excel.Quit(); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($excel) }
}
