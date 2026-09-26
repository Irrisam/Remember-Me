# 🧰 Environnement de dev

Un environnement isolé, sans rien installer au niveau du système : un venv Python contient [nodeenv](https://github.com/ekalinin/nodeenv), qui installe lui-même un Node dédié au projet.

## 📍 Emplacement
| Élément | Chemin |
|---|---|
| Racine | `%LOCALAPPDATA%\RememberMe\env` |
| venv Python | `...\env\py` |
| Node + npm + npx | `...\env\node\Scripts` |
| Paquets npm globaux | `...\env\node\Scripts` (via `npm_config_prefix`) |
| Cache npm | `...\env\npm-cache` |

**Pourquoi hors du projet :** le projet est sur le Bureau, synchronisé par OneDrive et protégé par l'Accès contrôlé aux dossiers (voir ⚠️). Un environnement Node contient des milliers de fichiers qu'on ne veut ni synchroniser ni bloquer.

## 📦 Versions figées
| Outil | Version | Source |
|---|---|---|
| Node | 24.21.0 (LTS « Krypton ») | `node-version.txt` |
| npm | 11.19.0 | Livré avec Node |
| nodeenv | 1.11.0 | `requirements.txt` |
| jsonschema | 4.26.0 | `requirements.txt` |
| referencing | 0.37.0 | `requirements.txt` |
| Python (hôte) | 3.14.0rc3 | Python système, utilisé pour créer le venv |

## 🚀 Utilisation
| Action | Commande (depuis `Remember Me/`) |
|---|---|
| Installer / mettre à jour | `powershell -ExecutionPolicy Bypass -File tools\env\setup.ps1` |
| Tout reconstruire | `powershell -ExecutionPolicy Bypass -File tools\env\setup.ps1 -Force` |
| Activer dans le terminal | `. tools\env\activate.ps1` (avec le point devant) |
| Vérifier | `node --version` puis `python spec\v0\validate.py` |
| Désinstaller | Supprimer `%LOCALAPPDATA%\RememberMe` |

`setup.ps1` est idempotent : le relancer ne réinstalle que ce qui manque ou ce qui a changé de version.

## 🔄 Changer de version
| Quoi | Comment |
|---|---|
| Node | Modifier `node-version.txt`, relancer `setup.ps1` |
| Paquet Python | Modifier `requirements.txt`, relancer `setup.ps1` |

## ⚠️ Accès contrôlé aux dossiers (Windows Defender)
Le Bureau est un dossier protégé. Seules les applications autorisées peuvent y écrire. VS Code l'est, mais pas `powershell.exe`, `bash.exe` ni `node.exe`. Symptôme : « fichier introuvable » à la création d'un fichier. Les blocages sont listés dans l'Observateur d'événements, sous *Windows Defender › Operational*, événement 1123.

Conséquence : `npm install` échouera dans un projet situé sur le Bureau. Solutions possibles :

| Option | Effet |
|---|---|
| Autoriser `node.exe` de l'environnement dans *Sécurité Windows › Protection contre les ransomwares › Autoriser une application* | Le projet reste sur le Bureau |
| Déplacer le projet hors du Bureau (ex. `C:\Users\trist\dev\remember-me`) | Plus aucun blocage, plus de synchro OneDrive de `node_modules` |

## 📝 Notes
- Python 3.14.0rc3 est une version candidate. Il suffit pour le venv, mais une version stable sera préférable si Python prend plus de place dans le projet.
- Le fichier `activate` créé par nodeenv n'est pas utilisé : `activate.ps1` fait la même chose et ajoute aussi le venv Python et la config npm.
