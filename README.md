# LSearch

Application OSINT locale avec interface Next.js, proxy serveur vers BrixHub, controle des quotas, recherches sauvegardees, historique et blacklist serveur.

## Configuration

1. Copiez `.env.example` vers `.env.local`.
2. Renseignez `BRIXHUB_API_KEY`, `APP_USERNAME`, `APP_PASSWORD` et `SESSION_SECRET`.
3. Installez et lancez le site :

```powershell
npm install
npm run dev
```

Le site ecoute par defaut sur `http://localhost:3000`.

## Securite blacklist

La blacklist est appliquee cote serveur :

- avant appel API, si la requete contient un terme interdit ;
- apres appel API, si la reponse JSON contient un terme interdit.

Dans le second cas, la reponse brute n'est pas renvoyee a l'interface. Seul un message de blocage est retourne.

## Wrapper C++ WebView2

Prérequis Windows :

- Visual Studio 2022 avec Desktop development with C++;
- CMake 3.20+ ;
- Microsoft Edge WebView2 Runtime.
- Node.js et npm disponibles dans le PATH.

Compilation :

```powershell
cmake -S native -B native\build -A x64
cmake --build native\build --config Release
```

Lancement :

```powershell
.\native\build\Release\LSearch.exe
```

Sans argument, le wrapper trouve le dossier du projet, lance le serveur Next.js local en arriere-plan sur `http://localhost:3000`, puis charge l'interface dans une fenetre native WebView2. Pour charger une URL deja lancee :

```powershell
.\native\build\Release\LSearch.exe http://localhost:3000 --no-server
```
