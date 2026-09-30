# Climb Nepal Guide Checklist

The Guide Checklist is a PHP and vanilla JavaScript workspace linked from the main site. It stores each trek as a JSON file under `data/treks/` and builds its checklist from `todos.php`.

## Hosting

- Deploy the site to a PHP-enabled host running PHP 7.4 or newer.
- Ensure the PHP process can create and write files in `data/treks/`.
- Keep web-server directory listing disabled. The included `.htaccess` blocks direct access to stored treks on Apache; configure an equivalent deny rule if using Nginx.
- Open `guide.html` from the site. On a PHP-enabled host, it uses the PHP API and JSON files automatically. On static hosting or when opened locally, it falls back to browser storage, which is saved only in that browser and is not shared between devices.

No database or build step is required. Checklist definitions can be changed in `todos.php`; each trek gets its own copy when created, so later catalog edits do not overwrite existing treks.

## Features

- Create, switch between and delete treks.
- Autosave task completion, task notes, general notes, emergency notes and trek status.
- Add custom tasks and reusable daily trek checklists.
- Search and filter tasks, reset a category or trek, print, and download a UTF-8 TXT checklist.

Trek deletion and reset actions require confirmation. Server input is validated, output is rendered with DOM text nodes, and API writes use a session token and file locks.
