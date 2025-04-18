// SPDX-License-Identifier: Apache-2.0

import {type ConfigSource} from './config-source.js';
import {type Schema} from '../../schema/migration/api/schema.js';

export interface ModelConfigSource<T> extends ConfigSource {
  /**
   * The schema that defines the structure of the model.
   */
  readonly schema: Schema<T>;

  /**
   * The model data that was read from the configuration source.
   */
  readonly modelData: T;
}
