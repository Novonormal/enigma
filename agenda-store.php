<?php
declare(strict_types=1);

const ENIGMA_AGENDA_DAYS = [
  'terca' => 'Terça',
  'quarta' => 'Quarta',
  'quinta' => 'Quinta',
  'sexta' => 'Sexta',
  'sabado' => 'Sábado',
  'domingo' => 'Domingo',
];

function enigma_root_path(string $relative = ''): string
{
  $base = __DIR__;
  return $relative === '' ? $base : $base . '/' . ltrim($relative, '/');
}

function enigma_public_url(string $relative): string
{
  return '/' . ltrim(str_replace('\\', '/', $relative), '/');
}

function enigma_upload_dir(): string
{
  return enigma_root_path('uploads/agenda');
}

function enigma_manifest_file(): string
{
  return enigma_root_path('uploads/agenda/agenda.json');
}

function enigma_empty_agenda(): array
{
  return [
    'updatedAt' => null,
    'days' => array_fill_keys(array_keys(ENIGMA_AGENDA_DAYS), null),
  ];
}

function enigma_ensure_storage(): void
{
  if (!is_dir(enigma_upload_dir())) {
    mkdir(enigma_upload_dir(), 0775, true);
  }
}

function enigma_load_agenda(): array
{
  enigma_ensure_storage();
  $file = enigma_manifest_file();
  if (!is_file($file)) {
    return enigma_empty_agenda();
  }
  $data = json_decode((string) file_get_contents($file), true);
  if (!is_array($data)) {
    return enigma_empty_agenda();
  }
  return array_replace_recursive(enigma_empty_agenda(), $data);
}

function enigma_save_agenda(array $agenda): void
{
  enigma_ensure_storage();
  file_put_contents(enigma_manifest_file(), json_encode($agenda, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
}

function enigma_public_agenda(array $agenda): array
{
  $days = [];
  foreach (array_keys(ENIGMA_AGENDA_DAYS) as $day) {
    $item = $agenda['days'][$day] ?? null;
    if (!is_array($item) || empty($item['filename'])) {
      $days[$day] = null;
      continue;
    }
    $updated = $item['updatedAt'] ?? $agenda['updatedAt'] ?? null;
    $days[$day] = [
      'filename' => $item['filename'],
      'mime' => $item['mime'] ?? null,
      'updatedAt' => $updated,
      'src' => enigma_public_url('uploads/agenda/' . $item['filename']) . ($updated ? '?v=' . rawurlencode((string) $updated) : ''),
    ];
  }

  return [
    'updatedAt' => $agenda['updatedAt'] ?? null,
    'days' => $days,
  ];
}

function enigma_day_label(string $day): string
{
  return ENIGMA_AGENDA_DAYS[$day] ?? ucfirst($day);
}

function enigma_day_order(): array
{
  return array_keys(ENIGMA_AGENDA_DAYS);
}

function enigma_detect_image_extension(string $mime, string $name): ?string
{
  $mimeMap = [
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/webp' => 'webp',
  ];

  if (isset($mimeMap[$mime])) {
    return $mimeMap[$mime];
  }

  $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
  return in_array($ext, ['jpg', 'jpeg', 'png', 'webp'], true) ? ($ext === 'jpeg' ? 'jpg' : $ext) : null;
}

function enigma_clean_uploaded_name(string $name): string
{
  $name = preg_replace('/[^a-zA-Z0-9._-]+/', '-', $name) ?? 'file';
  return trim($name, '-._');
}
