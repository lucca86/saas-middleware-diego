import { NextResponse, type NextRequest } from "next/server"
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3"

/**
 * Streams an object from R2 through our own origin, eliminating any CORS
 * concern for image consumers (browsers, snapshot tools, crawlers).
 *
 * Security note: the storage key already encodes the tenant id and product
 * id, and product images are publicly displayable assets by design. The
 * upload endpoint is what enforces tenancy/role; reads are intentionally
 * open just like any product image on a marketplace.
 */
export const runtime = "nodejs"

function env(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env var: ${name}`)
  return v
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

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ key: string[] }> },
) {
  const { key } = await ctx.params
  if (!key || key.length === 0) {
    return new NextResponse("Not found", { status: 404 })
  }

  // Storage keys live under tenants/<tenantId>/products/<productId>/<file>.
  // Reject anything that doesn't follow this prefix to avoid serving objects
  // we never intended to expose if the bucket is reused for other purposes.
  const storageKey = key.map((p) => decodeURIComponent(p)).join("/")
  if (!storageKey.startsWith("tenants/")) {
    return new NextResponse("Forbidden", { status: 403 })
  }

  try {
    const res = await getClient().send(
      new GetObjectCommand({
        Bucket: env("R2_BUCKET"),
        Key: storageKey,
      }),
    )

    const body = res.Body
    if (!body) return new NextResponse("Not found", { status: 404 })

    const headers = new Headers()
    headers.set("Content-Type", res.ContentType ?? "application/octet-stream")
    if (res.ContentLength != null) {
      headers.set("Content-Length", String(res.ContentLength))
    }
    if (res.ETag) headers.set("ETag", res.ETag)
    // Long-lived cache: storage keys are immutable (random uuid per upload).
    headers.set("Cache-Control", "public, max-age=31536000, immutable")
    // Permissive CORS so external snapshot/preview tools can fetch the bytes.
    headers.set("Access-Control-Allow-Origin", "*")

    // The S3 client returns a Node Readable; cast to a Web ReadableStream
    // for the Fetch Response. Next.js 16 on Node runtime handles both.
    return new NextResponse(body as unknown as ReadableStream, { headers })
  } catch (err) {
    const code = (err as { name?: string; Code?: string })?.name ?? ""
    if (code === "NoSuchKey" || code === "NotFound") {
      return new NextResponse("Not found", { status: 404 })
    }
    console.error("[sc] image proxy error", err)
    return new NextResponse("Internal error", { status: 500 })
  }
}
