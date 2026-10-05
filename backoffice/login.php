<?php
declare(strict_types=1);
require __DIR__ . '/inc/bootstrap.php';
require_once __DIR__ . '/inc/layout.php';
require __DIR__ . '/inc/totp.php';

$pdo = db();
$hasUsers = (int)$pdo->query('SELECT COUNT(*) FROM cr_users')->fetchColumn() > 0;
$ipHash = substr(hash('sha256', secret() . client_ip()), 0, 16);
$retour = (string)($_GET['retour'] ?? $_POST['retour'] ?? '');
if (!str_starts_with($retour, BASE_URL . '/') || str_contains($retour, '//')) $retour = url('index.php');
if (current_user()) redirect($retour);

$error = '';
$step = isset($_SESSION['pending_2fa']) ? '2fa' : 'login';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $st = $pdo->prepare('SELECT COUNT(*) FROM cr_attempts WHERE ip_hash = ? AND ts > ?');
    $st->execute([$ipHash, time() - 900]);
    if ((int)$st->fetchColumn() >= 6) {
        $error = 'Trop de tentatives. Réessayez dans 15 minutes.';
    } elseif (!$hasUsers) {
        // ---------- Création du premier administrateur ----------
        $email = strtolower(trim((string)($_POST['email'] ?? '')));
        $name = trim((string)($_POST['name'] ?? ''));
        $pass = (string)($_POST['password'] ?? '');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $error = 'Adresse e-mail invalide.';
        elseif ($name === '') $error = 'Indiquez votre nom.';
        elseif (mb_strlen($pass) < 12) $error = 'Le mot de passe doit contenir au moins 12 caractères.';
        elseif ($pass !== ($_POST['password2'] ?? '')) $error = 'Les deux mots de passe ne correspondent pas.';
        else {
            $pdo->prepare('INSERT INTO cr_users (email, name, pass_hash, role, created_at) VALUES (?,?,?,?,?)')
                ->execute([$email, $name, password_hash($pass, PASSWORD_DEFAULT), 'admin', time()]);
            session_regenerate_id(true);
            $_SESSION['uid'] = (int)$pdo->lastInsertId();
            preview_cookie_set($_SESSION['uid']);
            log_action('Installation', '', 'Premier compte administrateur créé');
            flash('ok', 'Compte administrateur créé. Pensez à activer la double authentification dans votre profil.');
            redirect(url('index.php'));
        }
    } elseif ($step === '2fa') {
        $p = $_SESSION['pending_2fa'];
        $st = $pdo->prepare('SELECT * FROM cr_users WHERE id = ?'); $st->execute([$p['uid']]); $u = $st->fetch();
        if (!$u || time() - $p['ts'] > 300) { unset($_SESSION['pending_2fa']); $step = 'login'; $error = 'Délai dépassé, reconnectez-vous.'; }
        elseif (totp_verify($u['totp_secret'], (string)($_POST['code'] ?? ''))) {
            unset($_SESSION['pending_2fa']);
            login_ok($u);
        } else {
            $pdo->prepare('INSERT INTO cr_attempts (ip_hash, ts) VALUES (?,?)')->execute([$ipHash, time()]);
            $error = 'Code incorrect. Vérifiez l\'heure de votre téléphone et réessayez.';
        }
    } else {
        $email = strtolower(trim((string)($_POST['email'] ?? '')));
        $st = $pdo->prepare('SELECT * FROM cr_users WHERE email = ?'); $st->execute([$email]); $u = $st->fetch();
        if ($u && password_verify((string)($_POST['password'] ?? ''), $u['pass_hash'])) {
            if (password_needs_rehash($u['pass_hash'], PASSWORD_DEFAULT)) {
                $pdo->prepare('UPDATE cr_users SET pass_hash = ? WHERE id = ?')->execute([password_hash($_POST['password'], PASSWORD_DEFAULT), $u['id']]);
            }
            if ($u['totp_secret'] !== '') {
                session_regenerate_id(true);
                $_SESSION['pending_2fa'] = ['uid' => (int)$u['id'], 'ts' => time()];
                $step = '2fa';
            } else {
                login_ok($u);
            }
        } else {
            $pdo->prepare('INSERT INTO cr_attempts (ip_hash, ts) VALUES (?,?)')->execute([$ipHash, time()]);
            usleep(400000);
            $error = 'E-mail ou mot de passe incorrect.';
        }
    }
}

