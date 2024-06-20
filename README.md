# Install [DNSControl][dnscontrol] action

![Release version][badge_release_version]
[![Build Status][badge_build]][link_build]
[![License][badge_license]][link_license]

This action installs [DNSControl][dnscontrol] as a binary file into your workflow. It can be run on **Linux**
(`ubuntu-latest`), **macOS** (`macos-latest`) or **windows** (`windows-latest`).

- 🚀 DNSControl releases page: <https://github.com/StackExchange/dnscontrol/releases>

Additionally, this action uses the GitHub **caching mechanism** to speed up your workflow execution time!

## Usage

```yaml
jobs:
  install-dnscontrol:
    runs-on: ubuntu-latest
    steps:
      - uses: gacts/install-dnscontrol@v1
        #with:
        #  version: 3.20.0 # `latest` by default, but you can set a specific version to install

      - run: dnscontrol version # any dnscontrol command can be executed
```

## Customizing

### Inputs

The following inputs can be used as `step.with` keys:

| Name           |   Type   |        Default        | Required | Description                                                      |
|----------------|:--------:|:---------------------:|:--------:|------------------------------------------------------------------|
| `version`      | `string` |       `latest`        |    no    | DNSControl version to install                                    |
| `github-token` | `string` | `${{ github.token }}` |    no    | GitHub token (for requesting the latest DNSControl version info) |

### Outputs

| Name             |   Type   | Description                        |
|------------------|:--------:|------------------------------------|
| `dnscontrol-bin` | `string` | Path to the DNSControl binary file |

## Releasing

To release a new version:

- Build the action distribution (`make build` or `npm run build`).
- Commit and push changes (including `dist` directory changes - this is important) to the `master|main` branch.
- Publish the new release using the repo releases page (the git tag should follow the `vX.Y.Z` format).

Major and minor git tags (`v1` and `v1.2` if you publish a `v1.2.Z` release) will be updated automatically.

> [!TIP]
> Use [Dependabot](https://bit.ly/45zwLL1) to keep this action updated in your repository.

## Support

[![Issues][badge_issues]][link_issues]
[![Pull Requests][badge_pulls]][link_pulls]

If you find any errors in the action, please [create an issue][link_create_issue] in this repository.

## License

This is open-source software licensed under the [MIT License][link_license].

[badge_build]:https://img.shields.io/github/actions/workflow/status/gacts/install-dnscontrol/tests.yml?branch=master&maxAge=30
[badge_release_version]:https://img.shields.io/github/release/gacts/install-dnscontrol.svg?maxAge=30
[badge_license]:https://img.shields.io/github/license/gacts/install-dnscontrol.svg?longCache=true
[badge_release_date]:https://img.shields.io/github/release-date/gacts/install-dnscontrol.svg?maxAge=180
[badge_commits_since_release]:https://img.shields.io/github/commits-since/gacts/install-dnscontrol/latest.svg?maxAge=45
[badge_issues]:https://img.shields.io/github/issues/gacts/install-dnscontrol.svg?maxAge=45
[badge_pulls]:https://img.shields.io/github/issues-pr/gacts/install-dnscontrol.svg?maxAge=45

[link_build]:https://github.com/gacts/install-dnscontrol/actions
[link_license]:https://github.com/gacts/install-dnscontrol/blob/master/LICENSE
[link_issues]:https://github.com/gacts/install-dnscontrol/issues
[link_create_issue]:https://github.com/gacts/install-dnscontrol/issues/new
[link_pulls]:https://github.com/gacts/install-dnscontrol/pulls

[dnscontrol]:https://github.com/StackExchange/dnscontrol
