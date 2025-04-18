## Using Solo with mirror node

User can deploy a solo network with mirror node by running the following command:

```bash
export SOLO_CLUSTER_NAME=solo-cluster
export SOLO_NAMESPACE=solo-e2e
export SOLO_CLUSTER_SETUP_NAMESPACE=solo-cluster-setup
export SOLO_DEVELOPMENT=solo-deployment

kind delete cluster -n "${SOLO_CLUSTER_NAME}"
kind create cluster -n "${SOLO_CLUSTER_NAME}"
solo init
solo cluster-ref setup --cluster-setup-namespace "${SOLO_CLUSTER_SETUP_NAMESPACE}"
solo cluster-ref connect --cluster-ref kind-${SOLO_CLUSTER_NAME} --context kind-${SOLO_CLUSTER_NAME} --email john@doe.com
solo deployment create --namespace "${SOLO_NAMESPACE}" --deployment "${SOLO_DEVELOPMENT}"
solo deployment add-cluster --deployment "${SOLO_DEVELOPMENT}" --cluster-ref kind-${SOLO_CLUSTER_NAME} --num-consensus-nodes 2
solo node keys --gossip-keys --tls-keys -i node1,node2
solo network deploy --deployment "${SOLO_DEVELOPMENT}" -i node1,node2
solo node setup     --deployment "${SOLO_DEVELOPMENT}" -i node1,node2
solo node start     --deployment "${SOLO_DEVELOPMENT}" -i node1,node2
solo mirror-node deploy --deployment "${SOLO_DEVELOPMENT}"  

kubectl port-forward svc/haproxy-node1-svc -n "${SOLO_NAMESPACE}" 50211:50211 > /dev/null 2>&1 &
```

Then you can access the hedera explorer at `http://localhost:8080`

Or you can use Task tool to deploy solo network with mirror node with a single command [link](../Developer/Development/TaskTool.md)

Next, you can try to create a few accounts with solo and see the transactions in the explorer.

```bash
solo account create -n solo-e2e --hbar-amount 100
solo account create -n solo-e2e --hbar-amount 100
```

Or you can use Hedera JavaScript SDK examples to create topic, submit message and subscribe to the topic.

<!---
Add SDK.md link here
-->

* [Instructions for using Solo with Hedera JavaScript SDK](SDK.md)
