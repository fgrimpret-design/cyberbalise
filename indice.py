#!/usr/bin/env python3
"""Indice d'usurpabilité des services publics — CyberBalise.
Calcule une note A–F par domaine à partir d'enregistrements DNS publics.
Usage : python3 indice.py domaines.csv  -> resultats.json + resultats.csv"""
import csv, json, subprocess, sys, re, datetime

RESOLVERS = ["1.1.1.1", "8.8.8.8"]

def dig(name, rtype, resolver):
    out = subprocess.run(["dig", f"@{resolver}", "+short", "+time=3", "+tries=2", rtype, name],
                         capture_output=True, text=True).stdout
    return [l.strip() for l in out.splitlines() if l.strip() and not l.startswith(";")]

def txt(name, rtype="TXT"):
    """Union des réponses de deux résolveurs (évite un faux 'absent' ponctuel)."""
    seen = []
    for r in RESOLVERS:
        for l in dig(name, rtype, r):
            v = "".join(re.findall(r'"([^"]*)"', l)) if rtype == "TXT" else l
            if v and v not in seen: seen.append(v)
    return seen

def tags(rec):
    d = {}
    for p in rec.split(";"):
        if "=" in p:
            k, v = p.split("=", 1); d[k.strip().lower()] = v.strip().lower()
    return d

def score(domain):
    det, pts = {}, {}
    # --- DMARC (50) ---
    dm = [r for r in txt(f"_dmarc.{domain}") if r.lower().startswith("v=dmarc1")]
    det["dmarc_brut"] = dm[0] if len(dm) == 1 else (" | ".join(dm) if dm else "")
    if len(dm) != 1:
        pol, sp, pct, t = "absente" if not dm else "invalide (multiple)", None, 100, {}
    else:
        t = tags(dm[0]); pol = t.get("p", "invalide")
        sp = t.get("sp", pol); pct = int(t.get("pct", "100") or 100) if t.get("pct","100").isdigit() else 100
    base = {"reject": 50, "quarantine": 30, "none": 10}.get(pol, 0)
    if pol in ("reject", "quarantine") and pct < 100:
        base = 10 + (base - 10) * pct / 100
    pts["dmarc"] = round(base)
    det["dmarc_politique"] = pol if pct == 100 or pol not in ("reject","quarantine") else f"{pol} (pct={pct})"
    # --- Sous-domaines (10) ---
    pts["sous_domaines"] = {"reject": 10, "quarantine": 6}.get(sp, 0) if dm and len(dm)==1 else 0
    det["sous_domaines"] = sp or "—"
    # --- SPF (20) ---
    spf = [r for r in txt(domain) if r.lower().startswith("v=spf1")]
    if len(spf) != 1:
        pts["spf"] = 0; det["spf"] = "absent" if not spf else "invalide (multiple)"
    else:
        s = spf[0].lower()
        if re.search(r"\s-all\b", s): pts["spf"], det["spf"] = 20, "strict (-all)"
        elif re.search(r"\s~all\b", s): pts["spf"], det["spf"] = 12, "souple (~all)"
        elif "redirect=" in s: pts["spf"], det["spf"] = 12, "redirect"
        else: pts["spf"], det["spf"] = 0, "permissif (?all/+all/sans all)"
    # --- Alignement strict + rapports (10) ---
    pts["alignement"] = 5 if (t.get("adkim") == "s" or t.get("aspf") == "s") else 0
    pts["rapports"] = 5 if t.get("rua") else 0
    det["alignement"] = "strict" if pts["alignement"] else "relâché"
    det["rapports"] = "oui" if pts["rapports"] else "non"
    # --- Transport : MTA-STS / TLS-RPT (5) ---
    sts = any(r.lower().startswith("v=stsv1") for r in txt(f"_mta-sts.{domain}"))
    tlsrpt = any(r.lower().startswith("v=tlsrptv1") for r in txt(f"_smtp._tls.{domain}"))
    pts["mta_sts"] = (3 if sts else 0) + (2 if tlsrpt else 0)
    det["mta_sts"] = "oui" if sts else "non"; det["tls_rpt"] = "oui" if tlsrpt else "non"
    # --- DNSSEC (5) ---
    ds = bool(txt(domain, "DS"))
    pts["dnssec"] = 5 if ds else 0; det["dnssec"] = "oui" if ds else "non"
    total = sum(pts.values())
    # Plafond : sans DMARC bloquant, impossible d'être au-dessus de D
    if pol not in ("reject", "quarantine"): total = min(total, 49)
    note = "A" if total >= 90 else "B" if total >= 75 else "C" if total >= 60 else "D" if total >= 40 else "E" if total >= 20 else "F"
    return total, note, pts, det

if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv) > 1 else "domaines.csv"
    now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
    rows = []
    for r in csv.DictReader(open(src, encoding="utf-8"), delimiter=";"):
        total, note, pts, det = score(r["domaine"])
        rows.append({**r, "score": total, "note": note, "points": pts, "details": det, "mesure": now})
        print(f'{note} {total:3d}  {r["domaine"]:28s} {det["dmarc_politique"]:18s} spf={det["spf"]}', file=sys.stderr)
    rows.sort(key=lambda x: (-x["score"], x["institution"]))
    json.dump({"mesure": now, "resultats": rows}, open("resultats.json", "w"), ensure_ascii=False, indent=1)
    with open("resultats.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["rang","institution","categorie","domaine","note","score","dmarc","sous_domaines","spf","alignement","rapports","mta_sts","tls_rpt","dnssec","date_mesure_utc"])
        for i, x in enumerate(rows, 1):
            d = x["details"]
            w.writerow([i, x["institution"], x["categorie"], x["domaine"], x["note"], x["score"], d["dmarc_politique"], d["sous_domaines"], d["spf"], d["alignement"], d["rapports"], d["mta_sts"], d["tls_rpt"], d["dnssec"], now])
