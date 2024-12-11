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
import type {Nullable} from '../../types/aliases.js';
import type {AccountId, Key} from '@hashgraph/sdk';
import type {ServiceEndpoint} from '../../types/index.js';

interface Node {
  nodeId: number;
  accountId: AccountId | string;
  description: string;
  gossipEndpoint: Nullable<ServiceEndpoint>;
  serviceEndpoint: Nullable<ServiceEndpoint>;
  gossipCaCertificate: string; // Bytes
  grpcCertificateHash: string; // Bytes
  weight: number;
  deleted: boolean;
  adminKey: Nullable<Key>;
}

export class GenesisNetworkNodeDataWrapper implements Node{
  public readonly nodeId: number;
  public accountId: AccountId | string;
  public readonly description: string;
  public gossipEndpoint: ServiceEndpoint;
  public serviceEndpoint: ServiceEndpoint;
  public gossipCaCertificate: string;
  public grpcCertificateHash: string;
  public readonly weight: number;
  public readonly deleted: boolean;
  public adminKey: Nullable<Key>;

  constructor (nodeId: number) {
    this.nodeId = nodeId;
    this.deleted = false;
  }

  addGossipEndpoint (ipAddressV4: string, port: number, domainName: string): void {
    this.gossipEndpoint = {ipAddressV4, port, domainName};
  }

  addServiceEndpoint (ipAddressV4: string, port: number, domainName: string): void {
    this.serviceEndpoint = {ipAddressV4, port, domainName};
  }
}