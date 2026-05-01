import {getInput, debug, info, warning, startGroup, endGroup, addPath, setOutput, setFailed} from '@actions/core' // docs: https://github.com/actions/toolkit/tree/main/packages/core
import {downloadTool, extractTar, extractZip} from '@actions/tool-cache' // docs: https://github.com/actions/toolkit/tree/main/packages/tool-cache
import {mv, rmRF, which} from '@actions/io' // docs: https://github.com/actions/toolkit/tree/main/packages/io
import {restoreCache, saveCache} from '@actions/cache' // docs: https://github.com/actions/toolkit/tree/main/packages/cache
import {exec} from '@actions/exec' // docs: https://github.com/actions/toolkit/tree/main/packages/exec
import path from 'path'
import os from 'os'
import {HttpClient} from '@actions/http-client' // https://github.com/actions/toolkit/tree/main/packages/http-client

// read action inputs
const input = {
  version: getInput('version', {required: true}).replace(/^[vV]/, ''), // strip the 'v' prefix
}

// main action entrypoint
async function runAction() {
  let version

  if (input.version.toLowerCase() === 'latest') {
    debug('Requesting latest DNSControl version...')
    version = await getLatestVersion()
    debug(`Latest version: ${version}`)
  } else {
    version = input.version
  }

  startGroup('💾 Install DNSControl')
  await doInstall(version)
  endGroup()

  startGroup('🧪 Installation check')
  await doCheck()
  endGroup()
}

/**
 * @param {string} version
 *
 * @returns {Promise<void>}
 *
 * @throws {Error}
 */
async function doInstall(version) {
  const pathToInstall = path.join(os.tmpdir(), `dnscontrol-${version}`)
  const cacheKey = `dnscontrol-cache-${version}-${process.platform}-${process.arch}`

  info(`Version to install: ${version} (target directory: ${pathToInstall})`)

  /** @type {string|undefined} */
  let restoredFromCache = undefined

  try {
    restoredFromCache = await restoreCache([pathToInstall], cacheKey)
  } catch (e) {
    warning(e)
  }

  if (restoredFromCache) { // cache HIT
    info(`👌 DNSControl restored from cache`)
  } else { // cache MISS
    const distUri = getDistUrl(process.platform, process.arch, version)
    const distPath = await downloadTool(distUri)
    const pathToUnpack = path.join(os.tmpdir(), `dnscontrol.tmp`)

    switch (true) {
      case distUri.endsWith('tar.gz'):
        await extractTar(distPath, pathToUnpack)
        await mv(path.join(pathToUnpack, `dnscontrol`), path.join(pathToInstall, `dnscontrol`))
        break

      case distUri.endsWith('zip'):
        await extractZip(distPath, pathToUnpack)
        await mv(path.join(pathToUnpack, `dnscontrol.exe`), path.join(pathToInstall, `dnscontrol.exe`))
        break

      default:
        throw new Error('Unsupported distributive format')
    }

    await rmRF(distPath)

    try {
      await saveCache([pathToInstall], cacheKey)
    } catch (e) {
      warning(e)
    }
  }

  addPath(pathToInstall)
}

/**
 * @returns {Promise<void>}
 *
 * @throws {Error} If binary file not found in $PATH or version check failed
 */
async function doCheck() {
  const binPath = await which('dnscontrol', true)

  if (binPath === '') {
    throw new Error('dnscontrol binary file not found in $PATH')
  }

  await exec('dnscontrol', ['version'], {silent: true})

  setOutput('dnscontrol-bin', binPath)
  info(`DNSControl installed: ${binPath}`)
}

/**
 * @returns {Promise<string>}
 */
async function getLatestVersion() {
  // use the "magic" GitHub link to get the latest release tag - GitHub redirects to the tag URL
  // (e.g. /itstoragesvc/dnscontrol/releases/tag/vX.Y.Z), allowing us to avoid the GitHub API rate limits
  const resp = await new HttpClient('gacts/install-dnscontrol').get(
    'https://github.com/itstoragesvc/dnscontrol/releases/latest'
  )

  if (resp.message.statusCode !== 200) {
    throw new Error(`Failed to fetch latest version: ${resp.message.statusCode} ${resp.message.statusMessage}`)
  }

  // final path after redirects: /itstoragesvc/dnscontrol/releases/tag/vX.Y.Z
  const parts = resp.message.req.path.split('/')

  if (parts.length < 6) {
    throw new Error(`Unexpected final URL path: ${resp.message.req.path}`)
  }

  const tag = parts[5]

  return tag.replace(/^[vV]/, '') // strip the 'v' prefix
}

/**
 * @link https://github.com/itstoragesvc/dnscontrol/releases
 *
 * @param {('linux'|'darwin'|'win32')} platform
 * @param {('x32'|'x64'|'arm'|'arm64')} arch
 * @param {string} version E.g.: `1.2.6`
 *
 * @returns {string}
 *
 * @throws {Error} Unsupported platform or architecture
 */
function getDistUrl(platform, arch, version) {
  const baseUrl = `https://github.com/itstoragesvc/dnscontrol/releases/download/v${version}`

  switch (platform) {
    case 'linux': {
      switch (arch) {
        case 'x64': // Amd64
          return `${baseUrl}/dnscontrol_${version}_linux_amd64.tar.gz`

        case 'arm64':
          return `${baseUrl}/dnscontrol_${version}_linux_arm64.tar.gz`
      }

      throw new Error(`Unsupported linux architecture (${arch})`)
    }

    case 'darwin': {
      switch (arch) {
        case 'x64': // Amd64
        case 'arm64':
          return `${baseUrl}/dnscontrol_${version}_darwin_all.tar.gz`
      }

      throw new Error(`Unsupported macOS architecture (${arch})`)
    }

    case 'win32': {
      switch (arch) {
        case 'x64': // Amd64
          return `${baseUrl}/dnscontrol_${version}_windows_amd64.zip`

        case 'arm64':
          return `${baseUrl}/dnscontrol_${version}_windows_arm64.zip`
      }

      throw new Error(`Unsupported platform (${platform})`)
    }
  }

  throw new Error('Unsupported OS (platform)')
}

// run the action
(async () => {
  await runAction()
})().catch(error => {
  setFailed(error.message)
})
