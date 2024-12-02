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
import sinon from 'sinon'
import { it, describe, after, before, afterEach, beforeEach } from 'mocha'
import { expect } from 'chai'

import { flags } from '../../../src/commands/index.js'
import { bootstrapTestVariables, HEDERA_PLATFORM_VERSION_TAG, TEST_CLUSTER } from '../../test_util.js'
import { constants, logging } from '../../../src/core/index.js'
import { sleep } from '../../../src/core/helpers.js'
import * as version from '../../../version.js'
import { MINUTES, SECONDS } from '../../../src/core/constants.js'
import { ArgvMoc } from '../../argv_moc.js'

describe('ClusterCommand', () => {
  // mock showUser and showJSON to silent logging during tests
  before(() => {
    sinon.stub(logging.SoloLogger.prototype, 'showUser')
    sinon.stub(logging.SoloLogger.prototype, 'showJSON')
  })

  after(() => {
    // @ts-ignore
    logging.SoloLogger.prototype.showUser.restore()
    // @ts-ignore
    logging.SoloLogger.prototype.showJSON.restore()
  })

  const testName = 'cluster-cmd-e2e'
  const namespace = testName
  const argv = ArgvMoc.getDefaultArgv()
    .setValue(flags.namespace, namespace)
    .setValue(flags.releaseTag, HEDERA_PLATFORM_VERSION_TAG)
    .setValue(flags.nodeAliasesUnparsed, 'node1')
    .setValue(flags.generateGossipKeys, true)
    .setValue(flags.generateTlsKeys, true)
    .setValue(flags.clusterName, TEST_CLUSTER)
    .setValue(flags.soloChartVersion, version.SOLO_CHART_VERSION)
    .setValue(flags.force, true)

  //set the env variable SOLO_CHARTS_DIR if a developer wants to use local Solo charts
  argv.setValueWithDefault(flags.chartDirectory, process.env.SOLO_CHARTS_DIR, undefined)

  const bootstrapResp = bootstrapTestVariables(testName, argv)
  const { opts: { k8, configManager, chartManager }, cmd: { clusterCmd } } = bootstrapResp

  after(async function () {
    this.timeout(3 * MINUTES)

    await k8.deleteNamespace(namespace)

    argv.setValue(flags.clusterSetupNamespace, constants.SOLO_SETUP_NAMESPACE)
    configManager.update(argv.build())
    await clusterCmd.setup(argv.build()) // restore solo-cluster-setup for other e2e tests to leverage
    do {
      await sleep(5 * SECONDS)
    } while (!await chartManager.isChartInstalled(constants.SOLO_SETUP_NAMESPACE, constants.SOLO_CLUSTER_SETUP_CHART))
  })

  beforeEach(() => {
    configManager.reset()
    configManager.update(argv.build())
  })

  // give a few ticks so that connections can close
  afterEach(async () => await sleep(5))

  it('should cleanup existing deployment', async () => {
    if (await chartManager.isChartInstalled(constants.SOLO_SETUP_NAMESPACE, constants.SOLO_CLUSTER_SETUP_CHART)) {
      expect(await clusterCmd.reset(argv.build())).to.be.true
    }
  }).timeout(MINUTES)

  it('solo cluster setup should fail with invalid cluster name', async () => {
    argv.setValue(flags.clusterSetupNamespace, 'INVALID')
    configManager.update(argv.build())
    await expect(clusterCmd.setup(argv.build())).to.be.rejectedWith('Error on cluster setup')
  }).timeout(MINUTES)

  it('solo cluster setup should work with valid args', async () => {
    argv.setValue(flags.clusterSetupNamespace, namespace)
    configManager.update(argv.build())
    expect(await clusterCmd.setup(argv.build())).to.be.true
  }).timeout(MINUTES)

  it('function getClusterInfo should return true', () => {
    expect(clusterCmd.getClusterInfo()).to.be.ok
  }).timeout(MINUTES)

  it('function showClusterList should return right true', async () => {
    expect(clusterCmd.showClusterList()).to.be.ok
  }).timeout(MINUTES)

  it('function showInstalledChartList should return right true', async () => {
    // @ts-ignore
    await expect(clusterCmd.showInstalledChartList()).to.eventually.be.undefined
  }).timeout(MINUTES)

  // helm list would return an empty list if given invalid namespace
  it('solo cluster reset should fail with invalid cluster name', async () => {
    argv.setValue(flags.clusterSetupNamespace, 'INVALID')
    configManager.update(argv.build())

    try {
      await expect(clusterCmd.reset(argv.build())).to.be.rejectedWith('Error on cluster reset')
    } catch (e) {
      clusterCmd.logger.showUserError(e)
      expect.fail()
    }
  }).timeout(MINUTES)

  it('solo cluster reset should work with valid args', async () => {
    argv.setValue(flags.clusterSetupNamespace, namespace)
    configManager.update(argv.build())
    expect(await clusterCmd.reset(argv.build())).to.be.true
  }).timeout(MINUTES)
})
