# 📦 Format Remember Me — spec v0.2

> ⚠️ v0 = instable. Tout peut changer avant la v1 ; aucune compatibilité garantie.

## 🗂️ Fichiers de la spec
| Fichier | Rôle |
|---|---|
| `manifest.schema.json` | Schéma de `manifest.json` (recueil `.rmbr` et pack `.rmbrc`) |
| `entry.schema.json` | Schéma de `entries/<id>.json` (un souvenir) |
| `examples/valid/` | Exemples qui doivent passer |
| `examples/invalid/` | Exemples qui doivent échouer (un défaut chacun) |
| `validate.py` | Lance la validation des exemples |

## 🧱 Structure de l'archive
| Chemin | `.rmbr` | `.rmbrc` | Contenu |
|---|---|---|---|
| `manifest.json` | ✅ | ✅ | `kind` = `recueil` ou `contribution` |
| `entries/<uuid>.json` | ✅ | ✅ | Une entrée par souvenir |
| `media/<uuid>.<ext>` | ✅ | ✅ | Médias compressés, jamais le nom d'origine |
| `viewer/index.html` | ✅ | ❌ | Lecteur autonome hors ligne |
| `LISEZMOI.txt` | ✅ | ✅ | Comment ouvrir le fichier sans l'app |

## 🏷️ Choix structurants
| Sujet | Décision | Pourquoi |
|---|---|---|
| Clés JSON | En anglais | Format ouvert, lisible par des devs tiers |
| Identifiants | UUID minuscules (v7 conseillé) | v7 = triable par date de création |
| Dates de souvenir | `fuzzyDate` : `value` ISO tronquée (`1959`, `1959-07`) + `approximate` + `label` libre | Les souvenirs sont rarement datés au jour près |
| Horodatages techniques | ISO 8601 avec fuseau | Tri et fusion fiables |
| Texte | Brut, pas de HTML | Le viewer n'interprète rien → pas d'injection |
| Médias | `sha256` + `size` obligatoires | Intégrité et dédoublonnage à la fusion |
| Chemins médias | Regex stricte `media/<uuid>.<ext>` | Bloque les chemins du type `../` à l'extraction |
| Entrées | Immuables : corriger = nouvelle entrée avec `supersedes` | Garde le modèle append-only |
| Enrichir un souvenir | Nouvelle entrée avec `replyTo` | Les proches ajoutent leur version sans toucher à l'original |
| Personne du recueil | `subject`, distinct du créateur | Mode « je crée pour quelqu'un » |
| Chiffrement | Bloc `encryption` optionnel, manifest en clair | Réservé pour la phase 3 |

## 📅 Ordre d'affichage : chronologique
L'ordre de `entries` dans le manifest n'a aucune signification. Le viewer trie ainsi :

| Rang | Critère |
|---|---|
| 1 | `date.value` comparée comme chaîne : `1959` < `1959-07` < `1959-07-14`. Une date partielle se place en tête de sa période |
| 2 | Entrées sans `date.value` (label seul ou pas de date) : à la fin, dans un bloc « Sans date » |
| 3 | À égalité : `createdAt` croissant |

Les entrées `tombstone` et les entrées remplacées par une correction ne sont jamais affichées.

## 🪦 Suppression : entrée vide (`tombstone`)
Supprimer un souvenir = ajouter une entrée `type: "tombstone"` qui vise l'original via `supersedes`. Elle ne contient rien d'autre, et le schéma l'impose.

| Règle | Détail |
|---|---|
| Qui peut supprimer | L'auteur de l'entrée d'origine ou le créateur |
| À l'export suivant | Le fichier de l'entrée supprimée, sa ligne dans l'index `entries` du manifest (qui contient titre et date) et ses médias qu'aucune autre entrée n'utilise sont retirés de l'archive |
| Ce qui reste | Seul le tombstone : un `id`, un auteur, une date, aucun contenu |
| À la fusion | Une entrée visée par un tombstone n'est jamais réintégrée, même si un vieux pack la contient encore |
| Correction ≠ suppression | Une correction garde l'ancienne version dans l'archive (historique). Un tombstone l'efface |

## 📏 Limites de taille (dans le schéma)
| Type | Taille max | Autres limites |
|---|---|---|
| Image | 3 Mo | ≤ 4096 px de côté, `width` et `height` obligatoires |
| Audio | 10 Mo | ≤ 30 min, `durationSec` obligatoire |
| Vidéo | 20 Mo | ≤ 3 min, ≤ 1920 px de côté, `width`, `height` et `durationSec` obligatoires |

