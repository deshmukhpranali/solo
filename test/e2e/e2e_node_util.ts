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
import { it, describe, after, before, afterEach } from 'mocha'
import { expect } from 'chai'

import { flags } from '../../src/commands/index.js'
import {
  accountCreationShouldSucceed,
  balanceQueryShouldSucceed,
  e2eTestSuite,
  HEDERA_PLATFORM_VERSION_TAG,
  TEST_CLUSTER, testLogger
} from '../test_util.js'
import { getNodeLogs, sleep } from '../../src/core/helpers.js'
import * as NodeCommandConfigs from '../../src/commands/node/configs.js'
import { MINUTES, SECONDS } from '../../src/core/constants.js'
import type { NodeAlias } from '../../src/types/aliases.js'
import type { ListrTaskWrapper } from 'listr2'
import { ConfigManager, type K8 } from '../../src/core/index.js'
import type { NodeCommand } from '../../src/commands/node/index.js'
import { ArgvMoc } from '../argv_moc.js'

export function e2eNodeKeyRefreshTest (testName: string, mode: string, releaseTag = HEDERA_PLATFORM_VERSION_TAG) {
  const namespace = testName
  const argv = ArgvMoc.getDefaultArgv()
    .setValue(flags.namespace, namespace)
    .setValue(flags.releaseTag, releaseTag)
    .setValue(flags.nodeAliasesUnparsed, 'node1,node2,node3')
    .setValue(flags.generateGossipKeys, true)
    .setValue(flags.generateTlsKeys, true)
    .setValue(flags.clusterName, TEST_CLUSTER)
    .setValue(flags.devMode, true)
    .setValue(flags.quiet, true)

  //set the env variable SOLO_CHARTS_DIR if a developer wants to use local Solo charts
  argv.setValueWithDefault(flags.chartDirectory, process.env.SOLO_CHARTS_DIR, undefined)

  e2eTestSuite(testName, argv, {}, true, (bootstrapResp) => {
    const defaultTimeout = 2 * MINUTES

    describe(`NodeCommand [testName ${testName}, mode ${mode}, release ${releaseTag}]`, async () => {
      const { opts: { accountManager, k8 }, cmd: { nodeCmd } } = bootstrapResp

      afterEach(async function () {
        this.timeout(defaultTimeout)

        await nodeCmd.close()
        await accountManager.close()
      })

      after(async function () {
        this.timeout(10 * MINUTES)

        await getNodeLogs(k8, namespace)
        await k8.deleteNamespace(namespace)
      })

      describe(`Node should have started successfully [mode ${mode}, release ${releaseTag}]`, () => {
        balanceQueryShouldSucceed(accountManager, nodeCmd, namespace)

        accountCreationShouldSucceed(accountManager, nodeCmd, namespace)

        it(`Node Proxy should be UP [mode ${mode}, release ${releaseTag}`, async () => {
          try {
            const labels = ['app=haproxy-node1', 'solo.hedera.com/type=haproxy']
            const readyPods = await k8.waitForPodReady(labels, 1, 300, 1000)
            expect(readyPods).to.not.be.null
            expect(readyPods).to.not.be.undefined
            expect(readyPods.length).to.be.greaterThan(0)
          } catch (e) {
            nodeCmd.logger.showUserError(e)
            expect.fail()
          } finally {
            await nodeCmd.close()
          }
        }).timeout(defaultTimeout)
      })

      describe(`Node should refresh successfully [mode ${mode}, release ${releaseTag}]`, () => {
        const nodeAlias = 'node1'

        before(async function () {
          this.timeout(2 * MINUTES)

          const podName = await nodeRefreshTestSetup(argv, testName, k8, nodeAlias)
          if (mode === 'kill') {
            const resp = await k8.kubeClient.deleteNamespacedPod(podName,
                namespace)
            expect(resp.response.statusCode).to.equal(200)
            await sleep(20 * SECONDS) // sleep to wait for pod to finish terminating
          } else if (mode === 'stop') {
            expect(await nodeCmd.handlers.stop(argv.build())).to.be.true
            await sleep(20 * SECONDS) // give time for node to stop and update its logs
          } else {
            throw new Error(`invalid mode: ${mode}`)
          }
        })

        nodePodShouldBeRunning(nodeCmd, namespace, nodeAlias)

        nodeShouldNotBeActive(nodeCmd, nodeAlias)

        nodeRefreshShouldSucceed(nodeAlias, nodeCmd, argv)

        balanceQueryShouldSucceed(accountManager, nodeCmd, namespace)

        accountCreationShouldSucceed(accountManager, nodeCmd, namespace)
      })

      function nodePodShouldBeRunning (nodeCmd: NodeCommand, namespace: string, nodeAlias: NodeAlias) {
        it(`${nodeAlias} should be running`, async () => {
          try {
            // @ts-ignore to access tasks which is a private property
            expect(await nodeCmd.tasks.checkNetworkNodePod(namespace,
                nodeAlias)).to.equal(`network-${nodeAlias}-0`)
          } catch (e) {
            nodeCmd.logger.showUserError(e)
            expect.fail()
          } finally {
            await nodeCmd.close()
          }
        }).timeout(defaultTimeout)
      }

      function nodeRefreshShouldSucceed (nodeAlias: NodeAlias, nodeCmd: NodeCommand, argv: ArgvMoc) {
        it(`${nodeAlias} refresh should succeed`, async () => {
          try {
            expect(await nodeCmd.handlers.refresh(argv.build())).to.be.true
            expect(nodeCmd.getUnusedConfigs(
                NodeCommandConfigs.REFRESH_CONFIGS_NAME)).to.deep.equal([
              flags.devMode.constName,
              flags.quiet.constName
            ])
          } catch (e) {
            nodeCmd.logger.showUserError(e)
            expect.fail()
          } finally {
            await nodeCmd.close()
            await sleep(10 * SECONDS) // sleep to wait for node to finish starting
          }
        }).timeout(20 * MINUTES)
      }

      function nodeShouldNotBeActive (nodeCmd: NodeCommand, nodeAlias: NodeAlias) {
        it(`${nodeAlias} should not be ACTIVE`, async () => {
          expect(2)
          try {
            await expect(
                nodeCmd.tasks._checkNetworkNodeActiveness(namespace, nodeAlias, { title: '' } as ListrTaskWrapper<any, any, any>,
                    '', 44, undefined, 15)
            ).to.be.rejected
          } catch (e) {
            expect(e).not.to.be.null
          } finally {
            await nodeCmd.close()
          }
        }).timeout(defaultTimeout)
      }

      async function nodeRefreshTestSetup (argv: ArgvMoc, testName: string, k8: K8, nodeAliases: string) {
        argv.setValue(flags.nodeAliasesUnparsed, nodeAliases)
        const configManager = new ConfigManager(testLogger)
        configManager.update(argv.build())

        const podArray = await k8.getPodsByLabel(
            [`app=network-${nodeAliases}`,
              'solo.hedera.com/type=network-node'])

        if (podArray.length > 0) {
          const podName = podArray[0].metadata.name
          k8.logger.info(`nodeRefreshTestSetup: podName: ${podName}`)
          return podName
        }
        throw new Error(`pod for ${nodeAliases} not found`)

      }
    })
  })
}
