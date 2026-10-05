<?php
declare(strict_types=1);
/*
 * Définitions (affichées aussi dans l'interface) :
 *  - Page vue  : un chargement de page par un navigateur réel (robots exclus, équipe exclue).
 *  - Visite    : un visiteur anonyme sur une journée calendaire (l'identifiant change chaque jour).
 *  - Visiteurs : somme des visiteurs uniques de chaque jour (un même internaute revenu 3 jours = 3).
 *  - Rebond    : visite d'une seule page.
 *  - Durée     : temps où l'onglet était visible, moyenné sur les pages vues mesurées.
 */

function period_from_request(): array {
    $p = $_GET['periode'] ?? '30j';
    $today = new DateTimeImmutable('today');
    switch ($p) {
        case 'auj':  $from = $today; $to = $today; break;
        case 'hier': $from = $today->modify('-1 day'); $to = $from; break;
        case '7j':   $from = $today->modify('-6 days'); $to = $today; break;
        case '12m':  $from = $today->modify('first day of this month')->modify('-11 months'); $to = $today; break;
        case 'perso':
            $f = DateTimeImmutable::createFromFormat('!Y-m-d', (string)($_GET['du'] ?? ''));
            $t = DateTimeImmutable::createFromFormat('!Y-m-d', (string)($_GET['au'] ?? ''));
            if ($f && $t && $f <= $t) { $from = $f; $to = $t; break; }
            $p = '30j';
            // no break
        default:     $p = '30j'; $from = $today->modify('-29 days'); $to = $today;
    }
    $days = (int)$from->diff($to)->days + 1;
    $pFrom = $from->modify("-$days days"); $pTo = $from->modify('-1 day');
    $gran = $days === 1 ? 'hour' : ($days > 92 ? 'month' : 'day');
    return ['key' => $p, 'from' => $from->format('Y-m-d'), 'to' => $to->format('Y-m-d'), 'days' => $days,
            'pfrom' => $pFrom->format('Y-m-d'), 'pto' => $pTo->format('Y-m-d'), 'gran' => $gran];
}

function q(string $sql, array $args = []): array { $s = db()->prepare($sql); $s->execute($args); return $s->fetchAll(); }
function q1(string $sql, array $args = []) { $s = db()->prepare($sql); $s->execute($args); return $s->fetchColumn(); }

function summary(string $from, string $to, string $path = ''): array {
    $w = 'day BETWEEN ? AND ?' . ($path !== '' ? ' AND path = ?' : '');
    $a = $path !== '' ? [$from, $to, $path] : [$from, $to];
    $pv = (int)q1("SELECT COUNT(*) FROM cr_hits WHERE $w", $a);
    $visits = (int)q1("SELECT COUNT(*) FROM (SELECT visitor, day FROM cr_hits WHERE $w GROUP BY visitor, day) t", $a);
    $bounce = (int)q1("SELECT COUNT(*) FROM (SELECT visitor, day FROM cr_hits WHERE $w GROUP BY visitor, day HAVING COUNT(*) = 1) t", $a);
    $dur = (float)q1("SELECT AVG(duration) FROM cr_hits WHERE $w AND duration > 0", $a);
    return ['pv' => $pv, 'visits' => $visits, 'ppv' => $visits ? $pv / $visits : 0,
            'bounce' => $visits ? $bounce / $visits * 100 : 0, 'dur' => $dur];
}
function pct_change(float $now, float $before): ?float { return $before > 0 ? ($now - $before) / $before * 100 : null; }

function timeseries(array $P, string $path = ''): array {
    $w = 'day BETWEEN ? AND ?' . ($path !== '' ? ' AND path = ?' : '');
    $a = $path !== '' ? [$P['from'], $P['to'], $path] : [$P['from'], $P['to']];
    $labels = []; $pv = []; $vis = [];
    if ($P['gran'] === 'hour') {
        $rows = q("SELECT hour k, COUNT(*) pv, COUNT(DISTINCT visitor) v FROM cr_hits WHERE $w GROUP BY hour", $a);
        $m = array_column($rows, null, 'k');
        for ($h = 0; $h < 24; $h++) { $labels[] = $h . ' h'; $pv[] = (int)($m[$h]['pv'] ?? 0); $vis[] = (int)($m[$h]['v'] ?? 0); }
    } elseif ($P['gran'] === 'day') {
        $rows = q("SELECT day k, COUNT(*) pv, COUNT(DISTINCT visitor) v FROM cr_hits WHERE $w GROUP BY day", $a);
        $m = array_column($rows, null, 'k');
        for ($d = new DateTime($P['from']); $d->format('Y-m-d') <= $P['to']; $d->modify('+1 day')) {
            $k = $d->format('Y-m-d'); $labels[] = $d->format('d/m');
            $pv[] = (int)($m[$k]['pv'] ?? 0); $vis[] = (int)($m[$k]['v'] ?? 0);
        }
    } else {
        $rows = q("SELECT day, COUNT(*) pv, COUNT(DISTINCT visitor) v FROM cr_hits WHERE $w GROUP BY day", $a);
        $m = [];
        foreach ($rows as $r) { $k = substr($r['day'], 0, 7); $m[$k]['pv'] = ($m[$k]['pv'] ?? 0) + $r['pv']; $m[$k]['v'] = ($m[$k]['v'] ?? 0) + $r['v']; }
        $mois = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
        for ($d = new DateTime(substr($P['from'], 0, 7) . '-01'); $d->format('Y-m') <= substr($P['to'], 0, 7); $d->modify('+1 month')) {
            $k = $d->format('Y-m'); $labels[] = $mois[(int)$d->format('n') - 1] . ' ' . $d->format('y');
            $pv[] = (int)($m[$k]['pv'] ?? 0); $vis[] = (int)($m[$k]['v'] ?? 0);
        }
    }
    return ['labels' => $labels, 'pv' => $pv, 'visitors' => $vis];
}

