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
import { it, describe, after } from 'mocha'
import { expect } from 'chai'

import { flags } from '../../../src/commands/index.js'
import {
  e2eTestSuite,
  HEDERA_PLATFORM_VERSION_TAG
} from '../../test_util.js'
import { getNodeLogs } from '../../../src/core/helpers.js'
import {
  PREPARE_UPGRADE_CONFIGS_NAME,
  DOWNLOAD_GENERATED_FILES_CONFIGS_NAME
} from '../../../src/commands/node/configs.js'
import { MINUTES } from '../../../src/core/constants.js'
import { ArgvMoc } from '../../argv_moc.js'

const namespace = 'node-upgrade'
const argv = ArgvMoc.getDefaultArgv()
  .setValue(flags.nodeAliasesUnparsed, 'node1,node2,node3')
  .setValue(flags.generateGossipKeys, true)
  .setValue(flags.generateTlsKeys, true)
  .setValue(flags.persistentVolumeClaims, true)
  .setValue(flags.releaseTag, HEDERA_PLATFORM_VERSION_TAG)
  .setValue(flags.namespace, namespace)

// set the env variable SOLO_CHARTS_DIR if a developer wants to use local solo charts
argv.setValueWithDefault(flags.chartDirectory, process.env.SOLO_CHARTS_DIR, undefined)

const upgradeArgv = ArgvMoc.getDefaultArgv()

e2eTestSuite(namespace, argv, {}, true, (bootstrapResp) => {
  describe('Node upgrade', async () => {
    const { opts: { k8, accountManager }, cmd: { nodeCmd, accountCmd } } = bootstrapResp

    after(async function () {
      this.timeout(10 * MINUTES)

      await getNodeLogs(k8, namespace)
      await k8.deleteNamespace(namespace)
    })

    it('should succeed with init command', async () => {
      const status = await accountCmd.init(argv.build())
      expect(status).to.be.ok
    }).timeout(8 * MINUTES)

    it('should prepare network upgrade successfully', async () => {
      await nodeCmd.handlers.prepareUpgrade(upgradeArgv)
      expect(nodeCmd.getUnusedConfigs(PREPARE_UPGRADE_CONFIGS_NAME)).to.deep.equal([
        flags.devMode.constName
      ])
    }).timeout(5 * MINUTES)

    it('should download generated files successfully', async () => {
      await nodeCmd.handlers.downloadGeneratedFiles(upgradeArgv)
      expect(nodeCmd.getUnusedConfigs(DOWNLOAD_GENERATED_FILES_CONFIGS_NAME)).to.deep.equal([
        flags.devMode.constName,
        'allNodeAliases'
      ])
    }).timeout(5 * MINUTES)

    it('should upgrade all nodes on the network successfully', async () => {
      await nodeCmd.handlers.freezeUpgrade(upgradeArgv)
      expect(nodeCmd.getUnusedConfigs(PREPARE_UPGRADE_CONFIGS_NAME)).to.deep.equal([
        flags.devMode.constName
      ])

      await accountManager.close()
    }).timeout(5 * MINUTES)
  })
})
