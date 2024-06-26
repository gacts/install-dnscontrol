const core = require('@actions/core') // docs: https://github.com/actions/toolkit/tree/main/packages/core
const tc = require('@actions/tool-cache') // docs: https://github.com/actions/toolkit/tree/main/packages/tool-cache
const github = require('@actions/github') // docs: https://github.com/actions/toolkit/tree/main/packages/github
const io = require('@actions/io') // docs: https://github.com/actions/toolkit/tree/main/packages/io
const cache = require('@actions/cache') // docs: https://github.com/actions/toolkit/tree/main/packages/cache
const exec = require('@actions/exec') // docs: https://github.com/actions/toolkit/tree/main/packages/exec
const path = require('path')
const os = require('os')

// read action inputs
const input = {
  version: core.getInput('version', {required: true}).replace(/^[vV]/, ''), // strip the 'v' prefix
  githubToken: core.getInput('github-token'),
}

// main action entrypoint
async function runAction() {
  let version

  if (input.version.toLowerCase() === 'latest') {
    core.debug('Requesting latest DNSControl version...')
    version = await getLatestVersion(input.githubToken)
    core.debug(`Latest version: ${version}`)
  } else {
    version = input.version
  }

  core.startGroup('💾 Install DNSControl')
  await doInstall(version)
  core.endGroup()

  core.startGroup('🧪 Installation check')
  await doCheck()
  core.endGroup()
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

  core.info(`Version to install: ${version} (target directory: ${pathToInstall})`)

  /** @type {string|undefined} */
  let restoredFromCache = undefined

  try {
    restoredFromCache = await cache.restoreCache([pathToInstall], cacheKey)
  } catch (e) {
    core.warning(e)
  }

  if (restoredFromCache) { // cache HIT
    core.info(`👌 DNSControl restored from cache`)
  } else { // cache MISS
    const distUri = getDistUrl(process.platform, process.arch, version)
    const distPath = await tc.downloadTool(distUri)
    const pathToUnpack = path.join(os.tmpdir(), `dnscontrol.tmp`)

    switch (true) {
      case distUri.endsWith('tar.gz'):
        await tc.extractTar(distPath, pathToUnpack)
        await io.mv(path.join(pathToUnpack, `dnscontrol`), path.join(pathToInstall, `dnscontrol`))
        break

      case distUri.endsWith('zip'):
        await tc.extractZip(distPath, pathToUnpack)
        await io.mv(path.join(pathToUnpack, `dnscontrol.exe`), path.join(pathToInstall, `dnscontrol.exe`))
        break

      default:
        throw new Error('Unsupported distributive format')
    }

    await io.rmRF(distPath)

    try {
      await cache.saveCache([pathToInstall], cacheKey)
    } catch (e) {
      core.warning(e)
    }
  }

  core.addPath(pathToInstall)
}

/**
 * @returns {Promise<void>}
 *
 * @throws {Error} If binary file not found in $PATH or version check failed
 */
async function doCheck() {
  const binPath = await io.which('dnscontrol', true)

  if (binPath === '') {
    throw new Error('dnscontrol binary file not found in $PATH')
  }

  await exec.exec('dnscontrol', ['version'], {silent: true})

  core.setOutput('dnscontrol-bin', binPath)
  core.info(`DNSControl installed: ${binPath}`)
}

/**
 * @param {string} githubAuthToken
 * @returns {Promise<string>}
 */
async function getLatestVersion(githubAuthToken) {
  /** @type {import('@actions/github')} */
  const octokit = github.getOctokit(githubAuthToken)

  // docs: https://octokit.github.io/rest.js/v18#repos-get-latest-release
  const latest = await octokit.rest.repos.getLatestRelease({
    owner: 'StackExchange',
    repo: 'dnscontrol',
  })

  return latest.data.tag_name.replace(/^[vV]/, '') // strip the 'v' prefix
}

/**
 * @link https://github.com/StackExchange/dnscontrol/releases
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
  const baseUrl = `https://github.com/StackExchange/dnscontrol/releases/download/v${version}`

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
  core.setFailed(error.message)
})
