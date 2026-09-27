# 🕯️ Remember Me

Web app pour rassembler ses souvenirs (textes, photos, voix, vidéos) dans **un seul fichier `.rmbr`** à offrir à ses proches, qui peuvent le lire hors ligne et y ajouter les leurs. Pas de compte, pas de serveur : tout se passe dans le navigateur.

| Dossier | Contenu |
|---|---|
| `app/` | L'application (SvelteKit, site 100 % statique) |
| `spec/v0/` | Le format ouvert `.rmbr` / `.rmbrc` : JSON Schema, règles de fusion, exemples |
| `tools/env/` | Environnement de dev isolé (Node, Python) |

## 🧪 Commandes (dans `app/`)
| Commande | Rôle |
|---|---|
| `npm ci` | Installer les dépendances |
| `npm run dev` | Serveur de développement |
| `npm test` | Tests unitaires (format, fusion, signatures, récit…) |
| `npm run e2e` | Tests navigateur sur le build de production. En local : Microsoft Edge. En CI : Google Chrome |
| `npm run build` | Build statique dans `app/build/` |
| `E2E_BASE_URL=https://remember-me-a6h.pages.dev npm run e2e` | Mêmes tests navigateur contre le site en ligne (PowerShell : `$env:E2E_BASE_URL = '…'` puis `npm run e2e`) |

La CI GitHub Actions (`.github/workflows/ci.yml`) lance la validation de la spec, les tests unitaires, le build et les tests navigateur à chaque push.

## 🚀 Déploiement : Cloudflare Pages
En ligne : **https://remember-me-a6h.pages.dev** (déployé à chaque push sur `master`).

Cloudflare Pages sert le site à la racine d'un domaine (`xxx.pages.dev`), ce qu'exigent la PWA et le service worker. GitHub Pages le servirait sous `/Remember-Me/` : déconseillé.

| Réglage (Workers & Pages › Créer › Pages › Connecter à Git) | Valeur |
|---|---|
| Dépôt | `Irrisam/Remember-Me` |
| Branche de production | `master` |
| Répertoire racine | `app` |
| Commande de build | `npm run build` |
| Répertoire de sortie | `build` |
| Variable d'environnement | `NODE_VERSION` = `24.21.0` |

Chaque push sur une autre branche crée un **aperçu** à une adresse dédiée, pratique pour faire tester sur téléphone.

| Déjà prêt | Où |
|---|---|
| En-têtes de sécurité, cache longue durée des fichiers versionnés | `app/static/_headers` |
| Politique de sécurité (CSP) avec empreintes des scripts | `app/svelte.config.js` |
| `/creer` servi par `creer.html` | Comportement par défaut de Cloudflare Pages |

## ⚖️ Avant l'ouverture au public
- **Mentions légales** (éditeur, hébergeur, contact) : obligatoires en France, à rédiger.
- Le mot de passe propriétaire ne peut pas être récupéré : le dire clairement aux premiers utilisateurs.
