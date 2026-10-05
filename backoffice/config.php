<?php
/**
 * CONFIGURATION DU BACK OFFICE CYBERBALISE
 * Seul fichier à adapter avant la mise en ligne.
 */
return [
    'site_name' => 'CyberBalise',
    'site_url'  => 'https://cyberbalise.fr',      // sans « / » final (sert au sitemap)
    'base_url'  => '/backoffice',                  // chemin public de ce dossier

    // Racine du site (dossier qui contient index.html). Par défaut : le dossier parent.
    'site_root' => __DIR__ . '/..',

    // Dossier des données (base, versions, corbeille). Idéalement HORS de la racine web,
    // par ex. __DIR__ . '/../../cr_data'. Sinon, le .htaccess fourni en bloque l'accès.
    'data_dir'  => __DIR__ . '/data',

    // Base de données : SQLite par défaut (aucune configuration).
    // MySQL : ['driver'=>'mysql','host'=>'localhost','name'=>'base','user'=>'utilisateur','pass'=>'motdepasse']
    'db' => ['driver' => 'sqlite'],

    'timezone' => 'Europe/Paris',

    // Autoriser l'édition du code source HTML des pages par les administrateurs.
    // Puissant mais sensible : activez la double authentification sur les comptes admin.
    'allow_code_edit' => true,

    // Mettre true seulement si le site est derrière un proxy/CDN qui transmet l'IP réelle.
    'trust_proxy' => false,

    // Pages qui ne peuvent pas être supprimées depuis le back office.
    'protected_files' => ['index.html', '404.html', 'mentions-legales/index.html', 'politique-de-confidentialite/index.html', 'contact/index.html'],

    // Pages exclues du sitemap.xml.
    'sitemap_exclude' => ['404.html'],
];
