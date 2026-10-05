<?php
declare(strict_types=1);

function db(): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;
    $c = cfg('db', ['driver' => 'sqlite']);
    if (($c['driver'] ?? 'sqlite') === 'mysql') {
        $pdo = new PDO("mysql:host={$c['host']};dbname={$c['name']};charset=utf8mb4", $c['user'], $c['pass'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        $pdo->exec("SET time_zone = '+00:00'");
        $fresh = !$pdo->query("SHOW TABLES LIKE 'cr_users'")->fetch();
        if ($fresh) db_schema($pdo, 'mysql');
    } else {
        $file = DATA_DIR . '/cyberbalise.sqlite';
        $fresh = !is_file($file);
        $pdo = new PDO('sqlite:' . $file, null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        $pdo->exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 3000;');
        if ($fresh) db_schema($pdo, 'sqlite');
    }
    return $pdo;
}

function db_schema(PDO $pdo, string $drv): void {
    $pk = $drv === 'mysql' ? 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
    $eng = $drv === 'mysql' ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4' : '';
    $tables = [
        "cr_hits (id $pk, ts INT NOT NULL, day CHAR(10) NOT NULL, hour SMALLINT NOT NULL, wd SMALLINT NOT NULL,
            path VARCHAR(200) NOT NULL, visitor CHAR(16) NOT NULL, pvid VARCHAR(32) NOT NULL DEFAULT '',
            ref_host VARCHAR(120) NOT NULL DEFAULT '', source VARCHAR(30) NOT NULL DEFAULT 'Direct',
            utm_campaign VARCHAR(80) NOT NULL DEFAULT '', device VARCHAR(20) NOT NULL DEFAULT '',
            browser VARCHAR(30) NOT NULL DEFAULT '', os VARCHAR(20) NOT NULL DEFAULT '', lang VARCHAR(8) NOT NULL DEFAULT '',
            screen VARCHAR(30) NOT NULL DEFAULT '', duration INT NOT NULL DEFAULT 0)",
        "cr_events (id $pk, ts INT NOT NULL, day CHAR(10) NOT NULL, path VARCHAR(200) NOT NULL, visitor CHAR(16) NOT NULL,
            name VARCHAR(60) NOT NULL, value VARCHAR(200) NOT NULL DEFAULT '')",
        "cr_users (id $pk, email VARCHAR(190) NOT NULL UNIQUE, name VARCHAR(80) NOT NULL, pass_hash VARCHAR(255) NOT NULL,
            role VARCHAR(10) NOT NULL DEFAULT 'editeur', totp_secret VARCHAR(64) NOT NULL DEFAULT '',
            created_at INT NOT NULL, last_login INT NOT NULL DEFAULT 0)",
        "cr_attempts (id $pk, ip_hash CHAR(16) NOT NULL, ts INT NOT NULL)",
        "cr_journal (id $pk, ts INT NOT NULL, user_name VARCHAR(80) NOT NULL, action VARCHAR(60) NOT NULL,
            target VARCHAR(190) NOT NULL DEFAULT '', details VARCHAR(500) NOT NULL DEFAULT '', ip_hash CHAR(12) NOT NULL DEFAULT '')",
    ];
    foreach ($tables as $t) $pdo->exec("CREATE TABLE IF NOT EXISTS $t$eng");
    $idx = ['cr_hits' => ['day', 'path', 'pvid', 'ts'], 'cr_events' => ['day'], 'cr_attempts' => ['ip_hash'], 'cr_journal' => ['ts']];
    foreach ($idx as $tbl => $cols) foreach ($cols as $col) {
        $pdo->exec($drv === 'mysql' ? "ALTER TABLE $tbl ADD INDEX idx_{$tbl}_$col ($col)" : "CREATE INDEX IF NOT EXISTS idx_{$tbl}_$col ON $tbl ($col)");
    }
}
