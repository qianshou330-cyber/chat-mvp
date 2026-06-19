import { supabase, supabaseAnonKey, supabaseProjectUrl } from './supabase'

interface UploadStorageObjectOptions {
  cacheControl?: string
  contentType?: string
  onProgress?: (progress: number) => void
  upsert?: boolean
}

export async function uploadStorageObject(
  bucket: string,
  path: string,
  body: Blob,
  options: UploadStorageObjectOptions = {},
) {
  if (!supabase || !supabaseProjectUrl || !supabaseAnonKey) {
    throw new Error('Supabase is not configured.')
  }
  const anonKey = supabaseAnonKey

  const session = await supabase.auth.getSession()
  const accessToken = session.data.session?.access_token
  if (!accessToken) {
    throw new Error('Missing Supabase session.')
  }

  const encodedPath = path.split('/').map(encodeURIComponent).join('/')
  const url = `${supabaseProjectUrl.replace(/\/$/, '')}/storage/v1/object/${encodeURIComponent(
    bucket,
  )}/${encodedPath}`

  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('POST', url)
    request.setRequestHeader('apikey', anonKey)
    request.setRequestHeader('Authorization', `Bearer ${accessToken}`)
    request.setRequestHeader('x-upsert', options.upsert ? 'true' : 'false')
    request.setRequestHeader('cache-control', options.cacheControl ?? '3600')
    request.setRequestHeader(
      'content-type',
      (options.contentType ?? body.type) || 'application/octet-stream',
    )

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable || !options.onProgress) return
      options.onProgress(Math.max(1, Math.min(99, Math.round((event.loaded / event.total) * 100))))
    }

    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        options.onProgress?.(100)
        resolve()
        return
      }

      reject(new Error(parseStorageError(request.responseText) || `Upload failed: ${request.status}`))
    }

    request.onerror = () => reject(new Error('Network upload failed.'))
    request.onabort = () => reject(new Error('Upload aborted.'))
    request.send(body)
  })
}

function parseStorageError(responseText: string) {
  try {
    const parsed = JSON.parse(responseText) as { error?: string; message?: string }
    return parsed.message ?? parsed.error ?? ''
  } catch {
    return responseText
  }
}
