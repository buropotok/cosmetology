openapi: 3.0.0
info:
  title: Cosmo Sofa VK
  version: 1.1.0

x-yc-apigateway:
  variables:
    latest:
      default: "$latest"

paths:
  /:
    get:
      summary: Serve VK Mini App
      x-yc-apigateway-integration:
        type: object_storage
        bucket: cosmetology-publisher-images
        object: miniapp/index.html
        presigned_redirect: false
        service_account_id: __RUNTIME_SA_ID__

  /miniapp:
    get:
      summary: Serve VK Mini App at explicit miniapp path
      x-yc-apigateway-integration:
        type: object_storage
        bucket: cosmetology-publisher-images
        object: miniapp/index.html
        presigned_redirect: false
        service_account_id: __RUNTIME_SA_ID__

  /miniapp/:
    get:
      summary: Serve VK Mini App at explicit miniapp slash path
      x-yc-apigateway-integration:
        type: object_storage
        bucket: cosmetology-publisher-images
        object: miniapp/index.html
        presigned_redirect: false
        service_account_id: __RUNTIME_SA_ID__

  /api/replica/artifacts/init:
    post:
      summary: Initialize Cloudflare to Yandex artifact replication
      x-yc-apigateway-integration:
        type: cloud_functions
        function_id: __FUNCTION_ID__
        tag: ${var.latest}
        service_account_id: __RUNTIME_SA_ID__
        payload_format_version: "0.1"

  /api/replica/artifacts/{artifactId}/complete:
    post:
      summary: Complete Cloudflare to Yandex artifact replication
      parameters:
        - name: artifactId
          in: path
          required: true
          schema:
            type: string
      x-yc-apigateway-integration:
        type: cloud_functions
        function_id: __FUNCTION_ID__
        tag: ${var.latest}
        service_account_id: __RUNTIME_SA_ID__
        payload_format_version: "0.1"

  /api/artifacts/{handoffToken}:
    get:
      summary: Resolve a ready VK artifact by handoff token
      parameters:
        - name: handoffToken
          in: path
          required: true
          schema:
            type: string
      x-yc-apigateway-integration:
        type: cloud_functions
        function_id: __FUNCTION_ID__
        tag: ${var.latest}
        service_account_id: __RUNTIME_SA_ID__
        payload_format_version: "0.1"

  /api/artifacts/{handoffToken}/images/{index}:
    get:
      summary: Read a replicated artifact image
      parameters:
        - name: handoffToken
          in: path
          required: true
          schema:
            type: string
        - name: index
          in: path
          required: true
          schema:
            type: integer
      x-yc-apigateway-integration:
        type: cloud_functions
        function_id: __FUNCTION_ID__
        tag: ${var.latest}
        service_account_id: __RUNTIME_SA_ID__
        payload_format_version: "0.1"

  /api/test-artifact:
    get:
      summary: Get test artifact
      x-yc-apigateway-integration:
        type: cloud_functions
        function_id: __FUNCTION_ID__
        tag: ${var.latest}
        service_account_id: __RUNTIME_SA_ID__
        payload_format_version: "0.1"

  /api/test-artifact/image:
    get:
      summary: Get test artifact image
      x-yc-apigateway-integration:
        type: cloud_functions
        function_id: __FUNCTION_ID__
        tag: ${var.latest}
        service_account_id: __RUNTIME_SA_ID__
        payload_format_version: "0.1"

  /miniapp/{file+}:
    get:
      summary: Serve VK Mini App static asset under miniapp path
      parameters:
        - name: file
          in: path
          required: true
          schema:
            type: string
      x-yc-apigateway-integration:
        type: object_storage
        bucket: cosmetology-publisher-images
        object: miniapp/{file}
        presigned_redirect: false
        service_account_id: __RUNTIME_SA_ID__

  /{file+}:
    get:
      summary: Serve VK Mini App static asset from root
      parameters:
        - name: file
          in: path
          required: true
          schema:
            type: string
      x-yc-apigateway-integration:
        type: object_storage
        bucket: cosmetology-publisher-images
        object: miniapp/{file}
        presigned_redirect: false
        service_account_id: __RUNTIME_SA_ID__