Ce sont des plafonds par fichier. La taille totale d'un recueil n'est pas limitée par le schéma. L'app doit prévenir quand un `.rmbr` ou un `.rmbrc` dépasse ≈ 25 Mo, la limite habituelle des pièces jointes mail.

## ✍️ Signature : une clé par auteur (v2, optionnelle en v0)
| Élément | Choix |
|---|---|
| Algorithme | ES256 : ECDSA P-256 + SHA-256, disponible dans WebCrypto partout |
| Clé publique | `authors[].publicKey` : JWK + `keyId` (16 hex du SHA-256 de l'empreinte RFC 7638) |
| Données signées | L'entrée sans le champ `signature`, canonisée en JCS (RFC 8785) |
| Médias | Couverts indirectement : leur `sha256` fait partie de l'entrée signée |
| Format | `signature.value` = r‖s (64 octets) en base64url sans padding |
| Confiance | Au premier contact (TOFU) : la clé du créateur est retenue à la première ouverture du recueil. Le créateur accepte la clé d'un contributeur en validant sa première contribution |
| Exemple réel | `examples/valid/entry.audio-signee.json`, signée par la clé de Jeanne dans `manifest.recueil.json` |

## 🔀 Règles de fusion (`.rmbrc` → `.rmbr`)
| # | Règle |
|---|---|
| 1 | Refuser le pack si `recueilId` ≠ `id` du recueil |
| 2 | Refuser le pack si `formatVersion` a une majeure différente |
| 3 | Entrées : union par `id`. Un `id` déjà présent est ignoré (append-only) |
| 4 | Médias : union par `path`. Même `path` et même `sha256` = même fichier, on garde celui qui existe. Même `path` avec un `sha256` différent = entrée refusée. Pas de dédoublonnage entre chemins différents : il faudrait réécrire `media[].path` dans des entrées immuables et signées |
| 5 | Auteurs : union par `id`. Un pack ne peut pas contenir de `role: creator` |
| 6 | Une entrée `supersedes` (correction ou tombstone) n'est acceptée que si son auteur est celui de l'entrée visée, ou le créateur |
| 7 | Une entrée visée par un tombstone n'est jamais réintégrée |
| 8 | Si l'auteur a une `publicKey` : une entrée non signée ou mal signée est refusée |
| 9 | Seules les entrées validées par le créateur sont fusionnées ; les refusées ne laissent aucune trace |
| 10 | Après fusion : ajouter les entrées à l'index `entries`, mettre à jour `updatedAt` |

## ✅ Contrôles hors schéma (à faire dans l'app)
Un JSON Schema valide chaque fichier isolément. Ces règles portent sur plusieurs fichiers et doivent être vérifiées à l'ouverture :

| Contrôle | Si échec |
|---|---|
| Chaque `entries[].id` du manifest a son fichier `entries/<id>.json` (sauf entrée supprimée par tombstone) | Entrée signalée comme manquante |
| `id`, `type`, `authorId` de l'index = ceux du fichier d'entrée | Le fichier d'entrée fait foi |
| Chaque `authorId` existe dans `authors` | Afficher « auteur inconnu » |
| `creatorId` pointe sur un auteur `role: creator` | Recueil refusé |
| Chaque `media[].path` existe dans l'archive, `sha256` et `size` correspondent | Média signalé comme corrompu |
| `replyTo` et `supersedes` pointent sur une entrée existante ou supprimée | Lien ignoré |
| `signature.keyId` = `publicKey.keyId` de l'auteur, et la signature se vérifie | Entrée marquée « non authentifiée » |
| Aucun fichier de l'archive hors des chemins prévus | Fichier ignoré, jamais extrait |

## 🧪 Valider
Avec l'environnement de dev activé (voir `tools/env/README.md`) :
```
python spec\v0\validate.py
```

## ❓ Questions ouvertes
| Sujet | Options |
|---|---|
| Stockage de la clé privée | IndexedDB non exportable (perdue avec le navigateur) ou exportée dans un fichier de sauvegarde protégé par mot de passe ? |
| Perte de clé | Nouvelle clé = nouvel auteur, ou rotation acceptée par le créateur ? |
| Tombstone d'un contributeur par le créateur | Prévenir le contributeur au prochain échange ? |
