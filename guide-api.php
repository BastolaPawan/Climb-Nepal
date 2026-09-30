<?php
declare(strict_types=1);

session_start();
require_once __DIR__ . '/todos.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

const GUIDE_DATA_DIR = __DIR__ . '/data/treks';

function respond(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function trek_path(string $id): string
{
    if (!preg_match('/^[a-f0-9-]{36}$/i', $id)) {
        respond(['error' => 'Invalid trek identifier.'], 400);
    }
    return GUIDE_DATA_DIR . DIRECTORY_SEPARATOR . strtolower($id) . '.json';
}

function read_trek(string $id): array
{
    $path = trek_path($id);
    if (!is_file($path)) {
        respond(['error' => 'Trek not found.'], 404);
    }
    $handle = fopen($path, 'rb');
    if (!$handle || !flock($handle, LOCK_SH)) {
        if ($handle) fclose($handle);
        respond(['error' => 'Could not read trek data.'], 500);
    }
    $json = stream_get_contents($handle);
    flock($handle, LOCK_UN);
    fclose($handle);
    $trek = json_decode((string) $json, true);
    if (!is_array($trek)) respond(['error' => 'Trek data is invalid.'], 500);
    return $trek;
}

function write_trek(array $trek): void
{
    $path = trek_path((string) ($trek['id'] ?? ''));
    $handle = fopen($path, 'c+b');
    if (!$handle || !flock($handle, LOCK_EX)) {
        if ($handle) fclose($handle);
        respond(['error' => 'Could not save trek data. Check server folder permissions.'], 500);
    }
    $json = json_encode($trek, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false || !ftruncate($handle, 0) || !rewind($handle) || fwrite($handle, $json) === false || !fflush($handle)) {
        flock($handle, LOCK_UN);
        fclose($handle);
        respond(['error' => 'Could not write trek data.'], 500);
    }
    flock($handle, LOCK_UN);
    fclose($handle);
}

function clean_text($value, int $max = 500): string
{
    if (!is_string($value)) return '';
    $value = trim(strip_tags($value));
    if (function_exists('mb_substr')) return mb_substr($value, 0, $max);
    return preg_match('/^.{0,' . $max . '}/us', $value, $matches) ? $matches[0] : '';
}

function default_tasks(): array
{
    $tasks = [];
    foreach (guide_checklist_definitions() as $category => $definition) {
        foreach ($definition['tasks'] as $index => $title) {
            $tasks[] = ['id' => $category . '-' . $index, 'category' => $category,
                'title' => $title, 'done' => false, 'note' => '', 'custom' => false];
        }
    }
    return $tasks;
}

function validate_date(string $date): bool
{
    $parsed = DateTime::createFromFormat('Y-m-d', $date);
    return $parsed && $parsed->format('Y-m-d') === $date;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (empty($_SESSION['guide_csrf'])) $_SESSION['guide_csrf'] = bin2hex(random_bytes(32));
    $treks = [];
    if (is_dir(GUIDE_DATA_DIR)) {
        foreach (glob(GUIDE_DATA_DIR . DIRECTORY_SEPARATOR . '*.json') ?: [] as $file) {
            $data = json_decode((string) file_get_contents($file), true);
            if (is_array($data) && isset($data['id'], $data['name'])) $treks[] = $data;
        }
    }
    usort($treks, static fn($a, $b) => strcmp((string) ($b['updatedAt'] ?? ''), (string) ($a['updatedAt'] ?? '')));
    respond(['csrf' => $_SESSION['guide_csrf'], 'treks' => $treks, 'definitions' => guide_checklist_definitions()]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') respond(['error' => 'Method not allowed.'], 405);
$input = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($input)) respond(['error' => 'Request body must be valid JSON.'], 400);
if (empty($_SESSION['guide_csrf']) || !isset($input['csrf']) || !hash_equals((string) $_SESSION['guide_csrf'], (string) $input['csrf'])) {
    respond(['error' => 'Session expired. Reload the page and try again.'], 403);
}
$action = (string) ($input['action'] ?? '');

if ($action === 'create') {
    $name = clean_text($input['name'] ?? '', 100);
    $destination = clean_text($input['destination'] ?? '', 120);
    $start = (string) ($input['startDate'] ?? '');
    $end = (string) ($input['endDate'] ?? '');
    $guests = filter_var($input['guests'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 1000]]);
    if ($name === '' || $destination === '' || !$guests || !validate_date($start) || !validate_date($end) || $end < $start) {
        respond(['error' => 'Enter a trek name, destination, valid dates, and a guest count of at least one.'], 422);
    }
    if (!is_dir(GUIDE_DATA_DIR) && !mkdir(GUIDE_DATA_DIR, 0750, true) && !is_dir(GUIDE_DATA_DIR)) {
        respond(['error' => 'Could not create the trek data folder.'], 500);
    }
    $id = bin2hex(random_bytes(16));
    $id = substr($id, 0, 8) . '-' . substr($id, 8, 4) . '-4' . substr($id, 13, 3) . '-a' . substr($id, 17, 3) . '-' . substr($id, 20, 12);
    $trek = ['id' => $id, 'name' => $name, 'destination' => $destination, 'startDate' => $start,
        'endDate' => $end, 'guests' => $guests, 'guide' => clean_text($input['guide'] ?? '', 100),
        'assistant' => clean_text($input['assistant'] ?? '', 100), 'agency' => clean_text($input['agency'] ?? '', 120),
        'notes' => clean_text($input['notes'] ?? '', 3000), 'emergencyNotes' => '', 'status' => 'preparation',
        'tasks' => default_tasks(), 'days' => [], 'createdAt' => gmdate(DATE_ATOM), 'updatedAt' => gmdate(DATE_ATOM)];
    write_trek($trek);
    respond(['trek' => $trek]);
}

$id = (string) ($input['trekId'] ?? '');
$trek = read_trek($id);

if ($action === 'delete') {
    if (!is_file(trek_path($id)) || !unlink(trek_path($id))) respond(['error' => 'Could not delete trek.'], 500);
    respond(['deleted' => true]);
}
if ($action === 'task') {
    $taskId = clean_text($input['taskId'] ?? '', 100);
    $found = false;
    foreach ($trek['tasks'] as &$task) {
        if ($task['id'] === $taskId) {
            if (isset($input['done'])) $task['done'] = (bool) $input['done'];
            if (isset($input['note'])) $task['note'] = clean_text($input['note'], 1000);
            $found = true;
            break;
        }
    }
    unset($task);
    if (!$found) respond(['error' => 'Checklist item not found.'], 404);
} elseif ($action === 'add-task') {
    $title = clean_text($input['title'] ?? '', 160);
    $category = clean_text($input['category'] ?? '', 80);
    $allowed = array_keys(guide_checklist_definitions());
    $allowed[] = 'custom';
    if ($title === '' || !in_array($category, $allowed, true)) respond(['error' => 'Choose a category and enter a task name.'], 422);
    $task = ['id' => 'custom-' . bin2hex(random_bytes(8)), 'category' => $category, 'title' => $title,
        'done' => false, 'note' => clean_text($input['note'] ?? '', 1000), 'custom' => true];
    $trek['tasks'][] = $task;
} elseif ($action === 'add-day') {
    $date = (string) ($input['date'] ?? '');
    if (!validate_date($date)) respond(['error' => 'Choose a valid day date.'], 422);
    foreach ($trek['days'] as $day) if ($day['date'] === $date) respond(['error' => 'A daily checklist already exists for this date.'], 422);
    $dayId = 'day-' . str_replace('-', '', $date);
    $trek['days'][] = ['id' => $dayId, 'date' => $date];
    foreach (guide_daily_tasks() as $period => $titles) foreach ($titles as $index => $title) {
        $trek['tasks'][] = ['id' => $dayId . '-' . substr(sha1($period), 0, 5) . '-' . $index,
            'category' => $dayId, 'period' => $period, 'title' => $title, 'done' => false, 'note' => '', 'custom' => false];
    }
} elseif ($action === 'update-trek') {
    foreach (['name' => 100, 'destination' => 120, 'guide' => 100, 'assistant' => 100, 'agency' => 120, 'notes' => 3000, 'emergencyNotes' => 3000] as $field => $limit) {
        if (array_key_exists($field, $input)) $trek[$field] = clean_text($input[$field], $limit);
    }
    if (isset($input['status']) && in_array($input['status'], ['preparation', 'in-progress', 'completed'], true)) $trek['status'] = $input['status'];
} elseif ($action === 'reset-category' || $action === 'reset-all') {
    $category = clean_text($input['category'] ?? '', 80);
    foreach ($trek['tasks'] as &$task) {
        if ($action === 'reset-all' || $task['category'] === $category) {
            $task['done'] = false;
            if (!empty($input['clearNotes'])) $task['note'] = '';
        }
    }
    unset($task);
    if ($action === 'reset-all') $trek['status'] = 'preparation';
} else {
    respond(['error' => 'Unknown action.'], 400);
}

$trek['updatedAt'] = gmdate(DATE_ATOM);
write_trek($trek);
respond(['trek' => $trek]);