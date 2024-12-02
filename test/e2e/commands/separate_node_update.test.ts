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
import { constants } from '../../../src/core/index.js'
import {
  accountCreationShouldSucceed,
  balanceQueryShouldSucceed,
  e2eTestSuite,
  getNodeAliasesPrivateKeysHash, getTmpDir,
  HEDERA_PLATFORM_VERSION_TAG
} from '../../test_util.js'
import { getNodeLogs } from '../../../src/core/helpers.js'
import { HEDERA_HAPI_PATH, MINUTES, ROOT_CONTAINER } from '../../../src/core/constants.js'
import fs from 'fs'
import type { NodeAlias, PodName } from '../../../src/types/aliases.js'
import * as NodeCommandConfigs from '../../../src/commands/node/configs.js'
import type { NetworkNodeServices } from '../../../src/core/network_node_services.js'
import { ArgvMoc } from '../../argv_moc.js'

const defaultTimeout = 2 * MINUTES
const namespace = 'node-update-separate'
const updateNodeId = 'node2'
const newAccountId = '0.0.7'

const argv = ArgvMoc.getDefaultArgv()
  .setValue(flags.nodeAliasesUnparsed, 'node1,node2,node3')
  .setValue(flags.nodeAlias, updateNodeId)
  .setValue(flags.newAccountNumber, newAccountId)
  .setValue(flags.newAdminKey, '302e020100300506032b6570042204200cde8d512569610f184b8b399e91e46899805c6171f7c2b8666d2a417bcc66c2')
  .setValue(flags.generateGossipKeys, true)
  .setValue(flags.generateTlsKeys, true)
  .setValue(flags.releaseTag, HEDERA_PLATFORM_VERSION_TAG)
  .setValue(flags.namespace, namespace)
  .setValue(flags.persistentVolumeClaims, true)
  .setValue(flags.quiet, true)

//set the env variable SOLO_CHARTS_DIR if a developer wants to use local Solo charts
argv.setValueWithDefault(flags.chartDirectory, process.env.SOLO_CHARTS_DIR, undefined)

e2eTestSuite(namespace, argv, {}, true, (bootstrapResp) => {
  describe('Node update via separated commands', async () => {
    const { opts: { k8, accountManager, keyManager, logger }, cmd: { nodeCmd, accountCmd } } = bootstrapResp

    let existingServiceMap: Map<NodeAlias, NetworkNodeServices>
    let existingNodeIdsPrivateKeysHash: Map<NodeAlias, Map<string, string>>

    after(async function () {
      this.timeout(10 * MINUTES)

      await getNodeLogs(k8, namespace)
      await nodeCmd.handlers.stop(argv.build())
      await k8.deleteNamespace(namespace)
    })

    it('cache current version of private keys', async () => {
      existingServiceMap = await accountManager.getNodeServiceMap(namespace)
      existingNodeIdsPrivateKeysHash = await getNodeAliasesPrivateKeysHash(existingServiceMap, namespace, k8, getTmpDir())
    }).timeout(8 * MINUTES)

    it('should succeed with init command', async () => {
      const status = await accountCmd.init(argv.build())
      expect(status).to.be.ok
    }).timeout(8 * MINUTES)

    it('should update a new node property successfully', async () => {
      // generate gossip and tls keys for the updated node
      const tmpDir = getTmpDir()

      const signingKey = await keyManager.generateSigningKey(updateNodeId)
      const signingKeyFiles = await keyManager.storeSigningKey(updateNodeId, signingKey, tmpDir)
      logger.debug(`generated test gossip signing keys for node ${updateNodeId} : ${signingKeyFiles.certificateFile}`)

      argv
        .setValue(flags.gossipPublicKey, signingKeyFiles.certificateFile)
        .setValue(flags.gossipPrivateKey, signingKeyFiles.privateKeyFile)

      const tlsKey = await keyManager.generateGrpcTlsKey(updateNodeId)
      const tlsKeyFiles = await keyManager.storeTLSKey(updateNodeId, tlsKey, tmpDir)
      logger.debug(`generated test TLS keys for node ${updateNodeId} : ${tlsKeyFiles.certificateFile}`)

      argv
        .setValue(flags.tlsPublicKey, tlsKeyFiles.certificateFile)
        .setValue(flags.tlsPrivateKey, tlsKeyFiles.privateKeyFile)

      const tempDir = 'contextDir'
      const argvPrepare = argv.clone().setValue(flags.outputDir, tempDir)
      const argvExecute = ArgvMoc.getDefaultArgv().setValue(flags.inputDir, tempDir)

      await nodeCmd.handlers.updatePrepare(argvPrepare.build())
      await nodeCmd.handlers.updateSubmitTransactions(argvExecute.build())
      await nodeCmd.handlers.updateExecute(argvExecute.build())

      expect(nodeCmd.getUnusedConfigs(NodeCommandConfigs.UPDATE_CONFIGS_NAME)).to.deep.equal([
        flags.devMode.constName,
        flags.quiet.constName,
        flags.force.constName,
        flags.gossipEndpoints.constName,
        flags.grpcEndpoints.constName,
        'freezeAdminPrivateKey'
      ])
      await accountManager.close()
    }).timeout(30 * MINUTES)

    balanceQueryShouldSucceed(accountManager, nodeCmd, namespace)

    accountCreationShouldSucceed(accountManager, nodeCmd, namespace)

    it('signing key and tls key should not match previous one', async () => {
      const currentNodeIdsPrivateKeysHash = await getNodeAliasesPrivateKeysHash(existingServiceMap, namespace, k8, getTmpDir())

      for (const [nodeAlias, existingKeyHashMap] of existingNodeIdsPrivateKeysHash.entries()) {
        const currentNodeKeyHashMap = currentNodeIdsPrivateKeysHash.get(nodeAlias)

        for (const [keyFileName, existingKeyHash] of existingKeyHashMap.entries()) {
          if (nodeAlias === updateNodeId &&
              (keyFileName.startsWith(constants.SIGNING_KEY_PREFIX) || keyFileName.startsWith('hedera'))) {
            expect(`${nodeAlias}:${keyFileName}:${currentNodeKeyHashMap.get(keyFileName)}`).not.to.equal(
                `${nodeAlias}:${keyFileName}:${existingKeyHash}`)
          } else {
            expect(`${nodeAlias}:${keyFileName}:${currentNodeKeyHashMap.get(keyFileName)}`).to.equal(
                `${nodeAlias}:${keyFileName}:${existingKeyHash}`)
          }
        }
      }
    }).timeout(defaultTimeout)

    it('config.txt should be changed with new account id', async () => {
      // read config.txt file from the first node, read config.txt line by line, it should not contain value of newAccountId
      const pods = await k8.getPodsByLabel(['solo.hedera.com/type=network-node'])
      const podName = pods[0].metadata.name as PodName
      const tmpDir = getTmpDir()
      await k8.copyFrom(podName, ROOT_CONTAINER, `${HEDERA_HAPI_PATH}/config.txt`, tmpDir)
      const configTxt = fs.readFileSync(`${tmpDir}/config.txt`, 'utf8')
      console.log('config.txt:', configTxt)

      expect(configTxt).to.contain(newAccountId)
    }).timeout(10 * MINUTES)
  })
})
