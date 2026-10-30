#!/usr/bin/env python3
"""Applique les notes Trustpilot de scripts/trustpilot.json aux pages du site.

Le script est idempotent : il insère les blocs manquants et met à jour ceux qui
existent déjà (repérés par l'attribut data-tp="<identifiant>").

Usage :
    python scripts/trustpilot_apply.py            # applique les notes
    python scripts/trustpilot_apply.py --dry-run  # affiche ce qui changerait
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = json.loads((Path(__file__).resolve().parent / "trustpilot.json").read_text(encoding="utf-8"))
PRODUCTS = DATA["produits"]
MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août",
        "septembre", "octobre", "novembre", "décembre"]
CSS_LINK = '<link rel="stylesheet" href="/assets/trustpilot.css?v=20261031-trustpilot">'

CATEGORIES = {
    "vpn": {
        "comparatif": "offres/vpn/index.html",
        "table_anchor": 'id="en-un-coup-d-oeil"',
        "names": {
            "NordVPN": "nordvpn", "Proton VPN": "protonvpn", "PureVPN": "purevpn",
            "hide.me VPN": "hideme", "Privado VPN": "privado", "FastestVPN": "fastestvpn",
            "Turbo VPN": "turbovpn", "Surfshark": "surfshark", "AdGuard VPN": "adguard",
        },
        "fiches": {
            "offres/vpn/nordvpn/index.html": "nordvpn",
            "offres/vpn/proton-vpn/index.html": "protonvpn",
            "offres/vpn/purevpn/index.html": "purevpn",
            "offres/vpn/hide-me-vpn/index.html": "hideme",
            "offres/vpn/privado-vpn/index.html": "privado",
            "offres/vpn/fastestvpn/index.html": "fastestvpn",
            "offres/vpn/turbo-vpn/index.html": "turbovpn",
            "offres/vpn/surfshark/index.html": "surfshark",
            "offres/vpn/adguard-vpn/index.html": "adguard",
        },
    },
}


def releve_fr() -> str:
    d = date.fromisoformat(DATA["releve"])
    return f"{d.day} {MOIS[d.month - 1]} {d.year}"


def note_fr(pid: str) -> str:
    return f"{PRODUCTS[pid]['note']:.1f}".replace(".", ",")


def avis_fr(pid: str) -> str:
    return f"{PRODUCTS[pid]['avis']:,}".replace(",", "&nbsp;")


def url(pid: str) -> str:
    return f"https://fr.trustpilot.com/review/{PRODUCTS[pid]['domaine']}"


def card_line(pid: str) -> str:
    return (f'<p class="tp-line" data-tp="{pid}"><span class="tp-star" aria-hidden="true">★</span> '
            f'<strong>{note_fr(pid)}</strong>/5 sur Trustpilot '
            f'<span class="tp-count">({avis_fr(pid)} avis)</span></p>')


def table_cell(pid: str) -> str:
    return f'<td data-tp="{pid}"><strong>{note_fr(pid)}</strong>/5 · {avis_fr(pid)}&nbsp;avis</td>'


def hero_line(pid: str) -> str:
    return (f'<p class="tp-hero" data-tp="{pid}"><span class="tp-star" aria-hidden="true">★</span> '
            f'Note Trustpilot de l’éditeur ({PRODUCTS[pid]["entite"]}) : <strong>{note_fr(pid)}/5</strong> '
            f'sur {avis_fr(pid)}&nbsp;avis, relevée le {releve_fr()} · '
            f'<a href="{url(pid)}" target="_blank" rel="noopener noreferrer nofollow">voir la page Trustpilot</a></p>')


def feature_row(pid: str, cls: str) -> str:
    return (f'<tr class="{cls}" data-tp="{pid}">\n<td>Réputation (Trustpilot)</td>\n'
            f'<td>{note_fr(pid)}/5 sur {avis_fr(pid)}&nbsp;avis (note de l’éditeur {PRODUCTS[pid]["entite"]}, '
            f'relevée le {releve_fr()}). Avis de clients non vérifiés par CyberBalise.</td>\n</tr>\n')


def source_item(pid: str) -> str:
    return (f'<li data-tp="{pid}">Trustpilot — page d’évaluation de l’éditeur, note et nombre d’avis relevés '
            f'le {releve_fr()} : {url(pid)}</li>\n')


def table_note() -> str:
    return ('<p class="tp-note" data-tp="note">Notes Trustpilot : note moyenne et nombre d’avis affichés sur la page '
            'Trustpilot de l’éditeur (et non du produit seul), relevés le ' + releve_fr() + ' sur fr.trustpilot.com. '
            'Ce sont des avis de clients que CyberBalise ne vérifie pas ; ils évoluent et ne remplacent pas notre analyse.</p>')


def add_css(text: str) -> str:
    if "/assets/trustpilot.css" in text:
        return re.sub(r'/assets/trustpilot\.css\?v=[^"]*', "/assets/trustpilot.css?v=20261031-trustpilot", text)
    m = re.search(r'<link rel="stylesheet" href="/assets/site-spacing\.css[^"]*">', text)
    if not m:
        raise SystemExit("lien site-spacing.css introuvable")
    return text[:m.end()] + CSS_LINK + text[m.end():]


def upsert(text: str, pattern: str, new: str, insert_at) -> tuple[str, bool]:
    """Remplace le bloc existant (pattern) ou l'insère via insert_at(text) -> index."""
    m = re.search(pattern, text, re.S)
    if m:
        return text[:m.start()] + new + text[m.end():], True
    idx = insert_at(text)
    if idx is None:
        return text, False
    return text[:idx] + new + text[idx:], True


