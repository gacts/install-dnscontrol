const core = require('@actions/core') // docs: https://github.com/actions/toolkit/tree/main/packages/core
const tc = require('@actions/tool-cache') // docs: https://github.com/actions/toolkit/tree/main/packages/tool-cache
const github = require('@actions/github') // docs: https://github.com/actions/toolkit/tree/main/packages/github
const io = require('@actions/io') // docs: https://github.com/actions/toolkit/tree/main/packages/io
const cache = require('@actions/cache') // docs: https://github.com/actions/toolkit/tree/main/packages/cache
const exec = require('@actions/exec') // docs: https://github.com/actions/toolkit/tree/main/packages/exec
const path = require('path')
const os = require('os')
const fs = require('fs/promises')

// read action inputs
const input = {
  version: core.getInput('version', {required: true}).replace(/^v/, ''), // strip the 'v' prefix
  githubToken: core.getInput('github-token'),
}

// main action entrypoint
async function runAction() {
  let version

  if (input.version.toLowerCase() === 'latest') {
    core.debug('Requesting latest DNSControl version...')
    version = await getLatestDNSControlVersion(input.githubToken)
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
 * @throws
 */
async function doInstall(version) {
  const pathToInstall = path.join(os.tmpdir(), `dnscontrol-${version}`)
  const cacheKey = `dnscontrol-cache-${version}-${process.platform}-${process.arch}`

  core.info(`Version to install: ${version} (target directory: ${pathToInstall})`)

  let restoredFromCache = undefined

  try {
    restoredFromCache = await cache.restoreCache([pathToInstall], cacheKey)
  } catch (e) {
    core.warning(e)
  }

  if (restoredFromCache !== undefined) { // cache HIT
    core.info(`👌 DNSControl restored from cache`)
  } else { // cache MISS
    const distUri = getDNSControlURI(process.platform, process.arch, version)
    const distPath = await tc.downloadTool(distUri, path.join(os.tmpdir(), `dnscontrol.tmp`))
    const binPath = path.join(pathToInstall, 'dnscontrol')

    await io.mkdirP(pathToInstall)
    await io.mv(distPath, binPath)
    await fs.chmod(binPath, 0o755)

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
 * @throws
 */
async function doCheck() {
  const dnscontrolBinPath = await io.which('dnscontrol', true)

  if (dnscontrolBinPath === "") {
    throw new Error('dnscontrol binary file not found in $PATH')
  }

  await exec.exec('dnscontrol', ['version'], {silent: true})

  core.setOutput('dnscontrol-bin', dnscontrolBinPath)

  core.info(`DNSControl installed: ${dnscontrolBinPath}`)
}

/**
 * @param {string} githubAuthToken
 * @returns {Promise<string>}
 */
async function getLatestDNSControlVersion(githubAuthToken) {
  const octokit = github.getOctokit(githubAuthToken)

  // docs: https://octokit.github.io/rest.js/v18#repos-get-latest-release
  const latest = await octokit.rest.repos.getLatestRelease({
    owner: 'StackExchange',
    repo: 'dnscontrol',
  })

  return latest.data.tag_name.replace(/^v/, '') // strip the 'v' prefix
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
 * @throws
 */
function getDNSControlURI(platform, arch, version) {
  switch (platform) {
    case 'linux': {
      switch (arch) {
        case 'x64': // Amd64
          return `https://github.com/StackExchange/dnscontrol/releases/download/v${version}/dnscontrol_${version}_linux_amd64.tar.gz`

        case 'arm': // Arm
          return `https://github.com/StackExchange/dnscontrol/releases/download/v${version}/dnscontrol_${version}_linux_arm64.tar.gz`
      }

      throw new Error('Unsupported linux architecture')
    }

    case 'darwin': {
      switch (arch) {
        case 'x64': // Amd64
        case 'arm': // Arm
          return `https://github.com/StackExchange/dnscontrol/releases/download/v${version}/dnscontrol_${version}_darwin_all.tar.gz`
      }

      throw new Error('Unsupported MacOS architecture')
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
