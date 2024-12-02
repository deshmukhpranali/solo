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
import { describe, } from 'mocha'

import { flags } from '../../../src/commands/index.js'
import { e2eTestSuite, TEST_CLUSTER } from '../../test_util.js'
import { getNodeLogs } from '../../../src/core/helpers.js'
import { MINUTES } from '../../../src/core/constants.js'
import { ArgvMoc } from '../../argv_moc.js'

const LOCAL_PTT = 'local-ptt-app'
const argv = ArgvMoc.getDefaultArgv()
  .setValue(flags.nodeAliasesUnparsed, 'node1,node2,node3')
  .setValue(flags.generateGossipKeys, true)
  .setValue(flags.generateTlsKeys, true)
  .setValue(flags.clusterName, TEST_CLUSTER)
  .setValue(flags.quiet, true)

console.log('Starting local build for Platform app')

argv
  .setValue(flags.localBuildPath, '../hedera-services/platform-sdk/sdk/data,node1=../hedera-services/platform-sdk/sdk/data,node2=../hedera-services/platform-sdk/sdk/data')
  .setValue(flags.app, 'PlatformTestingTool.jar')
  .setValue(flags.appConfig, '../hedera-services/platform-sdk/platform-apps/tests/PlatformTestingTool/src/main/resources/FCMFCQ-Basic-2.5k-5m.json')
  .setValue(flags.namespace, LOCAL_PTT)

//set the env variable SOLO_CHARTS_DIR if a developer wants to use local Solo charts
argv.setValueWithDefault(flags.chartDirectory, process.env.SOLO_CHARTS_DIR, undefined)

e2eTestSuite(LOCAL_PTT, argv, {}, true, (bootstrapResp) => {
  describe('Node for platform app should start successfully', () => {
    const pttK8 = bootstrapResp.opts.k8

    it('get the logs and delete the namespace',async function () {
      await getNodeLogs(pttK8, LOCAL_PTT)
      await pttK8.deleteNamespace(LOCAL_PTT)
    }).timeout(2 * MINUTES)
  })
})
