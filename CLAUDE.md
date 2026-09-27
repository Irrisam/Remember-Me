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
4. ✅ Audio : enregistrement micro (MediaRecorder, Opus 32 kbit/s, ≤ 30 min, ≤ 10 Mo) dans `app/src/lib/components/Recorder.svelte`
5. ✅ Phase 2 collaboratif : rôles à l'ouverture (créateur / proche / lecteur), packs `.rmbrc`, examen + fusion selon les 10 règles, modération, suppression (tombstone retiré à l'export), vérification des signatures ES256
6. ✅ Vidéo compressée : ffmpeg.wasm chargé à la demande depuis jsDelivr (version figée, SHA-256 vérifié), MP4 H.264/AAC 720p, débit calculé pour rester < 20 Mo, ≤ 3 min. Environ 2,5× la durée de la vidéo pour la compresser (mono-thread)

7. ✅ Visualisation : frise par décennie (par année si < 10 ans, depuis la naissance si connue), récit par périodes, réponses sous leur souvenir, âge de la personne. Identique dans l'app et le viewer (sans JS, frise en liens d'ancre). Logique commune dans `story.js`
8. ✅ « Modifier le recueil » (créateur) : titre, personne, date de naissance, prénom du créateur (`editRecueil`, composant `RecueilSettings`)
9. ✅ Front « Album chaleureux » : design system (`app/src/app.css`), pages `/` vitrine, `/creer` création guidée, `/recueil`, `/confidentialite`, souvenir en 3 étapes, PWA installable et hors ligne
10. ✅ Formulaire de souvenir élargi : espace de travail 1040 px, étapes en colonne à gauche sur grand écran, aperçu de la date et de l'âge, tuiles médias
11. ✅ Accès propriétaire par mot de passe (spec v0.3) : **facultatif mais conseillé**, **indice seulement** en cas d'oubli (choix de l'utilisateur). Clé ES256 chiffrée dans `manifest.ownerKey`, actions du propriétaire signées, alerte locale si la clé change
12. ✅ Prêt à déployer : tests navigateur `app/e2e/` (Playwright, `npm run e2e`), CI GitHub Actions, CSP par empreintes, `static/_headers`, guide Cloudflare Pages dans `README.md`
13. ✅ Modifier un souvenir (`editEntry`) : correction + tombstone, l'ancienne version quitte le fichier, les réponses suivent. Seul l'auteur modifie. En modération, une modification = une seule carte
14. ⏭️ Questions guidées (phase 3)

## 🎨 Front
| Sujet | Règle |
|---|---|
| Style | « Album chaleureux » : papier `#f6f1e9`, accent terre cuite `#a0522d`, titres Fraunces, texte Source Serif 4 (19 px) |
| Polices | Auto-hébergées (`@fontsource-variable`), jamais de Google Fonts : confidentialité + hors ligne |
| Composants | Classes globales `.btn` (`-secondary`, `-ghost`, `-sm`, `-lg`), `.card`, `.panel`, `.field`, `.input`, `.msg-*`, `.hint`, `.eyebrow`. Pas de styles de bouton dans les composants |
| Accessibilité | Contraste AA, cibles ≥ 44 px, focus visible, `prefers-reduced-motion` respecté |
| Textes | Pas d'accord genré deviné depuis un prénom (« vous avez créé ce recueil », « naissance : … ») |
| État | Recueil ouvert dans `lib/session.svelte.js`, partagé entre pages, jamais persisté |
| PWA | `static/manifest.webmanifest`, icônes PNG générées depuis le logo, `src/service-worker.js` (app en cache, souvenirs jamais) |
| Viewer | Mêmes couleurs, polices système (fichier léger) |

