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
import { expect } from 'chai'
import { describe, it } from 'mocha'

import { ConfigManager } from '../../../src/core/index.js'
import * as flags from '../../../src/commands/flags.js'
import { testLogger } from '../../test_util.js'
import { ArgvMoc } from '../../argv_moc.js'

describe('ConfigManager', () => {
  describe('update values using argv', () => {
    it('should update string flag value', () => {
      const configManager = new ConfigManager(testLogger)
      const argv = ArgvMoc.create()
      argv.setValue(flags.releaseTag, 'v0.42.5')

      configManager.update(argv.build())
      expect(configManager.getFlag(flags.releaseTag)).to.equal(argv.getValue(flags.releaseTag))

      // ensure non-string values are converted to string
      configManager.reset()
      argv.setValue(flags.releaseTag, true)
      configManager.update(argv.build())
      expect(configManager.getFlag(flags.releaseTag)).not.to.equal(argv.getValue(flags.releaseTag))
      expect(configManager.getFlag(flags.releaseTag)).to.equal(`${argv.getValue(flags.releaseTag)}`)
    })

    it('should update number flag value', () => {
      const configManager = new ConfigManager(testLogger)
      const argv = ArgvMoc.create()
      argv.setValue(flags.replicaCount, 1)

      configManager.update(argv.build())
      expect(configManager.getFlag(flags.replicaCount)).to.deep.equal(argv.getValue(flags.replicaCount))

      // ensure string values are converted to integer
      configManager.reset()
      argv.setValue(flags.replicaCount, '1')
      configManager.update(argv.build())
      expect(configManager.getFlag(flags.replicaCount)).not.to.deep.equal(argv.getValue(flags.replicaCount))
      expect(configManager.getFlag(flags.replicaCount)).to.deep.equal(Number.parseInt(argv.getValue(flags.replicaCount)))
    })

    it('should update boolean flag value', () => {
      const configManager = new ConfigManager(testLogger)

      // boolean values should work
      const argv = ArgvMoc.create()
      argv.setValue(flags.devMode, true)
      configManager.update(argv.build())
      expect(configManager.getFlag(flags.devMode)).to.equal(argv.getValue(flags.devMode))

      // ensure string "false" is converted to boolean
      configManager.reset()
      argv.setValue(flags.devMode, 'false')
      configManager.update(argv.build())
      expect(configManager.getFlag(flags.devMode)).not.to.equal(argv.getValue(flags.devMode))
      expect(configManager.getFlag(flags.devMode)).to.equal(false)

      // ensure string "true" is converted to boolean
      configManager.reset()
      argv.setValue(flags.devMode, 'true')
      configManager.update(argv.build())
      expect(configManager.getFlag(flags.devMode)).not.to.equal(argv.getValue(flags.devMode))
      expect(configManager.getFlag(flags.devMode)).to.equal(true)
    })
  })

  describe('should apply precedence', () => {
    const aliases = {}
    aliases[flags.devMode.name] = [flags.devMode.name, flags.devMode.definition.alias] // mock

    it('should take user input as the first preference', () => {
      // Given: config has value, argv has a different value
      // Expected:  argv should retain the value
      const configManager = new ConfigManager(testLogger)
      configManager.setFlag(flags.devMode, false)
      expect(configManager.getFlag(flags.devMode)).not.to.be.ok

      const argv = ArgvMoc.create()
      argv.setValue(flags.devMode, true) // devMode flag is set in argv but cached config has it

      const argv2 = configManager.applyPrecedence(argv.build() as any, aliases)
      expect(configManager.getFlag(flags.devMode)).to.not.be.ok // shouldn't have changed the config yet
      expect(argv2[flags.devMode.name]).to.be.ok // retain the value
    })

    it('should take default as the last preference', () => {
      // Given: neither config nor argv has the flag value set
      // Expected:  argv should inherit the default flag value
      const configManager = new ConfigManager(testLogger)
      expect(configManager.hasFlag(flags.devMode)).not.to.be.ok // shouldn't have set

      const argv = ArgvMoc.create() // devMode flag is not set in argv and cached config doesn't have it either
      const argv2 = configManager.applyPrecedence(argv.build() as any, aliases)
      expect(configManager.hasFlag(flags.devMode)).to.not.be.ok // shouldn't have set
      expect(argv2[flags.devMode.name]).to.not.be.ok // should have set from the default
    })
  })
})
