<?php
declare(strict_types=1);
require __DIR__ . '/inc/bootstrap.php';
require_once __DIR__ . '/inc/layout.php';
$me = require_login('admin');
$pdo = db();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $a = $_POST['action'] ?? '';
    $id = (int)($_POST['id'] ?? 0);
    try {
        if ($a === 'create') {
            $email = strtolower(trim((string)$_POST['email'])); $name = trim((string)$_POST['name']);
            $role = $_POST['role'] === 'admin' ? 'admin' : 'editeur';
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) throw new RuntimeException('Adresse e-mail invalide.');
            if ($name === '') throw new RuntimeException('Indiquez un nom.');
            $pass = rtrim(strtr(base64_encode(random_bytes(12)), '+/', 'Kx'), '=');
            $pdo->prepare('INSERT INTO cr_users (email, name, pass_hash, role, created_at) VALUES (?,?,?,?,?)')->execute([$email, $name, password_hash($pass, PASSWORD_DEFAULT), $role, time()]);
            log_action('Utilisateur créé', $email, $role);
            $_SESSION['newpass'] = [$email, $pass];
        } elseif ($a === 'reset') {
            $pass = rtrim(strtr(base64_encode(random_bytes(12)), '+/', 'Kx'), '=');
            $st = $pdo->prepare('SELECT email FROM cr_users WHERE id = ?'); $st->execute([$id]); $email = $st->fetchColumn();
            if (!$email) throw new RuntimeException('Utilisateur introuvable.');
            $pdo->prepare("UPDATE cr_users SET pass_hash = ?, totp_secret = '' WHERE id = ?")->execute([password_hash($pass, PASSWORD_DEFAULT), $id]);
            log_action('Mot de passe réinitialisé', (string)$email);
            $_SESSION['newpass'] = [$email, $pass];
        } elseif ($a === 'role') {
            if ($id === (int)$me['id']) throw new RuntimeException('Vous ne pouvez pas modifier votre propre rôle.');
            $pdo->prepare('UPDATE cr_users SET role = ? WHERE id = ?')->execute([$_POST['role'] === 'admin' ? 'admin' : 'editeur', $id]);
            log_action('Rôle modifié', (string)$id, (string)$_POST['role']);
            flash('ok', 'Rôle mis à jour.');
        } elseif ($a === 'delete') {
            if ($id === (int)$me['id']) throw new RuntimeException('Vous ne pouvez pas supprimer votre propre compte.');
            $pdo->prepare('DELETE FROM cr_users WHERE id = ?')->execute([$id]);
            log_action('Utilisateur supprimé', (string)$id);
            flash('ok', 'Compte supprimé.');
        }
    } catch (PDOException $e) { flash('err', 'Cette adresse e-mail est déjà utilisée.'); }
    catch (Throwable $t) { flash('err', $t->getMessage()); }
    redirect(url('users.php'));
}

$users = $pdo->query('SELECT * FROM cr_users ORDER BY role, name')->fetchAll();
$np = $_SESSION['newpass'] ?? null; unset($_SESSION['newpass']);
layout_start('Utilisateurs', 'users.php');
?>
<?php if ($np): ?>
<div class="card" style="border-color:rgba(228,87,46,.4);margin-bottom:16px" role="status">
  <h2>Mot de passe provisoire pour <?= e($np[0]) ?></h2>
  <p class="row"><code class="mono" style="font-size:18px;background:#081522;padding:8px 12px;border-radius:8px;user-select:all"><?= e($np[1]) ?></code><button class="btn sm" onclick="navigator.clipboard.writeText('<?= e($np[1]) ?>');this.textContent='Copié'">Copier</button></p>
  <p class="muted small" style="margin:0">Affiché une seule fois. Transmettez-le par un canal sûr (pas dans le même e-mail que l'adresse du back office) et demandez à la personne de le changer dès sa première connexion.</p>
</div>
<?php endif; ?>
<div class="grid g-main">
  <div class="card" style="padding:6px 8px"><div class="tbl-wrap"><table>
    <thead><tr><th>Nom</th><th>Rôle</th><th>2FA</th><th>Dernière connexion</th><th></th></tr></thead><tbody>
    <?php foreach ($users as $x): ?><tr>
      <td><strong><?= e($x['name']) ?></strong><span class="dim small" style="display:block"><?= e($x['email']) ?></span></td>
      <td><?php if ((int)$x['id'] === (int)$me['id']): ?><span class="badge ok">Administrateur (vous)</span><?php else: ?>
        <form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="role"><input type="hidden" name="id" value="<?= (int)$x['id'] ?>">
        <select name="role" onchange="this.form.submit()" aria-label="Rôle de <?= e($x['name']) ?>" style="width:auto"><option value="editeur">Éditeur</option><option value="admin" <?= $x['role'] === 'admin' ? 'selected' : '' ?>>Administrateur</option></select></form><?php endif; ?></td>
      <td><?= $x['totp_secret'] !== '' ? '<span class="badge ok">Activée</span>' : '<span class="badge ko">Non</span>' ?></td>
      <td class="small muted"><?= $x['last_login'] ? e(fr_date((int)$x['last_login'])) : 'Jamais' ?></td>
      <td style="text-align:right;white-space:nowrap"><?php if ((int)$x['id'] !== (int)$me['id']): ?>
        <form method="post" style="display:inline" onsubmit="return confirm('Générer un nouveau mot de passe pour <?= e($x['name']) ?> ? Sa double authentification sera aussi réinitialisée.')"><?= csrf_field() ?><input type="hidden" name="action" value="reset"><input type="hidden" name="id" value="<?= (int)$x['id'] ?>"><button class="btn sm">Réinitialiser</button></form>
        <form method="post" style="display:inline" onsubmit="return confirm('Supprimer le compte de <?= e($x['name']) ?> ?')"><?= csrf_field() ?><input type="hidden" name="action" value="delete"><input type="hidden" name="id" value="<?= (int)$x['id'] ?>"><button class="btn sm danger">Supprimer</button></form>
      <?php endif; ?></td></tr><?php endforeach; ?>
    </tbody></table></div></div>
  <form method="post" class="card"><?= csrf_field() ?><input type="hidden" name="action" value="create">
    <h2>Ajouter un membre</h2>
    <div class="field"><label for="n">Nom</label><input id="n" name="name" type="text" required maxlength="80"></div>
    <div class="field"><label for="m">E-mail</label><input id="m" name="email" type="email" required></div>
    <div class="field"><label for="r">Rôle</label><select id="r" name="role"><option value="editeur">Éditeur</option><option value="admin">Administrateur</option></select>
      <p class="help"><strong>Éditeur</strong> : statistiques, contenu des pages, médias. <strong>Administrateur</strong> : en plus, code source, menu, suppression, utilisateurs, réglages.</p></div>
    <button class="btn pri">Créer le compte</button>
  </form>
</div>
<?php layout_end();
