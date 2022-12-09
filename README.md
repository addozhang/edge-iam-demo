
![2022-12-09 at 09 02 37](https://user-images.githubusercontent.com/2224492/206599325-265395da-30f2-4d09-a9b9-1585d3ec8422.png)


### Setup environment and Deploy sample apps

Setup k3s cluster

```shell
export INSTALL_K3S_VERSION=v1.23.8+k3s2
curl -sfL https://get.k3s.io | sh -s - --disable traefik --write-kubeconfig-mode 644 --write-kubeconfig ~/.kube/config
```

Install osm-edge CLI

```shell
system=$(uname -s | tr [:upper:] [:lower:])
arch=$(dpkg --print-architecture)
release=v1.2.1
curl -L https://github.com/flomesh-io/osm-edge/releases/download/${release}/osm-edge-${release}-${system}-${arch}.tar.gz | tar -vxzf -
./${system}-${arch}/osm version
cp ./${system}-${arch}/osm /usr/local/bin/
```

Install osm-edge

```shell
export osm_namespace=osm-system 
export osm_mesh_name=osm 

osm install \
--mesh-name osm \
--osm-namespace osm-system \
--set=osm.image.pullPolicy=Always \
--set=osm.sidecarLogLevel=error \
--set=osm.controllerLogLevel=warn \
--set=osm.enableEgress=false \
--set=osm.enablePermissiveTrafficPolicy=true
```

Deploy sample apps

```shell
kubectl create namespace httpbin
kubectl create namespace curl
osm namespace add httpbin curl
kubectl apply -n httpbin -f https://raw.githubusercontent.com/flomesh-io/osm-edge-docs/main/manifests/samples/httpbin/httpbin.yaml
kubectl apply -n curl -f https://raw.githubusercontent.com/flomesh-io/osm-edge-docs/main/manifests/samples/curl/curl.yaml
```

Deploy an external auth service for sample

```shell
kubectl create namespace auth

kubectl apply -n auth -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  labels:
    app: ext-auth
  name: ext-auth
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ext-auth
  strategy: {}
  template:
    metadata:
      creationTimestamp: null
      labels:
        app: ext-auth
    spec:
      containers:
      - command:
        - pipy
        - -e
        - |2-

          pipy({
            _acceptTokens: ['2f1acc6c3a606b082e5eef5e54414ffb'],
            _allow: false,
          })

            // Pipeline layouts go here, e.g.:
            .listen(8079)
            .demuxHTTP().to($ => $
              .handleMessageStart(
                msg => ((token = msg?.head?.headers?.['x-iam-token']) =>
                  _allow = token && _acceptTokens?.find(el => el == token)
                )()
              )
              .branch(() => _allow, $ => $.replaceMessage(new Message({ status: 200 })),
                $ => $.replaceMessage(new Message({ status: 401 }))
              )
            )
        image: flomesh/pipy:latest
        name: pipy
        resources: {}
---
apiVersion: v1
kind: Service
metadata:
  labels:
    app: ext-auth
  name: ext-auth
spec:
  ports:
  - port: 8079
    protocol: TCP
    targetPort: 8079
  selector:
    app: ext-auth
EOF
```

Now, you will get `200 OK` status if attempt access `httpbin` from `curl`.

```shell
kubectl exec "$(kubectl get pod -n curl -l app=curl -o jsonpath='{.items[0].metadata.name}')" -n curl -c curl -- curl -sI http://httpbin.httpbin:14001/get

kubectl exec "$(kubectl get pod -n curl -l app=curl -o jsonpath='{.items[0].metadata.name}')" -n curl -c curl -- curl -sI http://httpbin.httpbin:14001/headers
```

### Enable IAM feature

Simulate enable feature by issue and enable relative plugins via repo REST API. So at first, we need to expose the repo with `port-forward`.

```shell
kubectl port-forward -n osm-system svc/osm-controller 6060:6060
```

Then, execute command below.

```shell
./init-base.sh
```

Configure external authentication of `httpbin`, you can get the config example in [`config-token-verifier.json`](./httpbin/config-token-verifier.json).

```shell
./init-sub.sh httpbin
```

Trigger `/get` request from `curl`, it will return `401 Unauthorized`, because the client `curl` lacks of necessary credentials.

```shell
kubectl exec "$(kubectl get pod -n curl -l app=curl -o jsonpath='{.items..metadata.name}')" -n curl -c curl -- curl -sI http://httpbin.httpbin:14001/get
HTTP/1.1 401 Unauthorized
content-length: 13
server: pipy
x-pipy-upstream-service-time: 10
connection: keep-alive
```

The request to `/headers` returns `200`, because `http` restricts the access of `/get` ONLY.

```shell
kubectl exec "$(kubectl get pod -n curl -l app=curl -o jsonpath='{.items..metadata.name}')" -n curl -c curl -- curl -sI http://httpbin.httpbin:14001/headers
```

```
HTTP/1.1 200 OK
server: pipy
date: Tue, 22 Nov 2022 04:35:55 GMT
content-type: application/json
content-length: 217
access-control-allow-origin: *
access-control-allow-credentials: true
x-pipy-upstream-service-time: 6
connection: keep-alive
```

Let's issue the credentials to client `curl`.

```shell
./init-sub.sh curl
```

The request to `/get` succeeds now.

```shell
kubectl exec "$(kubectl get pod -n curl -l app=curl -o jsonpath='{.items..metadata.name}')" -n curl -c curl -- curl -sI http://httpbin.httpbin:14001/get
```

```
HTTP/1.1 200 OK
server: pipy
date: Tue, 22 Nov 2022 04:36:50 GMT
content-type: application/json
content-length: 360
access-control-allow-origin: *
access-control-allow-credentials: true
x-pipy-upstream-service-time: 13
connection: keep-alive
```
