<?php
declare(strict_types=1);
require_once __DIR__ . '/todos.php';

$id = (string) ($_GET['id'] ?? '');
if (!preg_match('/^[a-f0-9-]{36}$/i', $id)) {
    http_response_code(400);
    exit('Invalid trek identifier.');
}
$path = __DIR__ . '/data/treks/' . strtolower($id) . '.json';
if (!is_file($path)) {
    http_response_code(404);
    exit('Trek not found.');
}
$handle = fopen($path, 'rb');
if (!$handle || !flock($handle, LOCK_SH)) {
    http_response_code(500);
    exit('Could not read trek data.');
}
$trek = json_decode((string) stream_get_contents($handle), true);
flock($handle, LOCK_UN);
fclose($handle);
if (!is_array($trek)) {
    http_response_code(500);
    exit('Trek data is invalid.');
}
$total = count($trek['tasks'] ?? []);
$done = count(array_filter($trek['tasks'] ?? [], static fn($task) => !empty($task['done'])));
$percent = $total ? (int) round($done / $total * 100) : 0;
$lines = ['# ========================================', strtoupper((string) ($trek['name'] ?? 'TREK')) . ' GUIDE CHECKLIST',
    'Destination: ' . ($trek['destination'] ?? ''), 'Guide: ' . ($trek['guide'] ?? 'Not assigned'),
    'Guests: ' . ($trek['guests'] ?? 0), 'Start Date: ' . ($trek['startDate'] ?? ''),
    'End Date: ' . ($trek['endDate'] ?? ''), 'Status: ' . ucfirst(str_replace('-', ' ', (string) ($trek['status'] ?? 'preparation'))), ''];
$categories = guide_checklist_definitions();
$groupTitles = [];
foreach ($categories as $key => $definition) $groupTitles[$key] = $definition['title'];
foreach ($trek['days'] ?? [] as $day) $groupTitles[$day['id']] = 'Daily Trek · ' . $day['date'];
foreach ($trek['tasks'] ?? [] as $task) if (!isset($groupTitles[$task['category']])) $groupTitles[$task['category']] = 'Custom Tasks';
foreach ($groupTitles as $key => $title) {
    $items = array_filter($trek['tasks'] ?? [], static fn($task) => ($task['category'] ?? '') === $key);
    if (!$items) continue;
    $lines[] = '## ' . strtoupper($title);
    foreach ($items as $task) {
        $lines[] = '[' . (!empty($task['done']) ? '✓' : ' ') . '] ' . ($task['title'] ?? '');
        if (!empty($task['note'])) $lines[] = '    Note: ' . preg_replace('/\s+/', ' ', (string) $task['note']);
    }
    $lines[] = '';
}
if (!empty($trek['notes'])) $lines[] = 'TREK NOTES: ' . preg_replace('/\s+/', ' ', (string) $trek['notes']);
if (!empty($trek['emergencyNotes'])) $lines[] = 'EMERGENCY NOTES: ' . preg_replace('/\s+/', ' ', (string) $trek['emergencyNotes']);
$lines[] = '# ======================================== Progress: ' . $percent . '%';
$filename = preg_replace('/[^a-z0-9-]+/i', '-', strtolower((string) ($trek['name'] ?? 'trek')));
header('Content-Type: text/plain; charset=utf-8');
header('Content-Disposition: attachment; filename="' . trim($filename, '-') . '-checklist.txt"');
echo "\xEF\xBB\xBF" . implode("\r\n", $lines);