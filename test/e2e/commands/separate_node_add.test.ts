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
  getNodeAliasesPrivateKeysHash, getTmpDir,
  HEDERA_PLATFORM_VERSION_TAG
} from '../../test_util.js'
import { getNodeLogs } from '../../../src/core/helpers.js'
import * as NodeCommandConfigs from '../../../src/commands/node/configs.js'
import { MINUTES } from '../../../src/core/constants.js'
import type { NetworkNodeServices } from '../../../src/core/network_node_services.js'
import { ArgvMoc } from '../../argv_moc.js'

const defaultTimeout = 2 * MINUTES
const namespace = 'node-add-separated'

const argv = ArgvMoc.getDefaultArgv()
  .setValue(flags.nodeAliasesUnparsed, 'node1,node2')
  .setValue(flags.stakeAmounts, '1500,1')
  .setValue(flags.generateGossipKeys, true)
  .setValue(flags.generateTlsKeys, true)
  .setValue(flags.releaseTag, HEDERA_PLATFORM_VERSION_TAG)
  .setValue(flags.namespace, namespace)
  .setValue(flags.force, true)
  .setValue(flags.persistentVolumeClaims, true)
  .setValue(flags.quiet, true)

// set the env variable SOLO_CHARTS_DIR if a developer wants to use local Solo charts
argv.setValueWithDefault(flags.chartDirectory, process.env.SOLO_CHARTS_DIR, undefined)

const tempDir = 'contextDir'
const argvPrepare = argv.clone().setValue(flags.outputDir, tempDir)
const argvExecute = ArgvMoc.getDefaultArgv().setValue(flags.inputDir, tempDir)

e2eTestSuite(namespace, argv, {}, true, (bootstrapResp) => {
  describe('Node add via separated commands should success', async () => {
    const { opts: { k8, accountManager }, cmd: { nodeCmd, accountCmd, networkCmd } } = bootstrapResp

    let existingServiceMap: Map<`node${number}`, NetworkNodeServices>
    let existingNodeIdsPrivateKeysHash: Map<`node${number}`, Map<string, string>>

    after(async function () {
      this.timeout(10 * MINUTES)

      await getNodeLogs(k8, namespace)
      // @ts-ignore
      await accountManager.close()
      await nodeCmd.handlers.stop(argv.build())
      await networkCmd.destroy(argv.build())
      await k8.deleteNamespace(namespace)
    })

    it('cache current version of private keys', async () => {
      // @ts-ignore
      existingServiceMap = await accountManager.getNodeServiceMap(namespace)
      existingNodeIdsPrivateKeysHash = await getNodeAliasesPrivateKeysHash(existingServiceMap, namespace, k8, getTmpDir())
    }).timeout(defaultTimeout)

    it('should succeed with init command', async () => {
      const status = await accountCmd.init(argv.build())
      expect(status).to.be.ok
    }).timeout(8 * MINUTES)

    it('should add a new node to the network via the segregated commands successfully', async () => {
      await nodeCmd.handlers.addPrepare(argvPrepare.build())
      await nodeCmd.handlers.addSubmitTransactions(argvExecute.build())
      await nodeCmd.handlers.addExecute(argvExecute.build())
      expect(nodeCmd.getUnusedConfigs(NodeCommandConfigs.ADD_CONFIGS_NAME)).to.deep.equal([
        flags.gossipEndpoints.constName,
        flags.grpcEndpoints.constName,
        flags.devMode.constName,
        flags.force.constName,
        flags.quiet.constName,
        'chartPath',
        'curDate',
        'freezeAdminPrivateKey'
      ])
      await accountManager.close()
    }).timeout(12 * MINUTES)

    balanceQueryShouldSucceed(accountManager, nodeCmd, namespace)

    accountCreationShouldSucceed(accountManager, nodeCmd, namespace)

    it('existing nodes private keys should not have changed', async () => {
      const currentNodeIdsPrivateKeysHash = await getNodeAliasesPrivateKeysHash(existingServiceMap, namespace, k8, getTmpDir())

      for (const [nodeAlias, existingKeyHashMap] of existingNodeIdsPrivateKeysHash.entries()) {
        const currentNodeKeyHashMap = currentNodeIdsPrivateKeysHash.get(nodeAlias)

        for (const [keyFileName, existingKeyHash] of existingKeyHashMap.entries()) {
          expect(`${nodeAlias}:${keyFileName}:${currentNodeKeyHashMap.get(keyFileName)}`).to.equal(
              `${nodeAlias}:${keyFileName}:${existingKeyHash}`)
        }
      }
    }).timeout(defaultTimeout)
  }).timeout(3 * MINUTES)
})
