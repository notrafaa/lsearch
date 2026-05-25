# LSearch

Application OSINT locale avec interface Next.js, proxy serveur vers BrixHub, controle des quotas, recherches sauvegardees et historique.

## Configuration

1. Copiez `.env.example` vers `.env.local`.
2. Renseignez `BRIXHUB_API_KEY`, `APP_USERNAME`, `APP_PASSWORD` et `SESSION_SECRET`.
3. Installez et lancez le site :

```powershell
npm install
npm run dev
```

Next.js affiche l'URL de dev a ouvrir dans le terminal.

## Wrapper C++ WebView2

Prérequis Windows :

- Visual Studio 2022 avec Desktop development with C++;
- CMake 3.20+ ;
- Microsoft Edge WebView2 Runtime.

Compilation :

```powershell
cmake -S native -B native\build -A x64
cmake --build native\build --config Release
```

Lancement :

```powershell
.\native\build\Release\LSearch.exe
```

Le wrapper ouvre automatiquement `https://lsearch.vercel.app/`. Vous pouvez le surcharger en passant une URL ou via une variable d'environnement :

```powershell
setx LSEARCH_URL "https://votre-domaine.example"
.\native\build\Release\LSearch.exe
```
