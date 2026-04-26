import "server-only"
import { S3Client } from "@aws-sdk/client-s3"
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { randomUUID } from "node:crypto"

/**
 * Cloudflare R2 is S3-compatible. We use the @aws-sdk/client-s3 client
 * pointed at the R2 endpoint (https://<accountid>.r2.cloudflarestorage.com).
 *
 * Required env vars:
 * - R2_ACCOUNT_ID:        Cloudflare account id (32 hex chars)
 * - R2_ACCESS_KEY_ID:     R2 API token access key
 * - R2_SECRET_ACCESS_KEY: R2 API token secret
 * - R2_BUCKET:            Bucket name (e.g. "pulpo-uploads")
 * - R2_PUBLIC_URL:        Public base URL (r2.dev subdomain or custom domain),
 *                         no trailing slash.
 */

function env(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env var: ${name}`)
  return v
}

export function r2IsConfigured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET &&
      process.env.R2_PUBLIC_URL,
  )
}

let _client: S3Client | null = null

function getClient(): S3Client {
  if (_client) return _client
  _client = new S3Client({
    region: "auto",
    endpoint: `https://${env("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env("R2_ACCESS_KEY_ID"),
      secretAccessKey: env("R2_SECRET_ACCESS_KEY"),
    },
  })
  return _client
}

/** Allowed image mime types we accept on the server. */
export const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
])

/** Max upload size in bytes (10 MB). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

function extFromMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg"
    case "image/png":
      return "png"
    case "image/webp":
      return "webp"
    case "image/avif":
      return "avif"
    case "image/gif":
      return "gif"
    default:
      return "bin"
  }
}

export interface SignedUpload {
  storageKey: string
  uploadUrl: string
  publicUrl: string
}

/**
 * Generate a presigned PUT URL for a tenant-scoped object.
 * The key includes the tenant id so we can clean up by prefix later.
 */
export async function signProductImageUpload(opts: {
  tenantId: string
  productId: string
  contentType: string
  contentLength: number
}): Promise<SignedUpload> {
  if (!ALLOWED_IMAGE_TYPES.has(opts.contentType)) {
    throw new Error("Tipo de archivo no soportado")
  }
  if (opts.contentLength > MAX_UPLOAD_BYTES) {
    throw new Error("El archivo supera el límite de 10 MB")
  }

  const client = getClient()
  const ext = extFromMime(opts.contentType)
  const id = randomUUID()
  const storageKey = `tenants/${opts.tenantId}/products/${opts.productId}/${id}.${ext}`

  const cmd = new PutObjectCommand({
    Bucket: env("R2_BUCKET"),
    Key: storageKey,
    ContentType: opts.contentType,
    ContentLength: opts.contentLength,
  })

  const uploadUrl = await getSignedUrl(client, cmd, {
    expiresIn: 60 * 5, // 5 min to upload
    signableHeaders: new Set(["content-type", "content-length"]),
  })

  const publicUrl = `${env("R2_PUBLIC_URL").replace(/\/$/, "")}/${storageKey}`

  return { storageKey, uploadUrl, publicUrl }
}

/**
 * Upload bytes server-side. Avoids browser CORS issues that arise when a client
 * tries to PUT directly to R2 from arbitrary origins.
 */
export async function uploadProductImageDirect(opts: {
  tenantId: string
  productId: string
  contentType: string
  body: Buffer | Uint8Array
}): Promise<{ storageKey: string; publicUrl: string }> {
  if (!ALLOWED_IMAGE_TYPES.has(opts.contentType)) {
    throw new Error("Tipo de archivo no soportado")
  }
  if (opts.body.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error("El archivo supera el límite de 10 MB")
  }

  const client = getClient()
  const ext = extFromMime(opts.contentType)
  const id = randomUUID()
  const storageKey = `tenants/${opts.tenantId}/products/${opts.productId}/${id}.${ext}`

  await client.send(
    new PutObjectCommand({
      Bucket: env("R2_BUCKET"),
      Key: storageKey,
      ContentType: opts.contentType,
      ContentLength: opts.body.byteLength,
      Body: opts.body,
    }),
  )

  const publicUrl = `${env("R2_PUBLIC_URL").replace(/\/$/, "")}/${storageKey}`
  return { storageKey, publicUrl }
}

/** Delete an object by its storage key. Used when removing an image. */
export async function deleteR2Object(storageKey: string): Promise<void> {
  if (!r2IsConfigured()) return
  const client = getClient()
  await client.send(
    new DeleteObjectCommand({
      Bucket: env("R2_BUCKET"),
      Key: storageKey,
    }),
  )
}
