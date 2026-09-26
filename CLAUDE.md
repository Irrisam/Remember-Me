# 🕯️ Remember Me — Contexte projet

## 🎯 Vision
Web app permettant à une personne, de son vivant, de créer un recueil de souvenirs (photos, textes, anecdotes, audio, vidéo) avec sa voix et sa patte, puis de l'envoyer à ses proches qui peuvent le consulter et l'enrichir.

**Principe clé : tout vit dans un fichier.** Pas de compte, pas de stockage serveur. Le fichier appartient à l'utilisateur.

| Pilier | Promesse |
|---|---|
| 🔒 Souveraineté | Aucune donnée sur nos serveurs |
| ♾️ Pérennité | Fichier lisible même si l'app disparaît (viewer embarqué) |
| 👨‍👩‍👧 Collectif | Les proches contribuent via des packs de contribution |
| 🫶 Anticipation | Fait de son vivant, pour épargner les proches après |

## 👥 Rôles
| Rôle | Actions |
|---|---|
| Créateur | Crée, ajoute, valide/refuse les contributions, exporte `.rmbr` |
| Contributeur | Ouvre `.rmbr`, consulte, ajoute, exporte un pack `.rmbrc` |
| Lecteur | Consulte (y compris hors ligne via le viewer embarqué) |

### Flow
```
Créateur ──crée──▶ souvenir.rmbr ──envoie──▶ Proches
Proches ──ajoutent──▶ contribution-xxx.rmbrc ──renvoient──▶ Créateur
Créateur ──fusionne──▶ souvenir.rmbr v2 ──renvoie──▶ tous
```

## 📦 Format `.rmbr` (ZIP structuré, format ouvert)
| Élément | Rôle |
|---|---|
| `manifest.json` | Version du format, ID du recueil (UUID), métadonnées, index des entrées, auteurs |
| `entries/<uuid>.json` | Une entrée par souvenir : type, texte, date, lieu, tags, auteur, refs médias |
| `media/` | Photos, audio, vidéo compressés côté client |
| `viewer/index.html` | Lecteur autonome hors ligne (garantie de pérennité) |
| `LISEZMOI.txt` | Comment ouvrir le fichier sans l'app |
| `signature` (v2) | Authentification des entrées du créateur |

**Pack de contribution `.rmbrc`** : uniquement les nouvelles entrées + médias d'un contributeur, avec référence à l'ID du recueil. Modèle **append-only** → fusion sans conflit (union par UUID).

## ⚙️ Stack cible
| Couche | Choix |
|---|---|
| Front | ✅ SvelteKit (Svelte 5) + `adapter-static`, site 100 % statique, dans `app/` |
| Hébergement | Cloudflare Pages / GitHub Pages |
| Zip | `fflate` (streaming) |
| Vidéo | `ffmpeg.wasm` (compression client) |
| Image | Canvas / `browser-image-compression` |
| Audio | MediaRecorder API |
| Chiffrement | WebCrypto AES-GCM (mot de passe optionnel) |
| Offline | PWA |
| Backend | ❌ Aucun au MVP |

## ⚠️ Contraintes à garder en tête
| Sujet | Règle |
|---|---|
| Taille | Compression agressive, limite durée vidéo (PJ mail ≈ 25 Mo) |
| Fichier unique | Inciter aux backups (pas de compte = pas de filet) |
| Public | Seniors → UX ultra guidée, mode « je crée pour quelqu'un » |
| Légal | Ce n'est **pas** un testament. Analytics sans cookies uniquement |
| Ton | Sujet de la mort : sobre, bienveillant, jamais anxiogène |

## 🛣️ Roadmap
| Phase | Contenu |
|---|---|
| 0 · Cadrage | Spec format v0, maquettes 3 écrans (créer / consulter / contribuer) |
| 1 · MVP | Texte + photo + audio, export `.rmbr`, viewer embarqué, ouverture/consultation |
| 2 · Collaboratif | Packs `.rmbrc`, fusion, modération créateur, vidéo compressée |
| 3 · Confort | Questions guidées, timeline, chiffrement, mode « pour quelqu'un » |
| 4 · Monétisation | Livre imprimé, coffret USB, premium one-shot, B2B |
| 5 · Option | Backup cloud chiffré opt-in, IA d'aide à l'écriture/transcription |

## 🚀 Prochaine étape
1. ✅ Spec v0.2 du format en JSON Schema → `spec/v0/` (README = règles de fusion, tri, suppression, signature)
2. ✅ POC dans `app/` : créer un recueil, texte + photos, export `.rmbr`, réouverture, affichage chronologique. Validé dans le navigateur
3. ✅ Viewer embarqué : HTML statique **sans JavaScript** généré à chaque export (texte échappé, CSP, médias en `../media/`). Vérifié en `file://`
4. 🟡 Audio : enregistrement micro (MediaRecorder, Opus 32 kbit/s, ≤ 30 min, ≤ 10 Mo) dans `app/src/lib/components/Recorder.svelte`. Tests OK, reste à valider au micro dans le navigateur

## 🗂️ Code
| Chemin | Rôle |
|---|---|
| `app/src/lib/rmbr/archive.js` | Création, export `.rmbr` (fflate), lecture + contrôles hors schéma |
| `app/src/lib/rmbr/timeline.js` | Tri chronologique, masquage tombstones / entrées remplacées |
| `app/src/lib/rmbr/viewer.js` | Génère `viewer/index.html` (lecture hors ligne, sans JS) |
| `app/src/lib/rmbr/image.js` | Compression photo client (WebP ≤ 3 Mo, 2048 px, sans EXIF) |
| `app/tests/` | Tests `node:test`, valident les fichiers exportés contre `spec/v0` |

## 🧰 Environnement de dev
| Sujet | Règle |
|---|---|
| Node / Python | Environnement isolé dans `%LOCALAPPDATA%\RememberMe\env`, doc dans `tools/env/README.md` |
| Activer | `. tools\env\activate.ps1` (installer : `tools\env\setup.ps1`) |
| Dossier protégé | L'Accès contrôlé aux dossiers de Windows Defender protège `Documents`. `node.exe` de l'env et git y sont autorisés : `npm` et `git` fonctionnent. `bash` et `powershell` ne peuvent toujours pas écrire directement |
| Commandes | Dans `app/` : `npm test`, `npm run build`, `npx vite preview --port 4173` |

## 🗣️ Conventions de travail
- Échanges en français, direct et concis
- Documentation : layouts plats, headers emoji, tableaux plutôt que listes imbriquées
