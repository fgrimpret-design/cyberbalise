<?php
declare(strict_types=1);
require __DIR__ . '/inc/bootstrap.php';
require_once __DIR__ . '/inc/layout.php';
require __DIR__ . '/inc/totp.php';
$u = require_login();
$pdo = db();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $a = $_POST['action'] ?? '';
    if ($a === 'password') {
        $new = (string)$_POST['new'];
        if (!password_verify((string)$_POST['current'], $u['pass_hash'])) flash('err', 'Mot de passe actuel incorrect.');
        elseif (mb_strlen($new) < 12) flash('err', 'Le nouveau mot de passe doit contenir au moins 12 caractères.');
        elseif ($new !== $_POST['new2']) flash('err', 'Les deux mots de passe ne correspondent pas.');
        else { $pdo->prepare('UPDATE cr_users SET pass_hash = ? WHERE id = ?')->execute([password_hash($new, PASSWORD_DEFAULT), $u['id']]); log_action('Mot de passe modifié'); flash('ok', 'Mot de passe modifié.'); }
    } elseif ($a === 'name') {
        $n = trim((string)$_POST['name']);
        if ($n !== '') { $pdo->prepare('UPDATE cr_users SET name = ? WHERE id = ?')->execute([mb_substr($n, 0, 80), $u['id']]); flash('ok', 'Nom mis à jour.'); }
    } elseif ($a === '2fa_on') {
        $sec = (string)($_SESSION['totp_setup'] ?? '');
        if ($sec !== '' && totp_verify($sec, (string)$_POST['code'])) {
            $pdo->prepare('UPDATE cr_users SET totp_secret = ? WHERE id = ?')->execute([$sec, $u['id']]);
            unset($_SESSION['totp_setup']); log_action('Double authentification activée'); flash('ok', 'Double authentification activée. Le code vous sera demandé à chaque connexion.');
        } else flash('err', 'Code incorrect. Vérifiez que l\'heure de votre téléphone est automatique, puis réessayez.');
    } elseif ($a === '2fa_off') {
        if (password_verify((string)$_POST['current'], $u['pass_hash'])) { $pdo->prepare("UPDATE cr_users SET totp_secret = '' WHERE id = ?")->execute([$u['id']]); log_action('Double authentification désactivée'); flash('ok', 'Double authentification désactivée.'); }
        else flash('err', 'Mot de passe incorrect.');
    }
    redirect(url('profil.php'));
}
if ($u['totp_secret'] === '' && empty($_SESSION['totp_setup'])) $_SESSION['totp_setup'] = totp_new_secret();
$setup = $_SESSION['totp_setup'] ?? '';
layout_start('Mon profil', 'profil.php');
?>
<div class="grid g3">
  <form method="post" class="card"><?= csrf_field() ?><input type="hidden" name="action" value="name">
    <h2>Identité</h2>
    <div class="field"><label for="nm">Nom affiché</label><input id="nm" name="name" type="text" value="<?= e($u['name']) ?>" maxlength="80"></div>
    <p class="muted small">E-mail de connexion : <span class="mono"><?= e($u['email']) ?></span><br>Rôle : <?= $u['role'] === 'admin' ? 'Administrateur' : 'Éditeur' ?></p>
    <button class="btn">Enregistrer</button>
  </form>
  <form method="post" class="card"><?= csrf_field() ?><input type="hidden" name="action" value="password">
    <h2>Mot de passe</h2>
    <div class="field"><label for="c">Mot de passe actuel</label><input id="c" name="current" type="password" required autocomplete="current-password"></div>
    <div class="field"><label for="n1">Nouveau (12 caractères min.)</label><input id="n1" name="new" type="password" required minlength="12" autocomplete="new-password"></div>
    <div class="field"><label for="n2">Confirmer</label><input id="n2" name="new2" type="password" required minlength="12" autocomplete="new-password"></div>
    <button class="btn">Changer le mot de passe</button>
  </form>
  <div class="card">
    <h2>Double authentification</h2>
    <?php if ($u['totp_secret'] !== ''): ?>
      <p><span class="badge ok">Activée</span></p>
      <p class="muted small">Un code à 6 chiffres est demandé à chaque connexion.</p>
      <form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="2fa_off">
        <div class="field"><label for="p2">Mot de passe pour désactiver</label><input id="p2" name="current" type="password" required></div>
        <button class="btn danger">Désactiver</button></form>
    <?php else: ?>
      <p class="muted small">Fortement recommandé, surtout pour les administrateurs qui peuvent modifier le code du site.</p>
      <ol class="small muted" style="padding-left:18px"><li>Installez une application (Google Authenticator, Microsoft Authenticator, 2FAS…).</li><li>Scannez ce QR code.</li><li>Saisissez le code affiché.</li></ol>
      <div id="qr" style="background:#fff;padding:10px;border-radius:10px;width:max-content;margin:10px 0"></div>
      <p class="dim small">Saisie manuelle : <span class="mono" style="user-select:all;word-break:break-all"><?= e(trim(chunk_split($setup, 4, ' '))) ?></span></p>
      <form method="post" class="row"><?= csrf_field() ?><input type="hidden" name="action" value="2fa_on">
        <input name="code" type="text" inputmode="numeric" maxlength="7" placeholder="123456" required aria-label="Code à 6 chiffres" class="mono" style="max-width:130px"><button class="btn pri">Activer</button></form>
    <?php endif; ?>
  </div>
</div>
<?php
$uri = json_encode(totp_uri($setup, $u['email']));
layout_end($u['totp_secret'] === '' ? <<<HTML
<script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
<script>new QRCode(document.getElementById('qr'), { text: $uri, width: 168, height: 168 });</script>
HTML : '');
