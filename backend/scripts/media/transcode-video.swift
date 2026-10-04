// Web encode for the site's ambient background videos, using AVFoundation (macOS, no ffmpeg).
//
//   swift scripts/media/transcode-video.swift <source> <out.mp4> <poster.jpg> \
//         [--width 1280] [--bitrate 2500000] [--start 0] [--duration 12] [--poster-at 1.0]
//
// Writes an H.264 (High profile) MP4 without audio, scaled to --width (16:9 crop-free, aspect kept),
// trimmed to --start/--duration, with fast start for streaming, plus a JPEG poster frame at
// --poster-at seconds into the trimmed clip. build-media.mjs calls this for every video.

import AVFoundation
import CoreImage
import Foundation
import ImageIO
import UniformTypeIdentifiers

func fail(_ message: String) -> Never {
  FileHandle.standardError.write((message + "\n").data(using: .utf8)!)
  exit(1)
}

var args = Array(CommandLine.arguments.dropFirst())
guard args.count >= 3 else { fail("usage: transcode-video <source> <out.mp4> <poster.jpg> [options]") }
let sourceURL = URL(fileURLWithPath: args.removeFirst())
let outURL = URL(fileURLWithPath: args.removeFirst())
let posterURL = URL(fileURLWithPath: args.removeFirst())
var options: [String: Double] = ["width": 1280, "bitrate": 2_500_000, "start": 0, "duration": 12, "poster-at": 1]
while let flag = args.first, flag.hasPrefix("--") {
  args.removeFirst()
  guard let value = args.first.flatMap(Double.init) else { fail("missing value for \(flag)") }
  args.removeFirst()
  options[String(flag.dropFirst(2))] = value
}

let asset = AVURLAsset(url: sourceURL)
let semaphore = DispatchSemaphore(value: 0)
var loadedTrack: AVAssetTrack?
var assetDuration = CMTime.zero
Task {
  do {
    loadedTrack = try await asset.loadTracks(withMediaType: .video).first
    assetDuration = try await asset.load(.duration)
  } catch {
    fail("cannot read \(sourceURL.path): \(error)")
  }
  semaphore.signal()
}
semaphore.wait()
guard let track = loadedTrack else { fail("no video track in \(sourceURL.path)") }

// Size: keep the displayed aspect ratio (after rotation), even dimensions for H.264.
let natural = track.naturalSize.applying(track.preferredTransform)
let displayW = abs(natural.width), displayH = abs(natural.height)
let outW = min(options["width"]!, Double(displayW))
let outH = (outW * Double(displayH) / Double(displayW) / 2).rounded() * 2
let width = Int((outW / 2).rounded() * 2)

let start = CMTime(seconds: options["start"]!, preferredTimescale: 600)
let available = assetDuration.seconds - options["start"]!
let duration = CMTime(seconds: min(options["duration"]!, available), preferredTimescale: 600)

// Reader → writer, re-encoding frames at the target size and bitrate.
try? FileManager.default.removeItem(at: outURL)
guard let reader = try? AVAssetReader(asset: asset) else { fail("cannot open reader") }
reader.timeRange = CMTimeRange(start: start, duration: duration)
let readerOutput = AVAssetReaderTrackOutput(
  track: track,
  outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange]
)
readerOutput.alwaysCopiesSampleData = false
reader.add(readerOutput)

guard let writer = try? AVAssetWriter(outputURL: outURL, fileType: .mp4) else { fail("cannot open writer") }
writer.shouldOptimizeForNetworkUse = true
// Width/height here are in display orientation; frames are rotated by the transform below.
let rotated = abs(track.preferredTransform.b) == 1
let encodeW = rotated ? Int(outH) : width
let encodeH = rotated ? width : Int(outH)
let writerInput = AVAssetWriterInput(mediaType: .video, outputSettings: [
  AVVideoCodecKey: AVVideoCodecType.h264,
  AVVideoWidthKey: encodeW,
  AVVideoHeightKey: encodeH,
  AVVideoScalingModeKey: AVVideoScalingModeResizeAspectFill,
  AVVideoCompressionPropertiesKey: [
    AVVideoAverageBitRateKey: Int(options["bitrate"]!),
    AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
    AVVideoMaxKeyFrameIntervalDurationKey: 2,
    AVVideoAllowFrameReorderingKey: true,
  ],
])
writerInput.transform = track.preferredTransform
writerInput.expectsMediaDataInRealTime = false
writer.add(writerInput)

guard reader.startReading() else { fail("reader failed: \(String(describing: reader.error))") }
guard writer.startWriting() else { fail("writer failed: \(String(describing: writer.error))") }
writer.startSession(atSourceTime: start)

let queue = DispatchQueue(label: "transcode")
let done = DispatchSemaphore(value: 0)
writerInput.requestMediaDataWhenReady(on: queue) {
  while writerInput.isReadyForMoreMediaData {
    if let sample = readerOutput.copyNextSampleBuffer() {
      writerInput.append(sample)
    } else {
      writerInput.markAsFinished()
      writer.finishWriting { done.signal() }
      return
    }
  }
}
done.wait()
guard writer.status == .completed else { fail("encode failed: \(String(describing: writer.error))") }

// Poster frame from the trimmed clip, at the output size.
let generator = AVAssetImageGenerator(asset: asset)
generator.appliesPreferredTrackTransform = true
generator.maximumSize = CGSize(width: width, height: Int(outH))
generator.requestedTimeToleranceBefore = .zero
generator.requestedTimeToleranceAfter = CMTime(seconds: 0.5, preferredTimescale: 600)
let posterTime = CMTimeAdd(start, CMTime(seconds: min(options["poster-at"]!, duration.seconds - 0.1), preferredTimescale: 600))
let posterDone = DispatchSemaphore(value: 0)
generator.generateCGImageAsynchronously(for: posterTime) { image, _, error in
  guard let image else { fail("poster failed: \(String(describing: error))") }
  guard let dest = CGImageDestinationCreateWithURL(posterURL as CFURL, UTType.jpeg.identifier as CFString, 1, nil) else {
    fail("cannot write poster")
  }
  CGImageDestinationAddImage(dest, image, [kCGImageDestinationLossyCompressionQuality: 0.9] as CFDictionary)
  CGImageDestinationFinalize(dest)
  posterDone.signal()
}
posterDone.wait()

let size = (try? FileManager.default.attributesOfItem(atPath: outURL.path)[.size] as? Int) ?? 0
print("{\"width\":\(width),\"height\":\(Int(outH)),\"duration\":\(String(format: "%.2f", duration.seconds)),\"bytes\":\(size)}")
