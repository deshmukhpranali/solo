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
import crypto from 'node:crypto';
import {PrivateKey} from '@hashgraph/sdk';
import {Templates} from '../templates.js';
import {GenesisNetworkNodeDataWrapper} from './genesisNetworkNodeDataWrapper.js';
import * as x509 from '@peculiar/x509';
import * as constants from '../constants.js';

import type {KeyManager} from '../key_manager.js';
import type {ToJSON} from '../../types/index.js';
import type {NodeAlias, NodeAliases} from '../../types/aliases.js';

/**
 * Used to construct the nodes data and convert them to JSON
 */
export class GenesisNetworkDataConstructor implements ToJSON {
  public readonly nodes: Record<NodeAlias, GenesisNetworkNodeDataWrapper>;

  public constructor(
    private readonly nodeAliases: NodeAliases,
    private readonly keyManager: KeyManager,
    private readonly keysDir: string,
  ) {
    this.nodeAliases.forEach(nodeAlias => {
      const nodeId = Templates.nodeIdFromNodeAlias(nodeAlias);

      const adminKey = PrivateKey.fromStringED25519(constants.GENESIS_KEY);

      this.nodes[nodeAlias] = new GenesisNetworkNodeDataWrapper(nodeId, adminKey.publicKey.toStringRaw(), nodeAlias);
    });
  }

  /**
   * Loads the gossipCaCertificate and grpcCertificateHash
   */
  public async load() {
    await Promise.all(
      this.nodeAliases.map(async nodeAlias => {
        const nodeKeys = await this.keyManager.loadSigningKey(nodeAlias, this.keysDir);

        const certPem = nodeKeys.certificate.toString();

        this.nodes[nodeAlias].gossipCaCertificate = certPem;

        const tlsCertDer = new Uint8Array(x509.PemConverter.decode(certPem)[0]);

        const grpcCertificateHash = crypto.createHash('sha384').update(tlsCertDer).digest();

        this.nodes[nodeAlias].grpcCertificateHash = grpcCertificateHash.toString();
      }),
    );
  }

  public toJSON() {
    return JSON.stringify({
      nodeMetadata: Object.values(this.nodes).map(node => node.toObject()),
    });
  }
}