def process_comparatif(cat: dict, text: str, log: list[str]) -> str:
    # 1. lignes dans les cartes
    def repl_card(m):
        block = m.group(0)
        alt = re.search(r'<img[^>]*alt="([^"]*)"', block)
        pid = cat["names"].get(alt.group(1)) if alt else None
        if not pid:
            return block
        pattern = r'<p class="tp-line" data-tp="%s">.*?</p>\s*' % pid
        if re.search(pattern, block, re.S):
            return re.sub(pattern, card_line(pid) + "\n        ", block, flags=re.S)
        return re.sub(r'(</div>\s*)(<p class="vpn-(?:users|feature)")',
                      lambda mm: mm.group(1) + card_line(pid) + "\n        " + mm.group(2), block, count=1)
    text, n = re.subn(r'<a [^>]*class="vpn-card">.*?</a>', repl_card, text, flags=re.S)
    log.append(f"cartes traitées : {n}")

    # 2. colonne dans le tableau récapitulatif
    a = text.index(cat["table_anchor"])
    b = text.index("</table>", a)
    table = text[a:b]
    if "Note Trustpilot" not in table:
        table = re.sub(r'(<tr class="header">.*?)(</tr>)', r'\1<th>Note Trustpilot (éditeur)</th>\n\2', table, count=1, flags=re.S)

    def repl_row(m):
        row = m.group(0)
        first = re.search(r'<td>([^<]*)</td>', row)
        pid = cat["names"].get((first.group(1) if first else "").strip())
        if not pid:
            return row
        if re.search(r'<td data-tp="%s">.*?</td>' % pid, row, re.S):
            return re.sub(r'<td data-tp="%s">.*?</td>' % pid, table_cell(pid), row, flags=re.S)
        return row.replace("</tr>", table_cell(pid) + "\n</tr>", 1)
    table = re.sub(r'<tr class="(?:odd|even)">.*?</tr>', repl_row, table, flags=re.S)
    text = text[:a] + table + text[b:]

    # 3. note de bas de tableau
    end = text.index("</table></div>", text.index(cat["table_anchor"])) + len("</table></div>")
    if 'data-tp="note"' in text[end:end + 1200]:
        text = re.sub(r'<p class="tp-note" data-tp="note">.*?</p>', table_note(), text, count=1, flags=re.S)
    else:
        text = text[:end] + "\n" + table_note() + text[end:]
    return add_css(text)


def process_fiche(pid: str, text: str, log: list[str]) -> str:
    # 1. ligne dans l'en-tête, avant le bouton d'offre
    text, ok = upsert(text, r'<p class="tp-hero" data-tp="%s">.*?</p>\s*' % pid, hero_line(pid) + "\n",
                      lambda t: (t.index('<div class="provider-cta-section">')
                                 if '<div class="provider-cta-section">' in t else None))
    log.append("en-tête " + ("ok" if ok else "ANCRE ABSENTE"))

    # 2. ligne dans le tableau « Caractéristiques »
    def feature_anchor(t):
        a = t.find('<h2 id="caracteristiques-principales">')
        return t.find("</tbody>", a) if a >= 0 else None
    m = re.search(r'<tr class="(odd|even)" data-tp="%s">' % pid, text)
    if m:
        text = re.sub(r'<tr class="(odd|even)" data-tp="%s">.*?</tr>\n' % pid,
                      lambda mm: feature_row(pid, mm.group(1)), text, flags=re.S)
        log.append("tableau mis à jour")
    else:
        idx = feature_anchor(text)
        if idx is None:
            log.append("tableau : ANCRE ABSENTE")
        else:
            a = text.index('<h2 id="caracteristiques-principales">')
            n = len(re.findall(r'<tr class="(?:odd|even)"', text[a:idx]))
            text = text[:idx] + feature_row(pid, "odd" if (n + 1) % 2 else "even") + text[idx:]
            log.append("tableau : ligne ajoutée")

    # 3. source citée
    def source_anchor(t):
        a = t.find('<h2 id="sources-et-methodologie">')
        return t.find("</ul>", a) if a >= 0 else None
    text, ok = upsert(text, r'<li data-tp="%s">.*?</li>\n' % pid, source_item(pid), source_anchor)
    log.append("source " + ("ok" if ok else "ANCRE ABSENTE"))
    return add_css(text)


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="Applique les notes Trustpilot aux pages du site.")
    parser.add_argument("--dry-run", action="store_true", help="n'écrit aucun fichier")
    args = parser.parse_args()
    changed = 0
    for name, cat in CATEGORIES.items():
        jobs = [(cat["comparatif"], lambda t, l: process_comparatif(cat, t, l))]
        jobs += [(rel, (lambda pid: lambda t, l: process_fiche(pid, t, l))(pid)) for rel, pid in cat["fiches"].items()]
        for rel, fn in jobs:
            path = ROOT / rel
            raw = path.read_bytes().decode("utf-8")
            nl = "\r\n" if "\r\n" in raw else "\n"
            log: list[str] = []
            new = fn(raw.replace("\r\n", "\n"), log).replace("\n", nl)
            status = "inchangé" if new == raw else "modifié"
            if new != raw:
                changed += 1
                if not args.dry_run:
                    path.write_bytes(new.encode("utf-8"))
            print(f"[{name}] {rel} : {status} ({'; '.join(log)})")
    print(f"\n{changed} page(s) {'à modifier' if args.dry_run else 'modifiée(s)'} — relevé du {releve_fr()}.")


if __name__ == "__main__":
    main()
