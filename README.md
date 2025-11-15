# Spotify OAuth Backend

Backend minimaliste pour gérer l'authentification OAuth Spotify, stocker les tokens dans PostgreSQL et exposer les routes nécessaires à un bot Discord. Conçu pour tourner sur Railway avec Docker.

## Prérequis
- Node.js 20+
- Compte Spotify Developer (client_id / client_secret)
- Base de données PostgreSQL accessible via `DATABASE_URL`
- Compte Railway

## Installation locale
1. Cloner le dépôt :
   ```bash
   git clone <repo-url>
   cd spotify-oauth-backend
   ```
2. Installer les dépendances :
   ```bash
   npm install
   ```
3. Créer un fichier `.env` (non commité) avec :
   ```env
   PORT=8080
   SPOTIFY_CLIENT_ID=... 
   SPOTIFY_CLIENT_SECRET=...
   REDIRECT_URI=https://votre-domaine/callback
   DATABASE_URL=postgresql://user:password@host:port/db
   ```
4. Lancer en local :
   ```bash
   npm start
   ```

## Base de données requise
Créez la table suivante dans votre base PostgreSQL :
```sql
CREATE TABLE IF NOT EXISTS link_request (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## Déploiement Railway
1. Depuis Railway, créez un nouveau projet « Deploy from Repo » et sélectionnez ce dépôt.
2. Dans l'onglet **Variables**, ajoutez :
   - `SPOTIFY_CLIENT_ID`
   - `SPOTIFY_CLIENT_SECRET`
   - `REDIRECT_URI` (par ex. `https://<votre-app>.up.railway.app/callback`)
   - `DATABASE_URL` (Railway peut fournir l'URL si vous ajoutez un service PostgreSQL)
   - `PORT` (optionnel, 8080 par défaut)
3. Railway détectera le `Dockerfile` et lancera le build automatiquement.
4. Après déploiement, vérifiez les logs pour s'assurer que « Server running on port 8080 » apparaît.

## Tester les routes
- **/login** : ouvrez `https://<votre-app>.up.railway.app/login` pour être redirigé vers Spotify et accepter les permissions.
- **/callback** : Spotify redirige vers `REDIRECT_URI` avec `?code=XXX`. Cette route échange le code et enregistre `access_token` + `refresh_token` dans `link_request`.
- **/get-token?code=XXX** : récupère le dernier couple `access_token`/`refresh_token` associé à ce code. Pratique pour votre bot Discord.

Utilisez un outil comme curl/Postman pour valider que chaque route répond correctement.

## Intégration avec le bot Discord
1. Votre bot initie la liaison en envoyant l'utilisateur vers `/login`.
2. Une fois le code stocké (après `/callback`), le bot appelle `GET /get-token?code=XXX` pour récupérer les tokens et agir au nom de l'utilisateur.
3. Stockez localement côté bot les tokens et rafraîchissez-les via l'API Spotify lorsque nécessaire.

## Variables d'environnement récap
| Variable | Description |
| --- | --- |
| `SPOTIFY_CLIENT_ID` | ID de votre application Spotify |
| `SPOTIFY_CLIENT_SECRET` | Secret Spotify |
| `REDIRECT_URI` | URL publique vers `/callback` |
| `DATABASE_URL` | Chaîne de connexion PostgreSQL |
| `PORT` | Port HTTP (8080 par défaut) |

Ce backend est prêt à être déployé immédiatement sur Railway grâce au Dockerfile fourni.
