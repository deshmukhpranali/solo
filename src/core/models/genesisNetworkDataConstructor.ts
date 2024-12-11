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
import * as constants from '../constants.js';
import * as x509 from '@peculiar/x509';

export class GenesisNetworkDataConstructor {
  public readonly nodes: Record<NodeAlias, GenesisNetworkNodeDataWrapper>;

  public constructor (public readonly nodeAliases: NodeAliases) {
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
  public async load (keyManager: KeyManager, keysDir: string) {
    await Promise.all(this.nodeAliases.map(async nodeAlias => {
      const nodeKeys = await keyManager.loadSigningKey(nodeAlias, keysDir);


      const certPem = nodeKeys.certificate.toString()

      this.nodes[nodeAlias].gossipCaCertificate = certPem

      const tlsCertDer = new Uint8Array(x509.PemConverter.decode(certPem)[0]);

      const grpcCertificateHash = crypto.createHash('sha384').update(tlsCertDer).digest();

      this.nodes[nodeAlias].grpcCertificateHash = grpcCertificateHash.toString();
    }))
  }

  public toJSON (): string {
    return JSON.stringify(this.nodes);
  }
}