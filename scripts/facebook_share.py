#!/usr/bin/env python3
"""Partage un article CyberBalise sur la Page Facebook via l'API Graph.

Usage rapide :
    python scripts/facebook_share.py check
    python scripts/facebook_share.py share chimeraz-donnees-partis-politiques --message "Texte d'accroche"
    python scripts/facebook_share.py share chimeraz-donnees-partis-politiques --message "..." --publish

Sans --publish, la commande « share » affiche seulement l'aperçu (aucune publication).
Les identifiants sont lus dans les variables d'environnement FB_PAGE_ID et
FB_PAGE_ACCESS_TOKEN, ou dans scripts/.env.facebook (ignoré par Git).
"""
from __future__ import annotations

import argparse
import html
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = Path(__file__).resolve().parent
ENV_FILE = SCRIPTS / ".env.facebook"
LOG_FILE = SCRIPTS / "facebook-posts.log.jsonl"
SITE = "https://cyberbalise.fr"
GRAPH_VERSION = "v21.0"
USER_AGENT = "CyberBaliseFacebookShare/1.0 (+https://cyberbalise.fr)"


class MetaParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.meta: dict[str, str] = {}
        self.canonical = ""
        self._in_title = False
        self.title = ""

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "meta":
            key = a.get("property") or a.get("name")
            if key and "content" in a and key not in self.meta:
                self.meta[key] = a["content"] or ""
        elif tag == "link" and a.get("rel") == "canonical":
            self.canonical = a.get("href") or ""
        elif tag == "title":
            self._in_title = True

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False

    def handle_data(self, data):
        if self._in_title:
            self.title += data


def fail(message: str, code: int = 1):
    print(f"Erreur : {message}", file=sys.stderr)
    sys.exit(code)


def load_credentials() -> tuple[str, str]:
    values = {}
    if ENV_FILE.is_file():
        for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                values[key.strip()] = value.strip().strip('"').strip("'")
    page_id = os.environ.get("FB_PAGE_ID") or values.get("FB_PAGE_ID", "")
    token = os.environ.get("FB_PAGE_ACCESS_TOKEN") or values.get("FB_PAGE_ACCESS_TOKEN", "")
    if not page_id or not token:
        fail(
            "identifiants Facebook manquants. Renseignez FB_PAGE_ID et FB_PAGE_ACCESS_TOKEN "
            f"dans {ENV_FILE.relative_to(ROOT).as_posix()} (modèle : scripts/.env.facebook.example)."
        )
    return page_id, token


def graph_request(path: str, params: dict[str, str], method: str = "GET") -> dict:
    url = f"https://graph.facebook.com/{GRAPH_VERSION}/{path}".rstrip("/")
    data = None
    if method == "GET":
        url += "?" + urllib.parse.urlencode(params)
    else:
        data = urllib.parse.urlencode(params).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        try:
            detail = json.load(error).get("error", {})
        except Exception:
            detail = {}
        message = detail.get("message", error.reason)
        code = detail.get("code", error.code)
        hint = ""
        if code == 190:
            hint = " Le jeton d'accès est invalide ou expiré : générez-en un nouveau."
        elif code in (200, 10):
            hint = " Permission manquante : le jeton doit inclure pages_manage_posts."
        fail(f"l'API Facebook a refusé la requête (code {code}) : {message}.{hint}")
    except urllib.error.URLError as error:
        fail(f"connexion à Facebook impossible : {error.reason}")


def resolve_article(target: str) -> tuple[Path, dict[str, str]]:
    path = urllib.parse.urlparse(target).path if "://" in target else target
    path = path.strip("/")
    candidates = []
    if path:
        candidates.append(ROOT / path / "index.html")
        if "/" not in path:
            candidates.append(ROOT / "actualites" / path / "index.html")
    page = next((c for c in candidates if c.is_file()), None)
    if page is None:
        known = sorted(p.parent.name for p in (ROOT / "actualites").glob("*/index.html"))
        fail(f"article introuvable pour « {target} ». Articles disponibles : {', '.join(known)}")
    parser = MetaParser()
    parser.feed(page.read_text(encoding="utf-8"))
    meta = {
        "title": html.unescape(parser.meta.get("og:title") or parser.title.strip()),
        "description": html.unescape(parser.meta.get("og:description") or parser.meta.get("description", "")),
        "image": parser.meta.get("og:image", ""),
        "url": parser.meta.get("og:url") or parser.canonical,
    }
    if not meta["url"].startswith(SITE + "/") or not meta["title"]:
        fail(f"métadonnées de partage incomplètes dans {page.relative_to(ROOT).as_posix()} (og:url / og:title).")
    return page, meta


