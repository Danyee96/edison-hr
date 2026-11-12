<?php

namespace App\Services\Attendance;

use RuntimeException;
use ZipArchive;

class XlsxReader
{
    public function rows(string $path): array
    {
        $zip = new ZipArchive();

        if ($zip->open($path) !== true) {
            throw new RuntimeException(__('Unable to open XLSX file.'));
        }

        $sharedStrings = $this->sharedStrings($zip);
        $workbookRels = $this->workbookRelationships($zip);
        $sheetPath = $this->firstWorksheetPath($zip, $workbookRels);
        $xml = $zip->getFromName($sheetPath);
        $zip->close();

        if ($xml === false) {
            throw new RuntimeException(__('Unable to read worksheet data.'));
        }

        $sheet = simplexml_load_string($xml);
        $sheet->registerXPathNamespace('x', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main');

        $rows = [];
        foreach ($sheet->xpath('//x:sheetData/x:row') as $row) {
            $values = [];
            foreach ($row->c as $cell) {
                $reference = (string) $cell['r'];
                $columnIndex = $this->columnIndex(preg_replace('/\d+/', '', $reference));
                $values[$columnIndex] = $this->cellValue($cell, $sharedStrings);
            }

            if (! empty(array_filter($values, fn ($value) => $value !== null && $value !== ''))) {
                ksort($values);
                $maxColumn = max(array_keys($values));
                $rowValues = [];
                for ($column = 0; $column <= $maxColumn; $column++) {
                    $rowValues[] = $values[$column] ?? '';
                }

                $rows[] = $rowValues;
            }
        }

        return $rows;
    }

    private function sharedStrings(ZipArchive $zip): array
    {
        $xml = $zip->getFromName('xl/sharedStrings.xml');
        if ($xml === false) {
            return [];
        }

        $strings = [];
        $shared = simplexml_load_string($xml);
        foreach ($shared->si as $item) {
            $strings[] = (string) ($item->t ?? $item->r->t ?? '');
        }

        return $strings;
    }

    private function workbookRelationships(ZipArchive $zip): array
    {
        $rels = [];
        $xml = $zip->getFromName('xl/_rels/workbook.xml.rels');
        if ($xml === false) {
            return $rels;
        }

        $relationships = simplexml_load_string($xml);
        foreach ($relationships->Relationship as $relationship) {
            $rels[(string) $relationship['Id']] = 'xl/'.ltrim((string) $relationship['Target'], '/');
        }

        return $rels;
    }

    private function firstWorksheetPath(ZipArchive $zip, array $workbookRels): string
    {
        $xml = $zip->getFromName('xl/workbook.xml');
        if ($xml !== false) {
            $workbook = simplexml_load_string($xml);
            $workbook->registerXPathNamespace('x', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main');
            $workbook->registerXPathNamespace('r', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships');
            $sheets = $workbook->xpath('//x:sheets/x:sheet');
            if (! empty($sheets)) {
                $id = (string) $sheets[0]->attributes('r', true)['id'];
                if (isset($workbookRels[$id])) {
                    return $workbookRels[$id];
                }
            }
        }

        return 'xl/worksheets/sheet1.xml';
    }

    private function cellValue($cell, array $sharedStrings): ?string
    {
        $type = (string) $cell['t'];
        $value = isset($cell->v) ? (string) $cell->v : null;

        if ($type === 's' && $value !== null) {
            return $sharedStrings[(int) $value] ?? null;
        }

        if ($type === 'inlineStr') {
            return (string) ($cell->is->t ?? '');
        }

        return $value;
    }

    private function columnIndex(string $letters): int
    {
        $index = 0;
        foreach (str_split(strtoupper($letters)) as $letter) {
            $index = $index * 26 + ord($letter) - 64;
        }

        return $index - 1;
    }
}
