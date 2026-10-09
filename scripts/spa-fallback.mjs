// GitHub Pages serves 404.html for unknown paths; copying the SPA shell there
// makes deep links like /raffle/admin load the app and lets the router take over.
import { copyFileSync } from 'node:fs'

copyFileSync('dist/index.html', 'dist/404.html')
