import * as esbuild from 'esbuild'
import {copyToAppPlugin, copyManifestPlugin, commonConfig} from "./build.helpers.mjs"
import parseArgs from "minimist"

const outDir = `dist/DeadCodeDetector`
const appDir = "C:\\Users\\VishnuPrasathTA.AzureAD\\Mendix\\App-main"
const extensionDirectoryName = "extensions"

const entryPoints = [
    {
        in: 'src/main/index.ts',
        out: 'main'
    }
]

entryPoints.push({
    in: 'src/ui/index.tsx',
    out: 'tab'
})

const args = parseArgs(process.argv.slice(2))
const buildContext = await esbuild.context({
  ...commonConfig,
  outdir: outDir,
  plugins: [copyManifestPlugin(outDir), copyToAppPlugin(appDir, outDir, extensionDirectoryName)],
  entryPoints
})

if('watch' in args) {
    await buildContext.watch();
}
else {
    await buildContext.rebuild();
    await buildContext.dispose();
}