function login_ok(array $u): void {
    global $retour;
    session_regenerate_id(true);
    $_SESSION['uid'] = (int)$u['id'];
    db()->prepare('UPDATE cr_users SET last_login = ? WHERE id = ?')->execute([time(), $u['id']]);
    preview_cookie_set((int)$u['id']);
    log_action('Connexion');
    redirect($retour);
}

layout_start($hasUsers ? 'Connexion' : 'Installation');
?>
<div class="login">
  <p class="brand"><?= brand_svg() ?><span>CYBER<b>BALISE</b><small>Back office</small></span></p>
  <div class="card">
  <?php if ($error): ?><div class="flash err" role="alert"><?= e($error) ?></div><?php endif; ?>
  <?php if (!$hasUsers): ?>
    <h2>Créer le compte administrateur</h2>
    <p class="muted small" style="margin-top:-6px">Première ouverture du back office. Ce formulaire disparaît dès que le compte est créé.</p>
    <form method="post"><?= csrf_field() ?>
      <div class="field"><label for="name">Votre nom</label><input id="name" name="name" type="text" required autocomplete="name" value="<?= e($_POST['name'] ?? '') ?>"></div>
      <div class="field"><label for="email">E-mail</label><input id="email" name="email" type="email" required autocomplete="email" value="<?= e($_POST['email'] ?? '') ?>"></div>
      <div class="field"><label for="password">Mot de passe</label><input id="password" name="password" type="password" required minlength="12" autocomplete="new-password"><p class="help">12 caractères minimum. Une phrase de passe est idéale.</p></div>
      <div class="field"><label for="password2">Confirmer le mot de passe</label><input id="password2" name="password2" type="password" required minlength="12" autocomplete="new-password"></div>
      <button class="btn pri" type="submit" style="width:100%;justify-content:center">Créer le compte</button>
    </form>
  <?php elseif ($step === '2fa'): ?>
    <h2>Double authentification</h2>
    <p class="muted small" style="margin-top:-6px">Saisissez le code à 6 chiffres affiché dans votre application d'authentification.</p>
    <form method="post"><?= csrf_field() ?><input type="hidden" name="retour" value="<?= e($retour) ?>">
      <div class="field"><label for="code">Code</label><input id="code" name="code" type="text" inputmode="numeric" pattern="[0-9 ]{6,7}" maxlength="7" required autocomplete="one-time-code" autofocus class="mono" style="font-size:20px;letter-spacing:.3em;text-align:center"></div>
      <button class="btn pri" type="submit" style="width:100%;justify-content:center">Vérifier</button>
    </form>
  <?php else: ?>
    <h2>Connexion</h2>
    <form method="post"><?= csrf_field() ?><input type="hidden" name="retour" value="<?= e($retour) ?>">
      <div class="field"><label for="email">E-mail</label><input id="email" name="email" type="email" required autocomplete="username" autofocus value="<?= e($_POST['email'] ?? '') ?>"></div>
      <div class="field"><label for="password">Mot de passe</label><input id="password" name="password" type="password" required autocomplete="current-password"></div>
      <button class="btn pri" type="submit" style="width:100%;justify-content:center">Se connecter</button>
    </form>
  <?php endif; ?>
  </div>
  <p class="dim small" style="text-align:center;margin-top:16px">Mot de passe oublié ? Un administrateur peut le réinitialiser depuis « Utilisateurs ».</p>
</div>
<?php layout_end();