## 📝 Avant la mise en ligne
| Sujet | Idée |
|---|---|
| Mentions légales | Éditeur, hébergeur, contact : obligatoires en France, non rédigées (aucune info inventée) |
| Hébergement | ✅ Cloudflare Pages, https://remember-me-a6h.pages.dev, build à chaque push sur `master`. `404.html` générée (sinon Pages sert l'accueil en 200 partout). Vérifier un déploiement : `E2E_BASE_URL=… npm run e2e` |
| Identité | Un proche se reconnaît dans la liste des auteurs, sans preuve tant qu'il n'a pas de clé : à durcir avec la signature |
| Ouvrir un .rmbr depuis l'OS | `file_handlers` du manifeste + `launchQueue`, pour la PWA installée |
| Vitesse vidéo | ≈ 7 min pour 3 min de vidéo. Pistes : ffmpeg multi-thread (en-têtes COOP/COEP, impossible sur GitHub Pages) ou WebCodecs (encodage matériel) |
| Sous-titres vidéo | Brancher `media.transcript` sur une piste `<track>` |

## 🗂️ Code
| Chemin | Rôle |
|---|---|
| `app/src/lib/rmbr/archive.js` | Création, export `.rmbr` (fflate), lecture + contrôles hors schéma |
| `app/src/lib/rmbr/timeline.js` | Tri chronologique, masquage tombstones / entrées remplacées |
| `app/src/lib/rmbr/story.js` | Récit : fils (souvenir + réponses), périodes de la frise, âge. Partagé app + viewer |
| `app/src/lib/rmbr/merge.js` | Examen d'un pack (règles 1-8) et fusion des entrées acceptées |
| `app/src/lib/rmbr/owner-key.js` | Clé propriétaire : création, chiffrement par mot de passe (PBKDF2 600 000 + AES-GCM), déverrouillage, changement |
| `app/src/lib/rmbr/signature.js` | JCS (RFC 8785), keyId (RFC 7638), signature / vérification ES256 |
| `app/src/lib/rmbr/video.js` | Compression vidéo (ffmpeg.wasm). Mettre à jour `@ffmpeg/core` implique de changer URL + empreintes, un test le vérifie |
| `app/src/lib/rmbr/video-plan.js` | Budget de débit, arguments ffmpeg/ffprobe (logique pure, testée) |
| `app/src/routes/` | `/` vitrine, `/creer` création guidée, `/recueil` espace de travail, `/confidentialite`, `+layout` (en-tête, pied, garde avant fermeture) |
| `app/src/lib/components/` | `EntryForm` (3 étapes), `MemoryCard`, `Moderation`, `Recorder`, `VideoPicker`, `Story`, `Frise`, `RecueilSettings`, `OwnerAccess`, `PasswordField`, `Logo` |
| `app/src/lib/rmbr/viewer.js` | Génère `viewer/index.html` (lecture hors ligne, sans JS) |
| `app/src/lib/rmbr/image.js` | Compression photo client (WebP ≤ 3 Mo, 2048 px, sans EXIF) |
| `app/tests/` | Tests `node:test`, valident les fichiers exportés contre `spec/v0` |

## 🧰 Environnement de dev
| Sujet | Règle |
|---|---|
| Node / Python | Environnement isolé dans `%LOCALAPPDATA%\RememberMe\env`, doc dans `tools/env/README.md` |
| Activer | `. tools\env\activate.ps1` (installer : `tools\env\setup.ps1`) |
| Dossier protégé | L'Accès contrôlé aux dossiers de Windows Defender protège `Documents`. `node.exe` de l'env et git y sont autorisés : `npm` et `git` fonctionnent. `bash` et `powershell` ne peuvent toujours pas écrire directement |
| Commandes | Dans `app/` : `npm test`, `npm run e2e` (Edge en local, Chrome en CI pour le H.264), `npm run build`, `npx vite preview --port 4173` |
| CSP | Toute nouvelle origine réseau (CDN, API) doit être ajoutée dans `svelte.config.js` › `kit.csp`, sinon le navigateur la bloque |

## 🗣️ Conventions de travail
- Échanges en français, direct et concis
- Documentation : layouts plats, headers emoji, tableaux plutôt que listes imbriquées
