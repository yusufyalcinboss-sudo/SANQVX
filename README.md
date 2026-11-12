# SANQVX EXECUTOR — Studio Workspace

SANQVX is a local-first, installable web app and Roblox Studio companion for editing Luau as text. It does **not** inject into the Roblox client or run scripts. Use Roblox Studio's own Script Editor and Test controls to validate projects.

## Windows desktop app

Run `dist\SANQVX.exe` to open the desktop app. The executable contains the app files and does not require Python or a separate web server. The Microsoft Edge WebView2 Runtime is required; if it is missing, install it from [Microsoft's WebView2 page](https://developer.microsoft.com/microsoft-edge/webview2/).

The desktop app stores its local browser data under `%LOCALAPPDATA%\SANQVX\WebView2`. To build the Windows x64 executable from source, install the .NET 10 SDK and run:

```powershell
dotnet publish desktop\SANQVX.Desktop.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o dist
```

## Start in a browser

The optional `Start-SANQVX.bat` launcher requires Python 3. It automatically uses the working Python command on your machine (`py`, `python`, or `python3`) and starts a local server at `http://127.0.0.1:8765`; keep its server window open while using the app. Alternatively, open PowerShell in the extracted folder and run `py -3 -m http.server 8765 --bind 127.0.0.1` (or the equivalent `python -m http.server 8765 --bind 127.0.0.1` if `py` is unavailable), then visit that address. Localhost is intended for local development and does not require the web access key.

The web access-key screen requires deploying the app to Vercel so the `proxy.js` request gate and `/api/verify-key` function are available. The Vercel proxy protects page, asset, and API requests with a signed, HTTP-only session cookie; only the login page, service-worker cache cleanup, and key-verification endpoint are public. In the Vercel project, configure `SANQVX_ACCESS_KEY` for Production and redeploy. Do not put the key in source code or a public environment file. As with any web app, files a user is authorized to download can be inspected after delivery.

To publish the key gate:

1. Push the project-root files, including `vercel.json`, `proxy.js`, `package.json`, `login.html`, `lib\access-session.js`, and `api\verify-key.js`, to the Git branch connected to Vercel.
2. In Vercel **Project Settings → Build and Deployment**, set **Root Directory** to the folder containing those files. Do not set the Output Directory to `dist` or another folder that excludes them.
3. Confirm `SANQVX_ACCESS_KEY` is configured for the Production environment.
4. Trigger a new Production deployment. The access cookie is versioned, so previous login cookies are rejected, and the service worker removes previous app caches.
5. Test the deployment in a private window: `/` should redirect to `/login.html`, and a wrong key should receive an “incorrect key” message.

**Mobile:** the responsive web app works in a mobile browser and can be installed as a PWA. To use the access-key-gated app on a phone, deploy the app, Vercel proxy, and `/api/verify-key` function to Vercel over HTTPS; simply hosting the static files elsewhere will not provide request protection. The app now requires a network connection to validate the session. The `127.0.0.1` address and Windows EXE are only available on the computer running them. On Android, use the browser's **Install app** option; on iPhone/iPad, use Safari's **Share > Add to Home Screen**. The Windows EXE and Roblox Studio plugin are desktop-only. Each device has its own local database; export and restore a backup to transfer scripts. There is no automatic cloud sync.

## Features

- Luau text editor with tabs, basic syntax coloring, line numbers, undo/redo, and local autosave.
- Separate local projects, script search, favorites, categories, import/export, and JSON backup/restore.
- Up to 30 saved versions per script; restore a snapshot from History.
- Heuristic scanner and project overview. Findings are suggestions, not a Luau parser, compatibility guarantee, security audit, or performance profiler.
- Offline helper with lightweight code notes and a Roblox UI starter template. It is not a generative AI service.
- Adjustable accent, background, font size, and reduced motion.
- Installable PWA shell; the Vercel-hosted app requires a network connection to validate access.

## Data and security

Scripts and preferences are stored in IndexedDB on the current device. The desktop app uses its own WebView2 profile, separate from the browser-launcher profile. SANQVX does not send source code to an AI service or cloud. Browser-local storage is not encrypted against other users or malware with access to the device profile; use device encryption and protect exported backups.

The web app checks its shared access key through `api\verify-key.js`; request protection is enforced by `proxy.js`. The key itself must only be stored in Vercel's server-side environment configuration. A shared key is not a substitute for user accounts, and anyone with access to the Vercel project can change the configured key. Scripts remain in local browser storage and are not uploaded or encrypted by this gate. Secure accounts, AI, and cloud sync require separately hosted backend services.

## Roblox Studio workflow

1. Create or import a script in SANQVX and edit it.
2. Save or export a `.lua` file.
3. Open the corresponding Script, LocalScript, or ModuleScript in Studio and transfer the source.
4. Check Studio's Script Analysis/Output, script location, API permissions, and client/server context.
5. Test using Studio's normal **Test > Play** controls. The app cannot run Studio on phones, inject into a live Roblox game, or execute Luau in Roblox; its **Run as a script** button saves the script and opens a guide to testing it in Studio.

Compatibility depends on the target experience, script type/location, available APIs, permissions, and runtime state. An apparent clean scan does not mean a script will run correctly.

`SANQVX.plugin.lua` is an optional dockable Studio companion for editing selected DataModel scripts through Roblox Studio APIs.

The plugin's **OPEN IN STUDIO** button saves the active source and opens the corresponding script in Studio's native editor. It does not execute code itself; use Roblox Studio's **Test > Play** controls to run it in the experience's normal context.
