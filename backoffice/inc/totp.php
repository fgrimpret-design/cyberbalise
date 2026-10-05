<?php
declare(strict_types=1);
/* Double authentification TOTP (RFC 6238) compatible Google Authenticator, Microsoft Authenticator, 2FAS… */
function b32_encode(string $bin): string {
    $a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; $bits = ''; $out = '';
    foreach (str_split($bin) as $c) $bits .= str_pad(decbin(ord($c)), 8, '0', STR_PAD_LEFT);
    foreach (str_split($bits, 5) as $chunk) $out .= $a[bindec(str_pad($chunk, 5, '0'))];
    return $out;
}
function b32_decode(string $s): string {
    $a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; $bits = ''; $out = '';
    foreach (str_split(strtoupper(preg_replace('/[^A-Za-z2-7]/', '', $s))) as $c) $bits .= str_pad(decbin(strpos($a, $c)), 5, '0', STR_PAD_LEFT);
    foreach (str_split($bits, 8) as $byte) if (strlen($byte) === 8) $out .= chr(bindec($byte));
    return $out;
}
function totp_code(string $secret, int $slice): string {
    $h = hash_hmac('sha1', pack('N*', 0, $slice), b32_decode($secret), true);
    $o = ord($h[19]) & 0xf;
    $n = ((ord($h[$o]) & 0x7f) << 24) | (ord($h[$o + 1]) << 16) | (ord($h[$o + 2]) << 8) | ord($h[$o + 3]);
    return str_pad((string)($n % 1000000), 6, '0', STR_PAD_LEFT);
}
function totp_verify(string $secret, string $code): bool {
    $code = preg_replace('/\D/', '', $code);
    if (strlen($code) !== 6 || $secret === '') return false;
    $t = intdiv(time(), 30);
    for ($i = -1; $i <= 1; $i++) if (hash_equals(totp_code($secret, $t + $i), $code)) return true;
    return false;
}
function totp_new_secret(): string { return b32_encode(random_bytes(20)); }
function totp_uri(string $secret, string $email): string {
    $iss = rawurlencode(cfg('site_name') . ' BO');
    return 'otpauth://totp/' . $iss . ':' . rawurlencode($email) . '?secret=' . $secret . '&issuer=' . $iss . '&digits=6&period=30';
}
