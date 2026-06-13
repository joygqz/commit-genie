const fs = require('node:fs')
const process = require('node:process')
const rolldown = require('rolldown')

const production = process.argv.includes('--production')
const watch = process.argv.includes('--watch')

/** @type {import('rolldown').RolldownOptions} */
const options = {
  input: 'src/extension.ts',
  platform: 'node',
  external: ['vscode'],
  output: {
    file: 'dist/extension.js',
    format: 'cjs',
    minify: production,
    sourcemap: !production,
  },
}

async function main() {
  fs.rmSync('dist', { recursive: true, force: true })

  if (watch) {
    const watcher = rolldown.watch(options)
    watcher.on('event', (event) => {
      if (event.code === 'BUNDLE_START') {
        console.log('[watch] build started')
      }
      else if (event.code === 'BUNDLE_END') {
        console.log('[watch] build finished')
      }
      else if (event.code === 'ERROR') {
        const { error } = event
        const file = error.loc?.file ?? error.id ?? ''
        const line = error.loc?.line ?? 0
        const column = error.loc?.column ?? 0
        console.error(`✘ [ERROR] ${error.message}`)
        console.error(`    ${file}:${line}:${column}:`)
      }
    })
  }
  else {
    const bundle = await rolldown.rolldown(options)
    await bundle.write(options.output)
    await bundle.close()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