def check_live(url: str) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            if response.status != 200:
                fail(f"{url} répond HTTP {response.status}.")
    except urllib.error.HTTPError as error:
        fail(f"{url} n'est pas encore en ligne (HTTP {error.code}). Publiez le site puis réessayez.")
    except urllib.error.URLError as error:
        fail(f"{url} injoignable : {error.reason}")


def already_posted(url: str) -> list[dict]:
    if not LOG_FILE.is_file():
        return []
    entries = []
    for line in LOG_FILE.read_text(encoding="utf-8").splitlines():
        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            continue
        if entry.get("url") == url:
            entries.append(entry)
    return entries


def parse_schedule(value: str) -> int:
    moment = None
    for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%dT%H:%M"):
        try:
            moment = datetime.strptime(value, fmt)
            break
        except ValueError:
            continue
    if moment is None:
        fail("format de planification invalide. Exemple : --schedule \"2026-11-03 09:00\" (heure locale).")
    timestamp = int(time.mktime(moment.timetuple()))
    delay = timestamp - int(time.time())
    if delay < 10 * 60 or delay > 30 * 24 * 3600:
        fail("Facebook n'accepte une planification qu'entre 10 minutes et 30 jours à l'avance.")
    return timestamp


def command_check(_args) -> None:
    page_id, token = load_credentials()
    info = graph_request(page_id, {"fields": "name,link", "access_token": token})
    print(f"Connexion valide : Page « {info.get('name')} » ({info.get('link', page_id)}).")


def command_share(args) -> None:
    page_file, meta = resolve_article(args.article)
    link = meta["url"]
    if not args.no_utm:
        link += ("&" if "?" in link else "?") + urllib.parse.urlencode(
            {"utm_source": "facebook", "utm_medium": "social", "utm_campaign": "page"}
        )
    message = (args.message or meta["description"]).strip()
    if args.hashtags:
        message += "\n\n" + args.hashtags.strip()
    schedule = parse_schedule(args.schedule) if args.schedule else None

    print(f"Article      : {page_file.relative_to(ROOT).as_posix()}")
    print(f"Titre        : {meta['title']}")
    print(f"Image        : {meta['image'] or '(aucune og:image)'}")
    print(f"Lien partagé : {link}")
    print(f"Mode         : {'planifié le ' + args.schedule if schedule else 'publication immédiate'}")
    print("Message      :")
    print("  " + message.replace("\n", "\n  "))

    previous = already_posted(meta["url"])
    if previous and not args.force:
        last = previous[-1]
        print(f"\nCet article a déjà été partagé le {last.get('date')} (post {last.get('post_id')}). "
              "Ajoutez --force pour le partager à nouveau.")
        if args.publish:
            sys.exit(2)

    if not args.publish:
        print("\nAperçu uniquement : rien n'a été publié. Ajoutez --publish pour publier.")
        return

    check_live(meta["url"])
    page_id, token = load_credentials()
    # Force Facebook à relire les balises de partage (utile juste après une mise en ligne).
    try:
        graph_request("", {"id": meta["url"], "scrape": "true", "access_token": token}, method="POST")
    except SystemExit:
        print("Avertissement : actualisation de l'aperçu Facebook impossible, publication poursuivie.")

    params = {"message": message, "link": link, "access_token": token}
    if schedule:
        params.update({"published": "false", "scheduled_publish_time": str(schedule)})
    result = graph_request(f"{page_id}/feed", params, method="POST")
    post_id = result.get("id", "?")
    with LOG_FILE.open("a", encoding="utf-8") as log:
        log.write(json.dumps({
            "date": datetime.now().isoformat(timespec="seconds"),
            "url": meta["url"],
            "post_id": post_id,
            "scheduled": args.schedule or None,
        }, ensure_ascii=False) + "\n")
    print(f"\nPublié sur Facebook : post {post_id}" + (" (planifié)." if schedule else "."))
    if "_" in post_id:
        print(f"https://www.facebook.com/{post_id.split('_')[0]}/posts/{post_id.split('_')[1]}")


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="Partager un article CyberBalise sur la Page Facebook.")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("check", help="Vérifier la connexion à la Page Facebook.").set_defaults(func=command_check)
    share = sub.add_parser("share", help="Aperçu ou publication d'un article.")
    share.add_argument("article", help="Slug (ex. chimeraz-donnees-partis-politiques), chemin ou URL complète.")
    share.add_argument("--message", help="Texte d'accroche (par défaut : description de l'article).")
    share.add_argument("--hashtags", help="Hashtags ajoutés en fin de message.")
    share.add_argument("--schedule", help="Planifier, ex. \"2026-11-03 09:00\" (heure locale).")
    share.add_argument("--publish", action="store_true", help="Publier réellement (sinon aperçu seul).")
    share.add_argument("--force", action="store_true", help="Partager même si déjà publié.")
    share.add_argument("--no-utm", action="store_true", help="Ne pas ajouter les paramètres utm au lien.")
    share.set_defaults(func=command_share)
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
