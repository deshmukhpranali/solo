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
  accountCreationShouldSucceed,
  balanceQueryShouldSucceed,
  e2eTestSuite,
  HEDERA_PLATFORM_VERSION_TAG
} from '../../test_util.js'
import { getNodeLogs, getTmpDir } from '../../../src/core/helpers.js'
import { HEDERA_HAPI_PATH, MINUTES, ROOT_CONTAINER } from '../../../src/core/constants.js'
import fs from 'fs'
import type { NodeAlias, PodName } from '../../../src/types/aliases.js'
import * as NodeCommandConfigs from '../../../src/commands/node/configs.js'
import { ArgvMoc } from '../../argv_moc.js'

const namespace = 'node-delete-separate'
const nodeAlias = 'node1' as NodeAlias
const argv = ArgvMoc.getDefaultArgv()
  .setValue(flags.nodeAliasesUnparsed, 'node1,node2')
  .setValue(flags.nodeAlias, nodeAlias)
  .setValue(flags.stakeAmounts, '1,1000')
  .setValue(flags.generateGossipKeys, true)
  .setValue(flags.generateTlsKeys, true)
  .setValue(flags.persistentVolumeClaims, true)
  .setValue(flags.releaseTag, HEDERA_PLATFORM_VERSION_TAG)
  .setValue(flags.namespace, namespace)

// set the env variable SOLO_CHARTS_DIR if a developer wants to use local Solo charts
argv.setValueWithDefault(flags.chartDirectory, process.env.SOLO_CHARTS_DIR, undefined)

const tempDir = 'contextDir'
const argvPrepare = argv.clone().setValue(flags.outputDir, tempDir)
const argvExecute = ArgvMoc.getDefaultArgv().setValue(flags.inputDir, tempDir)

e2eTestSuite(namespace, argv, {}, true, (bootstrapResp) => {
  describe('Node delete via separated commands', async () => {
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

    it('should delete a node from the network successfully', async () => {
      await nodeCmd.handlers.deletePrepare(argvPrepare.build())
      await nodeCmd.handlers.deleteSubmitTransactions(argvExecute.build())
      await nodeCmd.handlers.deleteExecute(argvExecute.build())
      expect(nodeCmd.getUnusedConfigs(NodeCommandConfigs.DELETE_CONFIGS_NAME)).to.deep.equal([
        flags.devMode.constName,
        flags.force.constName,
        flags.quiet.constName,
        flags.adminKey.constName,
        'freezeAdminPrivateKey'
      ])

      await accountManager.close()
    }).timeout(10 * MINUTES)

    balanceQueryShouldSucceed(accountManager, nodeCmd, namespace)

    accountCreationShouldSucceed(accountManager, nodeCmd, namespace)

    it('config.txt should no longer contain removed nodeAlias', async () => {
      // read config.txt file from first node, read config.txt line by line, it should not contain value of nodeAlias
      const pods = await k8.getPodsByLabel(['solo.hedera.com/type=network-node'])
      const podName = pods[0].metadata.name as PodName
      const tmpDir = getTmpDir()
      await k8.copyFrom(podName, ROOT_CONTAINER, `${HEDERA_HAPI_PATH}/config.txt`, tmpDir)
      const configTxt = fs.readFileSync(`${tmpDir}/config.txt`, 'utf8')
      console.log('config.txt:', configTxt)
      expect(configTxt).not.to.contain(nodeAlias)
    }).timeout(10 * MINUTES)
  })
})
