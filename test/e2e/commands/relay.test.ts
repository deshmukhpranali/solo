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
import { after, afterEach, describe } from 'mocha'
import { expect } from 'chai'
import each from 'mocha-each'

import { flags } from '../../../src/commands/index.js'
import { e2eTestSuite, HEDERA_PLATFORM_VERSION_TAG, TEST_CLUSTER } from '../../test_util.js'
import * as version from '../../../version.js'
import { getNodeLogs, sleep } from '../../../src/core/helpers.js'
import { RelayCommand } from '../../../src/commands/relay.js'
import { MINUTES } from '../../../src/core/constants.js'
import { ArgvMoc } from '../../argv_moc.js'

const testName = 'relay-cmd-e2e'
const namespace = testName

const argv = ArgvMoc.getDefaultArgv()
  .setValue(flags.namespace, namespace)
  .setValue(flags.releaseTag, HEDERA_PLATFORM_VERSION_TAG)
  .setValue(flags.nodeAliasesUnparsed, 'node1,node2')
  .setValue(flags.generateGossipKeys, true)
  .setValue(flags.generateTlsKeys, true)
  .setValue(flags.clusterName, TEST_CLUSTER)
  .setValue(flags.soloChartVersion, version.SOLO_CHART_VERSION)
  .setValue(flags.force, true)
  .setValue(flags.relayReleaseTag, flags.relayReleaseTag.definition.defaultValue)
  .setValue(flags.quiet, true)

e2eTestSuite(testName, argv, {}, true, (bootstrapResp) => {
  describe('RelayCommand', async () => {
    const { opts } = bootstrapResp
    const { k8, configManager } = opts

    const relayCmd = new RelayCommand(opts)

    after(async () => {
      await getNodeLogs(k8, namespace)
      await k8.deleteNamespace(namespace)
    })

    afterEach(async () => await sleep(5))

    each(['node1', 'node1,node2'])
    .it('relay deploy and destroy should work with $value', async function (relayNodes) {
      this.timeout(5 * MINUTES)

      argv.setValue(flags.nodeAliasesUnparsed, relayNodes)
      configManager.update(argv.build())

      // test relay deploy
      try {
        expect(await relayCmd.deploy(argv.build())).to.be.true
      } catch (e) {
        relayCmd.logger.showUserError(e)
        expect.fail()
      }
      expect(relayCmd.getUnusedConfigs(RelayCommand.DEPLOY_CONFIGS_NAME)).to.deep.equal([
        flags.profileFile.constName,
        flags.profileName.constName,
        flags.quiet.constName
      ])
      await sleep(500)

      // test relay destroy
      try {
        expect(await relayCmd.destroy(argv.build())).to.be.true
      } catch (e) {
        relayCmd.logger.showUserError(e)
        expect.fail()
      }
    })
  })
})
