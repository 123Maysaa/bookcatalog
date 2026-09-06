# Katalog Buku Nusantara — OpenShift demo

Aplikasi Node.js dan PostgreSQL untuk demonstrasi OpenShift. Image aplikasi dibuat manual di laptop memakai Docker, lalu disimpan di Docker Hub. OCP hanya menarik dan menjalankan image tersebut.

## Arsitektur

```text
GitHub (source code) → Laptop (docker build) → Docker Hub → OCP
                                                       ├── Deployment aplikasi
                                                       └── StatefulSet PostgreSQL + PVC
```

## Struktur manifest

```text
openshift/
├── common/                 # ConfigMap, Secret, Route
├── database/               # PostgreSQL Service + StatefulSet + PVC
├── deployment/             # Service + Deployment aplikasi
└── deploymentconfig/       # Service + DeploymentConfig aplikasi
```

Pilih salah satu folder workload: `deployment/` atau `deploymentconfig/`. Jangan deploy keduanya bersama-sama.

## 1. Push source ke GitHub

```powershell
git init
git add .
git commit -m "Initial book catalog OpenShift app"
git branch -M main
git remote add origin https://github.com/<GITHUB_USERNAME>/<REPO_NAME>.git
git push -u origin main
```

## 2. Build dan push image di laptop

Pastikan Docker Desktop aktif dan login ke Docker Hub. Ganti `<DOCKERHUB_USERNAME>` dengan username Anda.

```powershell
docker login
docker build -t docker.io/<DOCKERHUB_USERNAME>/book-catalog:1.0.0 .
docker push docker.io/<DOCKERHUB_USERNAME>/book-catalog:1.0.0
```

Untuk latihan, buat repository image Docker Hub menjadi **public**. Dengan begitu OCP dapat menarik image tanpa `imagePullSecret`.

## 3. Siapkan manifest

Ganti nilai contoh pada `openshift/common/secret.yaml`. Jangan commit nilai production ke GitHub.

Kemudian ganti baris `image:` dalam kedua file berikut dengan image Docker Hub Anda:

- `openshift/deployment/deployment.yaml`
- `openshift/deploymentconfig/deploymentconfig.yaml`

Contoh:

```yaml
image: docker.io/<DOCKERHUB_USERNAME>/book-catalog:1.0.0
```

## 4. Deploy menggunakan Deployment

Login ke OCP, kemudian deploy PostgreSQL lebih dulu agar aplikasi dapat membuat tabel dan data awal.

```powershell
oc login <URL_API_CLUSTER> --token=<TOKEN_ANDA>
oc new-project book-catalog-demo
oc project book-catalog-demo

oc apply -f openshift/common/configmap.yaml
oc apply -f openshift/common/secret.yaml
oc apply -f openshift/database/service.yaml
oc apply -f openshift/database/statefulset.yaml
oc rollout status statefulset/book-catalog-db --timeout=180s

oc apply -f openshift/deployment/service.yaml
oc apply -f openshift/common/route.yaml
oc apply -f openshift/deployment/deployment.yaml
oc rollout status deployment/book-catalog --timeout=180s
```

## 5. Test aplikasi

```powershell
oc get pods
oc get pvc
$route = oc get route book-catalog -o jsonpath='{.spec.host}'
Invoke-WebRequest "https://$route/healthz" | Select-Object -ExpandProperty Content
Invoke-WebRequest "https://$route/api/info" | Select-Object -ExpandProperty Content
```

Target health check adalah `{"status":"ok"}`. Pada `/api/info`, pastikan `databaseReady` bernilai `true` dan PVC database berstatus `Bound`.

## DeploymentConfig (opsional)

Jika ingin mendemonstrasikan `DeploymentConfig`, hapus Deployment terlebih dahulu lalu gunakan Service dan manifest DC:

```powershell
oc delete deployment book-catalog
oc apply -f openshift/deploymentconfig/service.yaml
oc apply -f openshift/deploymentconfig/deploymentconfig.yaml
oc rollout status dc/book-catalog-dc --timeout=180s
```

## Update aplikasi

Naikkan tag image setiap ada perubahan, lalu update workload aktif:

```powershell
docker build -t docker.io/<DOCKERHUB_USERNAME>/book-catalog:1.0.1 .
docker push docker.io/<DOCKERHUB_USERNAME>/book-catalog:1.0.1
oc set image deployment/book-catalog book-catalog=docker.io/<DOCKERHUB_USERNAME>/book-catalog:1.0.1
oc rollout status deployment/book-catalog --timeout=180s
```

Jika sedang memakai DeploymentConfig, gunakan `oc set image dc/book-catalog-dc ...` sebagai gantinya.
