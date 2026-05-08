// WebM → MP4 transcode using bundled ffmpeg.
// Single ffmpeg call: copy video stream re-encoded to H.264 (browser-safe),
// drop audio (Playwright recordings have none), normalize framerate to 30.

import { spawn } from 'node:child_process'
import { stat, unlink } from 'node:fs/promises'
import ffmpeg from '@ffmpeg-installer/ffmpeg'

interface TranscodeOpts {
  webmPath: string
  mp4Path: string
}

export async function transcodeWebmToMp4(opts: TranscodeOpts): Promise<void> {
  const args = [
    '-y',                          // overwrite without prompting
    '-i', opts.webmPath,
    '-c:v', 'libx264',             // H.264 video, broadly compatible
    '-preset', 'fast',
    '-crf', '23',                  // visually lossless-ish at this resolution
    '-pix_fmt', 'yuv420p',         // safari/quicktime require this
    '-an',                         // no audio track
    '-r', '30',                    // 30fps
    '-movflags', '+faststart',     // metadata at start so it streams while loading
    opts.mp4Path,
  ]

  await new Promise<void>((res, rej) => {
    const child = spawn(ffmpeg.path, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    child.stderr.on('data', (chunk) => (stderr += chunk.toString()))
    child.on('error', rej)
    child.on('exit', (code) => {
      if (code === 0) res()
      else rej(new Error(`ffmpeg exit ${code}\n${stderr.slice(-500)}`))
    })
  })

  // Sanity check: ensure output file is non-trivial size
  const s = await stat(opts.mp4Path)
  if (s.size < 50_000) {
    throw new Error(`Transcoded MP4 too small (${s.size} bytes) — likely encode failure`)
  }

  // Cleanup source webm so the cache doesn't balloon
  await unlink(opts.webmPath).catch(() => {})
}
