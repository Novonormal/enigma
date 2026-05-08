<?php
declare(strict_types=1);
session_start();
require_once __DIR__ . '/../agenda-store.php';

$adminUser = getenv('ADMIN_USER') ?: 'admin';
$adminPass = getenv('ADMIN_PASS') ?: 'enigma2026';
$uploadDir = enigma_upload_dir();
$agenda = enigma_load_agenda();
$days = enigma_day_order();
$currentDay = $_GET['day'] ?? $_POST['day'] ?? 'segunda';
if (!in_array($currentDay, $days, true)) {
  $currentDay = 'segunda';
}

function adm_flash(string $message): void
{
  $_SESSION['adm_flash'] = $message;
}

function adm_take_flash(): string
{
  $message = $_SESSION['adm_flash'] ?? '';
  unset($_SESSION['adm_flash']);
  return (string) $message;
}

function adm_is_logged(): bool
{
  return !empty($_SESSION['enigma_admin']);
}

function adm_require_login(string $user, string $pass, string $adminUser, string $adminPass): bool
{
  return hash_equals($adminUser, $user) && hash_equals($adminPass, $pass);
}

function adm_day_item(array $agenda, string $day): ?array
{
  $item = $agenda['days'][$day] ?? null;
  return is_array($item) ? $item : null;
}

