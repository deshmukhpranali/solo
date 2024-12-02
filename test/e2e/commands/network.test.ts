/**
 * Copyright (C) 2024 Hedera Hashgraph, LLC
 *
 * Licensed under the Apache License, Version 2.0 (the ""License"");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an ""AS IS"" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
import { it, describe, after, before } from 'mocha'
import { expect } from 'chai'

import {
  bootstrapTestVariables,
  getTmpDir,
  HEDERA_PLATFORM_VERSION_TAG
} from '../../test_util.js'
import { constants } from '../../../src/core/index.js'
import * as version from '../../../version.js'
import { getNodeLogs, sleep } from '../../../src/core/helpers.js'
import path from 'path'
import fs from 'fs'
import { NetworkCommand } from '../../../src/commands/network.js'
import { MINUTES, SECONDS } from '../../../src/core/constants.js'
import { flags } from '../../../src/commands/index.js'
import { ArgvMoc } from '../../argv_moc.js'

describe('NetworkCommand', () => {
  const testName = 'network-cmd-e2e'
  const namespace = testName
  const applicationEnvFileContents = '# row 1\n# row 2\n# row 3'
  const applicationEnvParentDirectory = path.join(getTmpDir(), 'network-command-test')
  const applicationEnvFilePath = path.join(applicationEnvParentDirectory, 'application.env')

  const argv = ArgvMoc.getDefaultArgv()
    .setValue(flags.namespace, namespace)
    .setValue(flags.releaseTag, HEDERA_PLATFORM_VERSION_TAG)
    .setValue(flags.nodeAliasesUnparsed, 'node1')
    .setValue(flags.generateGossipKeys, true)
    .setValue(flags.generateTlsKeys, true)
    .setValue(flags.deployMinio, true)
    .setValue(flags.soloChartVersion, version.SOLO_CHART_VERSION)
    .setValue(flags.force, true)
    .setValue(flags.applicationEnv, applicationEnvFilePath)
    .setValue(flags.quiet, true)

  // set the env variable SOLO_CHARTS_DIR if a developer wants to use local Solo charts
  argv.setValueWithDefault(flags.chartDirectory, process.env.SOLO_CHARTS_DIR, undefined)

  const {
    opts: { k8, accountManager, configManager, chartManager },
    cmd: { networkCmd, clusterCmd, initCmd, nodeCmd }
  } = bootstrapTestVariables(testName, argv)

  after(async function () {
    this.timeout(3 * MINUTES)

    await getNodeLogs(k8, namespace)
    await k8.deleteNamespace(namespace)
    await accountManager.close()
  })

  before(async () => {
    await initCmd.init(argv.build())
    await clusterCmd.setup(argv.build())
    fs.mkdirSync(applicationEnvParentDirectory, { recursive: true })
    fs.writeFileSync(applicationEnvFilePath, applicationEnvFileContents)
  })

  it('keys should be generated', async () => {
    expect(await nodeCmd.handlers.keys(argv.build())).to.be.true
  })

  it('network deploy command should succeed', async () => {
    try {
      expect(await networkCmd.deploy(argv.build())).to.be.true

      // check pod names should match expected values
      await expect(k8.getPodByName('network-node1-0'))
        .eventually.to.have.nested.property('metadata.name', 'network-node1-0')
      // get list of pvc using k8 listPvcsByNamespace function and print to log
      const pvcs = await k8.listPvcsByNamespace(namespace)
      networkCmd.logger.showList('PVCs', pvcs)

      expect(networkCmd.getUnusedConfigs(NetworkCommand.DEPLOY_CONFIGS_NAME)).to.deep.equal([
        flags.apiPermissionProperties.constName,
        flags.applicationEnv.constName,
        flags.applicationProperties.constName,
        flags.bootstrapProperties.constName,
        flags.chainId.constName,
        flags.log4j2Xml.constName,
        flags.profileFile.constName,
        flags.profileName.constName,
        flags.quiet.constName,
        flags.settingTxt.constName,
        flags.grpcTlsKeyPath.constName,
        flags.grpcWebTlsKeyPath.constName,
        'chartPath'
      ])
    } catch (e) {
      networkCmd.logger.showUserError(e)
      expect.fail()
    }
  }).timeout(4 * MINUTES)

  it('application env file contents should be in cached values file', () => {
    // @ts-ignore in order to access the private property
    const valuesYaml = fs.readFileSync(networkCmd.profileValuesFile).toString()
    const fileRows = applicationEnvFileContents.split('\n')
    for (const fileRow of fileRows) {
      expect(valuesYaml).to.contain(fileRow)
    }
  })

  it('network destroy should success', async () => {
    argv.setValue(flags.deletePvcs, true)
    argv.setValue(flags.deleteSecrets, true)
    argv.setValue(flags.force, true)
    configManager.update(argv.build())

    try {
      const destroyResult = await networkCmd.destroy(argv.build())
      expect(destroyResult).to.be.true

      while ((await k8.getPodsByLabel(['solo.hedera.com/type=network-node'])).length > 0) {
        networkCmd.logger.debug('Pods are still running. Waiting...')
        await sleep(3 * SECONDS)
      }

      while ((await k8.getPodsByLabel(['app=minio'])).length > 0) {
        networkCmd.logger.showUser('Waiting for minio container to be deleted...')
        await sleep(3 * SECONDS)
      }

      // check if the chart is uninstalled
      const chartInstalledStatus = await chartManager.isChartInstalled(namespace, constants.SOLO_DEPLOYMENT_CHART)
      expect(chartInstalledStatus).to.be.false

      // check if pvc are deleted
      await expect(k8.listPvcsByNamespace(namespace)).eventually.to.have.lengthOf(0)

      // check if secrets are deleted
      await expect(k8.listSecretsByNamespace(namespace)).eventually.to.have.lengthOf(0)
    } catch (e) {
      networkCmd.logger.showUserError(e)
      expect.fail()
    }
  }).timeout(2 * MINUTES)
})
