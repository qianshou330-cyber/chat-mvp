import {
  MAX_AVATAR_VIDEO_DURATION_SECONDS,
  MAX_AVATAR_VIDEO_SIZE_BYTES,
} from './attachments'

export interface ProcessedAvatarVideo {
  duration: number
  posterBlob: Blob
  videoBlob: Blob
  videoFileName: string
}

const AVATAR_VIDEO_OUTPUT_SIZE = 512
const AVATAR_VIDEO_BITRATES = [1_800_000, 1_100_000, 700_000, 420_000]

export async function processAvatarVideo(file: File): Promise<ProcessedAvatarVideo> {
  const loaded = await loadVideo(file)
  const posterBlob = await capturePoster(loaded.video)

  if (
    file.size <= MAX_AVATAR_VIDEO_SIZE_BYTES &&
    loaded.duration <= MAX_AVATAR_VIDEO_DURATION_SECONDS
  ) {
    loaded.cleanup()
    return {
      duration: loaded.duration,
      posterBlob,
      videoBlob: file,
      videoFileName: file.name,
    }
  }

  if (!('MediaRecorder' in window)) {
    loaded.cleanup()
    throw new Error('unsupported-video-compression')
  }

  try {
    for (const bitrate of AVATAR_VIDEO_BITRATES) {
      const videoBlob = await renderSquareVideo(loaded.video, bitrate)
      if (videoBlob.size <= MAX_AVATAR_VIDEO_SIZE_BYTES) {
        return {
          duration: Math.min(loaded.duration, MAX_AVATAR_VIDEO_DURATION_SECONDS),
          posterBlob,
          videoBlob,
          videoFileName: replaceExtension(file.name, 'webm'),
        }
      }
    }
  } finally {
    loaded.cleanup()
  }

  throw new Error('video-too-large-after-compression')
}

function loadVideo(file: File) {
  return new Promise<{
    cleanup: () => void
    duration: number
    video: HTMLVideoElement
  }>((resolve, reject) => {
    const videoUrl = URL.createObjectURL(file)
    const video = document.createElement('video')
    let didFinish = false

    function cleanup() {
      URL.revokeObjectURL(videoUrl)
      video.pause()
      video.removeAttribute('src')
      video.load()
    }

    function fail(error = new Error('invalid-video')) {
      if (didFinish) return
      didFinish = true
      cleanup()
      reject(error)
    }

    const timeout = window.setTimeout(() => fail(new Error('video-load-timeout')), 8000)

    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    video.src = videoUrl

    video.onloadedmetadata = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) {
        fail()
        return
      }

      window.clearTimeout(timeout)
      didFinish = true
      resolve({ cleanup, duration: video.duration, video })
    }

    video.onerror = () => fail()
  })
}

function capturePoster(video: HTMLVideoElement) {
  return new Promise<Blob>((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) {
      reject(new Error('canvas-unavailable'))
      return
    }
    const drawingContext = context

    function capture() {
      const sourceSize = Math.min(video.videoWidth, video.videoHeight)
      if (sourceSize <= 0) {
        reject(new Error('invalid-video-size'))
        return
      }

      const sourceX = Math.max(0, (video.videoWidth - sourceSize) / 2)
      const sourceY = Math.max(0, (video.videoHeight - sourceSize) / 2)
      canvas.width = AVATAR_VIDEO_OUTPUT_SIZE
      canvas.height = AVATAR_VIDEO_OUTPUT_SIZE
      drawingContext.drawImage(
        video,
        sourceX,
        sourceY,
        sourceSize,
        sourceSize,
        0,
        0,
        AVATAR_VIDEO_OUTPUT_SIZE,
        AVATAR_VIDEO_OUTPUT_SIZE,
      )
      canvas.toBlob(
        (posterBlob) => {
          if (posterBlob) resolve(posterBlob)
          else reject(new Error('poster-failed'))
        },
        'image/jpeg',
        0.82,
      )
    }

    video.currentTime = Math.min(0.1, Math.max(0, video.duration / 2))
    video.onseeked = capture
  })
}

function renderSquareVideo(video: HTMLVideoElement, bitrate: number) {
  return new Promise<Blob>((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    const sourceSize = Math.min(video.videoWidth, video.videoHeight)
    if (!context || sourceSize <= 0 || !canvas.captureStream) {
      reject(new Error('video-compression-unavailable'))
      return
    }
    const drawingContext = context

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm'
    const sourceX = Math.max(0, (video.videoWidth - sourceSize) / 2)
    const sourceY = Math.max(0, (video.videoHeight - sourceSize) / 2)
    const chunks: BlobPart[] = []

    canvas.width = AVATAR_VIDEO_OUTPUT_SIZE
    canvas.height = AVATAR_VIDEO_OUTPUT_SIZE
    const stream = canvas.captureStream(24)
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: bitrate,
    })
    const durationMs = Math.min(video.duration, MAX_AVATAR_VIDEO_DURATION_SECONDS) * 1000
    let animationFrame = 0
    let stopped = false

    function stop() {
      if (stopped) return
      stopped = true
      window.cancelAnimationFrame(animationFrame)
      stream.getTracks().forEach((track) => track.stop())
      video.pause()
      if (recorder.state !== 'inactive') recorder.stop()
    }

    function drawFrame() {
      drawingContext.drawImage(
        video,
        sourceX,
        sourceY,
        sourceSize,
        sourceSize,
        0,
        0,
        AVATAR_VIDEO_OUTPUT_SIZE,
        AVATAR_VIDEO_OUTPUT_SIZE,
      )
      animationFrame = window.requestAnimationFrame(drawFrame)
    }

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }))
    recorder.onerror = () => reject(new Error('video-compression-failed'))

    video.currentTime = 0
    video.onseeked = () => {
      recorder.start(250)
      drawFrame()
      void video.play().catch(() => {
        stop()
        reject(new Error('video-play-failed'))
      })
      window.setTimeout(stop, durationMs)
    }
  })
}

function replaceExtension(fileName: string, nextExtension: string) {
  const baseName = fileName.replace(/\.[^.]+$/, '') || 'avatar-video'
  return `${baseName}.${nextExtension}`
}