function adm_delete_file(string $absolutePath): void
{
  if (is_file($absolutePath)) {
    unlink($absolutePath);
  }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $action = $_POST['action'] ?? '';

  if ($action === 'login') {
    $user = trim((string) ($_POST['user'] ?? ''));
    $pass = (string) ($_POST['pass'] ?? '');
    if (adm_require_login($user, $pass, $adminUser, $adminPass)) {
      $_SESSION['enigma_admin'] = ['user' => $user];
      adm_flash('Entrada liberada.');
      header('Location: /adm?day=' . urlencode($currentDay));
      exit;
    }
    adm_flash('Login errado.');
    header('Location: /adm');
    exit;
  }

  if ($action === 'logout') {
    session_destroy();
    header('Location: /adm');
    exit;
  }

  if (!adm_is_logged()) {
    adm_flash('Precisa login.');
    header('Location: /adm');
    exit;
  }

  if ($action === 'upload') {
    if (!isset($_FILES['flyer']) || !is_array($_FILES['flyer']) || ($_FILES['flyer']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
      adm_flash('Arquivo falhou.');
      header('Location: /adm?day=' . urlencode($currentDay));
      exit;
    }

    $mime = (string) ($_FILES['flyer']['type'] ?? '');
    $name = (string) ($_FILES['flyer']['name'] ?? 'file');
    $ext = enigma_detect_image_extension($mime, $name);
    if ($ext === null) {
      adm_flash('Use JPG, PNG ou WebP.');
      header('Location: /adm?day=' . urlencode($currentDay));
      exit;
    }

    enigma_ensure_storage();
    $agenda = enigma_load_agenda();
    $old = adm_day_item($agenda, $currentDay);
    $filename = $currentDay . '.' . $ext;
    $target = $uploadDir . '/' . $filename;

    if (!move_uploaded_file((string) $_FILES['flyer']['tmp_name'], $target)) {
      adm_flash('Não salvou.');
      header('Location: /adm?day=' . urlencode($currentDay));
      exit;
    }

    if (!empty($old['filename']) && $old['filename'] !== $filename) {
      adm_delete_file($uploadDir . '/' . $old['filename']);
    }

    $agenda['days'][$currentDay] = [
      'filename' => $filename,
      'mime' => $mime,
      'updatedAt' => gmdate('c'),
    ];
    $agenda['updatedAt'] = gmdate('c');
    enigma_save_agenda($agenda);
    adm_flash('Flyer salvo.');
    header('Location: /adm?day=' . urlencode($currentDay));
    exit;
  }

  if ($action === 'remove') {
    $agenda = enigma_load_agenda();
    $old = adm_day_item($agenda, $currentDay);
    if (!empty($old['filename'])) {
      adm_delete_file($uploadDir . '/' . $old['filename']);
    }
    $agenda['days'][$currentDay] = null;
    $agenda['updatedAt'] = gmdate('c');
    enigma_save_agenda($agenda);
    adm_flash('Flyer removido.');
    header('Location: /adm?day=' . urlencode($currentDay));
    exit;
  }
}

$logged = adm_is_logged();
$flash = adm_take_flash();
$selected = adm_day_item($agenda, $currentDay);
$previewSrc = !empty($selected['filename']) ? enigma_public_url('uploads/agenda/' . $selected['filename']) . '?v=' . rawurlencode((string) ($selected['updatedAt'] ?? $agenda['updatedAt'] ?? time())) : '';
?>
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Admin Agenda | Enigma</title>
    <link rel="shortcut icon" href="../favicon.ico?v=kiss-20260506">
    <link rel="stylesheet" href="../styles.css">
    <link rel="stylesheet" href="adm.css">
  </head>
  <body>
    <main class="adm-shell">
      <?php if (!$logged): ?>
        <section class="adm-card">
          <h1>Agenda Enigma</h1>
          <p>Login administrativo.</p>
          <?php if ($flash !== ''): ?><p class="adm-status"><?= htmlspecialchars($flash, ENT_QUOTES, 'UTF-8') ?></p><?php endif; ?>
          <form method="post" class="adm-login">
            <input type="hidden" name="action" value="login">
            <label>Usuário<input name="user" autocomplete="username" required></label>
            <label>Senha<input name="pass" type="password" autocomplete="current-password" required></label>
            <button class="btn btn-primary" type="submit">Entrar</button>
          </form>
        </section>
      <?php else: ?>
        <section class="adm-panel">
          <div class="adm-top">
            <div><p class="eyebrow">Painel</p><h1>Flyers da semana</h1></div>
            <form method="post">
              <input type="hidden" name="action" value="logout">
              <button class="btn btn-secondary" type="submit">Sair</button>
            </form>
          </div>
          <?php if ($flash !== ''): ?><p class="adm-status"><?= htmlspecialchars($flash, ENT_QUOTES, 'UTF-8') ?></p><?php endif; ?>
          <div class="adm-tabs">
            <?php foreach ($days as $day): ?>
              <a class="adm-tab <?= $day === $currentDay ? 'is-active' : '' ?>" href="/adm?day=<?= urlencode($day) ?>"><?= htmlspecialchars(enigma_day_label($day), ENT_QUOTES, 'UTF-8') ?></a>
            <?php endforeach; ?>
          </div>
          <div class="adm-grid">
            <form class="adm-card" method="post" enctype="multipart/form-data">
              <input type="hidden" name="action" value="upload">
              <input type="hidden" name="day" value="<?= htmlspecialchars($currentDay, ENT_QUOTES, 'UTF-8') ?>">
              <h2><?= htmlspecialchars(enigma_day_label($currentDay), ENT_QUOTES, 'UTF-8') ?></h2>
              <label>Imagem JPG, PNG ou WebP<input id="flyer-file" name="flyer" type="file" accept="image/jpeg,image/png,image/webp" required></label>
              <button class="btn btn-primary" type="submit">Salvar flyer</button>
            </form>
            <section class="adm-card">
              <h2>Preview</h2>
              <div class="adm-preview" id="preview"><?= $previewSrc !== '' ? '<img src="' . htmlspecialchars($previewSrc, ENT_QUOTES, 'UTF-8') . '" alt="Preview do flyer">' : '<span>Sem evento</span>' ?></div>
              <form method="post">
                <input type="hidden" name="action" value="remove">
                <input type="hidden" name="day" value="<?= htmlspecialchars($currentDay, ENT_QUOTES, 'UTF-8') ?>">
                <button class="btn btn-secondary" type="submit">Remover</button>
              </form>
              <p class="adm-status" id="panel-status"><?= htmlspecialchars($flash !== '' ? $flash : '', ENT_QUOTES, 'UTF-8') ?></p>
            </section>
          </div>
        </section>
      <?php endif; ?>
    </main>
    <script>
      const fileInput = document.getElementById('flyer-file');
      const preview = document.getElementById('preview');
      if (fileInput && preview) {
        fileInput.addEventListener('change', () => {
          const file = fileInput.files && fileInput.files[0];
          if (!file) return;
          const url = URL.createObjectURL(file);
          preview.innerHTML = '<img src="' + url + '" alt="Preview do flyer">';
        });
      }
    </script>
  </body>
</html>
