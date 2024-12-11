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
import type {NodeAlias, NodeAliases} from '../../types/aliases.js';
import {GenesisNetworkNodeDataWrapper} from './genesisNetworkNodeDataWrapper.js';
import {Templates} from '../templates.js';
import {KeyManager} from '../key_manager.js';

import crypto from 'node:crypto';
import {PrivateKey} from '@hashgraph/sdk';
import {constants} from '../index.js';

export class GenesisNetworkDataConstructor {
  public readonly nodes: Record<NodeAlias, GenesisNetworkNodeDataWrapper>;

  constructor (public readonly nodeAliases: NodeAliases) {
    this.nodeAliases.forEach(nodeAlias => {
      this.nodes[nodeAlias] = new GenesisNetworkNodeDataWrapper(Templates.nodeIdFromNodeAlias(nodeAlias))

      const adminKey = PrivateKey.fromStringED25519(constants.GENESIS_KEY)
      this.nodes[nodeAlias].adminKey = adminKey.publicKey
    })
  }

  /**
   * @param keyManager
   * @param keysDir - !!! config.keysDir !!!
   */
  async load (keyManager: KeyManager, keysDir: string) {
    await Promise.all(this.nodeAliases.map(async nodeAlias => {
      const nodeKeys = await keyManager.loadSigningKey(nodeAlias, keysDir);

      this.nodes[nodeAlias].gossipCaCertificate = nodeKeys.certificate.toString()

      const certificate = nodeKeys.certificate.toString();

      // TODO: change parameters
      const hash = crypto.createHash('sha256').update(certificate).digest('hex');

      this.nodes[nodeAlias].gossipCaCertificate = certificate;
      this.nodes[nodeAlias].grpcCertificateHash = hash;
    }))
  }
}