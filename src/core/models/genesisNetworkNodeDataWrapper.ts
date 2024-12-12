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
import {parseIpAddressToUint8Array} from '../helpers.js';
import type {AccountId} from '@hashgraph/sdk';
import {type GenesisNetworkNodeStructure, type ServiceEndpoint, type ToObject} from '../../types/index.js';

export class GenesisNetworkNodeDataWrapper
  implements GenesisNetworkNodeStructure, ToObject<{node: GenesisNetworkNodeStructure}>
{
  public accountId: AccountId | string;
  public gossipEndpoint: ServiceEndpoint[] = [];
  public serviceEndpoint: ServiceEndpoint[] = [];
  public gossipCaCertificate: string;
  public grpcCertificateHash: string;
  public weight: number;
  public readonly deleted = false;

  constructor(
    public readonly nodeId: number,
    public readonly adminKey: string,
    public readonly description: string,
  ) {}

  /**
   * @param domainName - a fully qualified domain name
   * @param port
   */
  public addServiceEndpoint(domainName: string, port: number): void {
    this.serviceEndpoint.push({
      ipAddressV4: parseIpAddressToUint8Array(domainName),
      domainName,
      port,
    });
  }

  /**
   * @param domainName - a fully qualified domain name
   * @param port
   */
  public addGossipEndpoint(domainName: string, port: number): void {
    this.gossipEndpoint.push({
      ipAddressV4: parseIpAddressToUint8Array(domainName),
      domainName,
      port,
    });
  }

  public toObject() {
    return {
      node: {
        nodeId: this.nodeId,
        accountId: this.accountId,
        description: this.description,
        gossipEndpoint: this.gossipEndpoint,
        serviceEndpoint: this.serviceEndpoint,
        gossipCaCertificate: this.gossipCaCertificate,
        grpcCertificateHash: this.grpcCertificateHash,
        weight: this.weight,
        deleted: this.deleted,
        adminKey: this.adminKey,
      },
    };
  }
}
