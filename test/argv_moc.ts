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
import type { CommandFlag } from '../src/types/index.js'
import { flags } from '../src/commands/index.js'

type Arguments = Record<string, any>

export class ArgvMoc {
  private command?: string
  private subcommand?: string

  private constructor (private readonly flags: Arguments = {}) {}

  public static create (): ArgvMoc { return new ArgvMoc() }

  public clone (): ArgvMoc { return new ArgvMoc({ ...this.flags }) }

  public setValue (flag: CommandFlag, value: any): this {
    this.flags[flag.name] = value
    return this
  }

  public getValue<T = string> (flag: CommandFlag): T {
    return this.flags[flag.name]
  }

  public setValueWithDefault <T = string> (flag: CommandFlag, value: T, defaultValue: T): T  {
    return this.flags[flag.name] = value ?? defaultValue
  }

  public setValueIfIsNotSet <T> (flag: CommandFlag, defaultValue: T): T {
    return this.flags[flag.name] = this.flags.hasOwnProperty(flag.name) ? this.flags[flag.name] : defaultValue
  }

  public setCommand (...command: string[]): this {
    if (command[0]) this.command = command[0]
    if (command[1]) this.subcommand = command[1]
    return this
  }

  /** Get argv with defaults */
  public static getDefaultArgv (): ArgvMoc {
    const argv = ArgvMoc.create()

    for (const f of flags.allFlags) {
      argv.setValue(f, f.definition.defaultValue)
    }

    return argv
  }

  public build (): Arguments {
   const args: Arguments = { _: [] }

    if (this.command) args._.push(this.command)
    if (this.subcommand) args._.push(this.subcommand)

    Object.assign(args, this.flags)

    return args
  }
}