function top(string $col, array $P, int $limit = 10, string $extraWhere = '', array $extraArgs = []): array {
    $allowed = ['path', 'source', 'ref_host', 'utm_campaign', 'device', 'browser', 'os', 'lang', 'screen'];
    if (!in_array($col, $allowed, true)) return [];
    return q("SELECT $col k, COUNT(*) pv, COUNT(DISTINCT visitor) v, AVG(NULLIF(duration,0)) dur
              FROM cr_hits WHERE day BETWEEN ? AND ? $extraWhere GROUP BY $col ORDER BY pv DESC LIMIT " . (int)$limit,
              array_merge([$P['from'], $P['to']], $extraArgs));
}
function entry_pages(array $P, int $limit = 10): array {
    return q("SELECT path k, COUNT(*) n FROM cr_hits h WHERE day BETWEEN ? AND ?
              AND ts = (SELECT MIN(ts) FROM cr_hits x WHERE x.visitor = h.visitor AND x.day = h.day)
              GROUP BY path ORDER BY n DESC LIMIT " . (int)$limit, [$P['from'], $P['to']]);
}
function heatmap(array $P): array {
    $rows = q('SELECT wd, hour, COUNT(*) n FROM cr_hits WHERE day BETWEEN ? AND ? GROUP BY wd, hour', [$P['from'], $P['to']]);
    $m = array_fill(1, 7, array_fill(0, 24, 0)); $max = 0;
    foreach ($rows as $r) { $m[(int)$r['wd']][(int)$r['hour']] = (int)$r['n']; $max = max($max, (int)$r['n']); }
    return [$m, $max];
}
function events(array $P, int $limit = 15): array {
    return q('SELECT name, value, COUNT(*) n, COUNT(DISTINCT visitor) v FROM cr_events WHERE day BETWEEN ? AND ?
              GROUP BY name, value ORDER BY n DESC LIMIT ' . (int)$limit, [$P['from'], $P['to']]);
}
function live_visitors(): int { return (int)q1('SELECT COUNT(DISTINCT visitor) FROM cr_hits WHERE ts > ?', [time() - 300]); }
function live_pages(): array { return q('SELECT path k, COUNT(DISTINCT visitor) v FROM cr_hits WHERE ts > ? GROUP BY path ORDER BY v DESC LIMIT 5', [time() - 300]); }

function period_selector(array $P, string $extra = ''): string {
    $opts = ['auj' => "Aujourd'hui", 'hier' => 'Hier', '7j' => '7 jours', '30j' => '30 jours', '12m' => '12 mois'];
    $h = '<div class="seg" role="group" aria-label="Période">';
    foreach ($opts as $k => $l) $h .= '<a href="?periode=' . $k . $extra . '" class="' . ($P['key'] === $k ? 'on' : '') . '">' . $l . '</a>';
    $h .= '</div>';
    $h .= '<form class="row" method="get" style="gap:6px">' . ($extra ? '<input type="hidden" name="page" value="' . e($_GET['page'] ?? '') . '">' : '')
        . '<input type="hidden" name="periode" value="perso"><input type="date" name="du" value="' . e($P['from']) . '" aria-label="Du" style="width:auto">'
        . '<input type="date" name="au" value="' . e($P['to']) . '" aria-label="Au" style="width:auto"><button class="btn sm">OK</button></form>';
    return $h;
}
function bar_table(array $rows, string $label, string $valKey = 'pv', ?callable $fmt = null, string $valLabel = 'Vues'): string {
    if (!$rows) return '<p class="empty small">Pas encore de données sur cette période.</p>';
    $max = max(array_map(fn($r) => (int)$r[$valKey], $rows)) ?: 1;
    $h = '<div class="tbl-wrap"><table><thead><tr><th>' . e($label) . '</th><th class="num">' . e($valLabel) . '</th></tr></thead><tbody>';
    foreach ($rows as $r) {
        $k = (string)$r['k']; $txt = $fmt ? $fmt($k, $r) : e($k === '' ? '(non renseigné)' : $k);
        $h .= '<tr><td class="barcell"><i style="width:' . round($r[$valKey] / $max * 100) . '%"></i><span class="trunc">' . $txt . '</span></td><td class="num">' . fr_num($r[$valKey]) . '</td></tr>';
    }
    return $h . '</tbody></table></div>';
}
