'use client';

import { createElement, useEffect, useRef, useState } from 'react';
import Image from 'next/image';

const MODEL_CANDIDATES = [
  '/models/anatomical-heart.glb',
  '/models/real-human-heart.glb',
  '/models/human-heart.glb',
  '/models/heart.glb',
];

const VIDEO_CANDIDATES = [
  // Keep the verified heart asset first to avoid accidentally picking unrelated mp4 files.
  '/videos/anatomical-heart.mp4',
  '/videos/anatomical-heart-alpha.webm',
  '/videos/anatomical-heart-hq.mp4',
  '/videos/anatomical-heart-4k.mp4',
  '/videos/real-human-heart.mp4',
  '/videos/human-heart.mp4',
  '/videos/heart.mp4',
];

const IMAGE_CANDIDATES = [
  '/images/anatomical-heart.png',
  '/images/real-human-heart.png',
  '/images/human-heart.png',
  '/images/heart.png',
  '/images/anatomical-heart.jpg',
  '/images/real-human-heart.jpg',
  '/images/human-heart.jpg',
  '/images/heart.jpg',
];

type RenderMode = 'loading' | 'model' | 'video' | 'image' | 'missing';

export default function Heart3D() {
  const [mode, setMode] = useState<RenderMode>('loading');
  const [modelSrc, setModelSrc] = useState(MODEL_CANDIDATES[0]);
  const [videoSrc, setVideoSrc] = useState(VIDEO_CANDIDATES[0]);
  const [videoHasAlpha, setVideoHasAlpha] = useState(false);
  const [forceDirectVideo, setForceDirectVideo] = useState(true);
  const [imageSrc, setImageSrc] = useState(IMAGE_CANDIDATES[0]);
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('dark');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const useDirectVideo = videoHasAlpha || (forceDirectVideo && themeMode === 'dark');

  useEffect(() => {
    let mounted = true;

    const probe = async (url: string) => {
      try {
        const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
        return res.ok;
      } catch {
        return false;
      }
    };

    const findFirstAvailable = async (candidates: string[]) => {
      for (const candidate of candidates) {
        // Sequential check keeps dev logs cleaner and avoids too many parallel HEAD calls.
        // eslint-disable-next-line no-await-in-loop
        if (await probe(candidate)) return candidate;
      }
      return null;
    };

    const resolveAsset = async () => {
      const foundVideo = await findFirstAvailable(VIDEO_CANDIDATES);
      if (!mounted) return;
      if (foundVideo) {
        setVideoSrc(foundVideo);
        setVideoHasAlpha(foundVideo.endsWith('.webm') && foundVideo.includes('alpha'));
        setForceDirectVideo(true);
        setMode('video');
        return;
      }

      const foundModel = await findFirstAvailable(MODEL_CANDIDATES);
      if (!mounted) return;
      if (foundModel) {
        setModelSrc(foundModel);
        setMode('model');
        return;
      }

      const foundImage = await findFirstAvailable(IMAGE_CANDIDATES);
      if (!mounted) return;
      if (foundImage) {
        setImageSrc(foundImage);
        setMode('image');
        return;
      }

      setMode('missing');
    };

    resolveAsset();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const readTheme = () => {
      setThemeMode(root.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
    };

    readTheme();
    const observer = new MutationObserver(readTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (mode !== 'model' || document.getElementById('model-viewer-lib')) return;

    const script = document.createElement('script');
    script.id = 'model-viewer-lib';
    script.type = 'module';
    script.src = 'https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js';
    document.head.appendChild(script);

    return () => {
      // Keep the script once loaded for subsequent visits.
    };
  }, [mode]);

  useEffect(() => {
    if (mode !== 'video' || useDirectVideo) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const videoWithVfc = video as HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number;
      cancelVideoFrameCallback?: (id: number) => void;
    };

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    let rafId = 0;
    let vfcId = 0;
    let mounted = true;
    let lastFrameTime = 0;
    const frameIntervalMs = 1000 / 30;
    let smoothBg: { r: number; g: number; b: number } | null = null;
    let prevAlpha: Uint8Array | null = null;
    let blankFrames = 0;
    let anyFrameDrawn = false;
    let fallbackTriggered = false;
    const workCanvas = document.createElement('canvas');
    const workCtx = workCanvas.getContext('2d', { willReadFrequently: true });
    if (!workCtx) return;

    const setCanvasSize = () => {
      const size = 560;
      if (canvas.width !== size || canvas.height !== size) {
        canvas.width = size;
        canvas.height = size;
        prevAlpha = new Uint8Array(size * size);
      }
      if (workCanvas.width !== size || workCanvas.height !== size) {
        workCanvas.width = size;
        workCanvas.height = size;
      }
    };

    const smoothstep = (edge0: number, edge1: number, x: number) => {
      const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
      return t * t * (3 - 2 * t);
    };

    const scheduleNext = () => {
      if (videoWithVfc.requestVideoFrameCallback) {
        vfcId = videoWithVfc.requestVideoFrameCallback(() => draw(performance.now()));
      } else {
        rafId = requestAnimationFrame(draw);
      }
    };

    const cancelScheduled = () => {
      cancelAnimationFrame(rafId);
      if (vfcId && videoWithVfc.cancelVideoFrameCallback) {
        videoWithVfc.cancelVideoFrameCallback(vfcId);
      }
    };

    const draw = (time: number) => {
      if (!mounted) return;
      scheduleNext();

      if (time - lastFrameTime < frameIntervalMs) return;
      lastFrameTime = time;
      if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) return;

      setCanvasSize();

      const dw = canvas.width;
      const dh = canvas.height;
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const isLightTheme = themeMode === 'light';
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      workCtx.imageSmoothingEnabled = true;
      workCtx.imageSmoothingQuality = 'high';

      const square = Math.min(vw, vh);
      const sx = Math.max(0, Math.floor((vw - square) * 0.5));
      const sy = Math.max(0, Math.floor((vh - square) * 0.5));

      workCtx.clearRect(0, 0, dw, dh);
      workCtx.drawImage(video, sx, sy, square, square, 0, 0, dw, dh);

      const frame = workCtx.getImageData(0, 0, dw, dh);
      const pixels = frame.data;
      // Estimate current frame background from corners (helps avoid hard clipping details).
      let bgRNow = 0;
      let bgGNow = 0;
      let bgBNow = 0;
      let bgSamples = 0;
      const corner = 28;
      for (let y = 0; y < corner; y += 2) {
        for (let x = 0; x < corner; x += 2) {
          const idxA = (y * dw + x) * 4;
          const idxB = (y * dw + (dw - 1 - x)) * 4;
          const idxC = ((dh - 1 - y) * dw + x) * 4;
          const idxD = ((dh - 1 - y) * dw + (dw - 1 - x)) * 4;
          bgRNow += pixels[idxA] + pixels[idxB] + pixels[idxC] + pixels[idxD];
          bgGNow += pixels[idxA + 1] + pixels[idxB + 1] + pixels[idxC + 1] + pixels[idxD + 1];
          bgBNow += pixels[idxA + 2] + pixels[idxB + 2] + pixels[idxC + 2] + pixels[idxD + 2];
          bgSamples += 4;
        }
      }
      bgRNow /= bgSamples;
      bgGNow /= bgSamples;
      bgBNow /= bgSamples;
      if (!smoothBg) {
        smoothBg = { r: bgRNow, g: bgGNow, b: bgBNow };
      } else {
        const bgLerp = 0.12;
        smoothBg.r += (bgRNow - smoothBg.r) * bgLerp;
        smoothBg.g += (bgGNow - smoothBg.g) * bgLerp;
        smoothBg.b += (bgBNow - smoothBg.b) * bgLerp;
      }
      const bgR = smoothBg.r;
      const bgG = smoothBg.g;
      const bgB = smoothBg.b;
      const bgMax = Math.max(bgR, bgG, bgB);

      let visiblePixels = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const ai = i >> 2;
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const a = pixels[i + 3];

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const saturation = max - min;
        const lum = r * 0.2126 + g * 0.7152 + b * 0.0722;
        const redDominance = r - g * 0.62 - b * 0.62;
        const redVsMax = r - Math.max(g, b);

        // Hard-remove true black and near-background neutrals first.
        const isNearBlack = max < (isLightTheme ? 14 : 12);
        const isNearBgNeutral =
          max < bgMax + (isLightTheme ? 16 : 22) &&
          saturation < (isLightTheme ? 10 : 13) &&
          redDominance < (isLightTheme ? 8 : 10);

        if (isNearBlack || isNearBgNeutral) {
          pixels[i + 3] = 0;
          if (prevAlpha) prevAlpha[ai] = 0;
          continue;
        }

        const dR = Math.abs(r - bgR);
        const dG = Math.abs(g - bgG);
        const dB = Math.abs(b - bgB);
        const bgDistance = dR + dG + dB;

        // Adaptive signal: brightness + color distance + red prominence.
        const lumSignal = smoothstep(8, isLightTheme ? 140 : 126, max);
        const colorSignal = smoothstep(isLightTheme ? 10 : 8, isLightTheme ? 96 : 88, bgDistance * 0.72 + redDominance * 1.08 + redVsMax * 0.66);
        let alphaScale = Math.max(lumSignal * 0.52, colorSignal);

        // Keep bright highlights that belong to the heart glow.
        if (lum > 150 && r > g && r > b) {
          alphaScale = Math.max(alphaScale, 0.72);
        }

        // Suppress low-saturation matte haze (especially in light mode) without deleting vessels.
        if (isLightTheme) {
          const neutralScore = saturation < 20 ? (20 - saturation) / 20 : 0;
          const weakRedScore = redDominance < 16 ? (16 - redDominance) / 16 : 0;
          const mattePenalty = neutralScore * 0.58 + weakRedScore * 0.46;
          alphaScale *= Math.max(0, 1 - mattePenalty * 0.22);
        } else if (saturation < 15 && lum < 108 && redDominance < 16) {
          alphaScale *= 0.26;
        }

        // Preserve vessel detail and avoid over-clipping.
        if (saturation > (isLightTheme ? 16 : 15) && redDominance > 7) {
          alphaScale = Math.max(alphaScale, (isLightTheme ? 0.34 : 0.33) + Math.min(isLightTheme ? 0.32 : 0.3, redDominance / 118));
        }
        if (isLightTheme && redVsMax > 7 && saturation > 16) {
          alphaScale = Math.max(alphaScale, 0.38 + Math.min(0.2, redVsMax / 95));
        }
        if (isLightTheme && redDominance > 5 && saturation > 12) {
          alphaScale = Math.max(alphaScale, 0.33);
        }
        if (!isLightTheme && redDominance > 4 && saturation > 10) {
          alphaScale = Math.max(alphaScale, 0.3);
        }

        let nextAlpha = Math.floor(a * alphaScale);
        // Matte fringe cleanup: suppress neutral edge spill only.
        if (nextAlpha > 0) {
          const fringe = redDominance < (isLightTheme ? 12 : 10) && saturation < (isLightTheme ? 12 : 9);
          if (fringe) nextAlpha = Math.floor(nextAlpha * (isLightTheme ? 0.72 : 0.5));
        }
        // Smooth edge falloff to reduce jagged outlines.
        if (nextAlpha > 0 && nextAlpha < 90 && redDominance > 6) {
          nextAlpha = Math.min(255, Math.floor(nextAlpha * 1.12));
        }
        if (nextAlpha < (isLightTheme ? 2 : 10)) nextAlpha = 0;
        if (prevAlpha) {
          const prev = prevAlpha[ai];
          const delta = Math.abs(nextAlpha - prev);
          const adapt = delta > 64 ? 0.68 : delta > 28 ? 0.52 : 0.38;
          nextAlpha = Math.round(prev + (nextAlpha - prev) * adapt);
          prevAlpha[ai] = nextAlpha;
        }
        pixels[i + 3] = nextAlpha;
        if (nextAlpha > 14) visiblePixels += 1;

        // Subtle enhancement for heart texture only (avoid neon over-bloom).
        if (redDominance > 14 && pixels[i + 3] > 0) {
          pixels[i] = Math.min(255, Math.floor(r * 1.04 + 4));
          pixels[i + 1] = Math.max(0, Math.floor(g * 0.96));
          pixels[i + 2] = Math.max(0, Math.floor(b * 0.95));
        }
        if (pixels[i + 3] > 0 && pixels[i + 3] < 128) {
          // Despill semitransparent edges so interpolation does not reintroduce dark halos.
          pixels[i] = Math.min(255, Math.floor(pixels[i] * 1.02 + 1));
          pixels[i + 1] = Math.max(0, Math.floor(pixels[i + 1] * 0.97));
          pixels[i + 2] = Math.max(0, Math.floor(pixels[i + 2] * 0.95));
        }

      }
      workCtx.putImageData(frame, 0, 0);

      // If processing yields near-empty output repeatedly, switch to stable direct-video fallback.
      const visibleRatio = visiblePixels / (dw * dh);
      if (visibleRatio < 0.004) {
        blankFrames += 1;
      } else {
        blankFrames = 0;
      }
      if (blankFrames > 24 && !fallbackTriggered) {
        fallbackTriggered = true;
        setForceDirectVideo(true);
        return;
      }
      // Fixed framing prevents in/out zoom jitter from frame-to-frame crop changes.
      const targetSize = dw * (isLightTheme ? 0.94 : 0.95);
      const dx = (dw - targetSize) * 0.5;
      const dy = (dh - targetSize) * 0.522;

      ctx.clearRect(0, 0, dw, dh);
      ctx.filter = isLightTheme
        ? 'contrast(1.1) saturate(1.1) brightness(1.01)'
        : 'contrast(1.06) saturate(1.08)';
      ctx.drawImage(workCanvas, 0, 0, dw, dh, dx, dy, targetSize, targetSize);
      ctx.filter = 'none';

      const glow = ctx.createRadialGradient(dw * 0.5, dh * 0.52, dw * 0.08, dw * 0.5, dh * 0.52, dw * 0.36);
      glow.addColorStop(0, isLightTheme ? 'rgba(255,92,92,0.11)' : 'rgba(255,100,100,0.18)');
      glow.addColorStop(0.6, isLightTheme ? 'rgba(255,80,80,0.03)' : 'rgba(255,80,80,0.06)');
      glow.addColorStop(1, 'rgba(255,82,82,0)');
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, dw, dh);
      ctx.globalCompositeOperation = 'source-over';
      anyFrameDrawn = true;
    };

    const start = () => {
      video.play().catch(() => {
        // Ignore autoplay restrictions; muted+playsInline should pass on most browsers.
      });
      cancelScheduled();
      scheduleNext();
    };

    // Hard fallback if no drawable frame appears shortly after startup.
    const startupFallback = setTimeout(() => {
      if (!anyFrameDrawn && !fallbackTriggered && mounted) {
        fallbackTriggered = true;
        setForceDirectVideo(true);
      }
    }, 2200);

    video.addEventListener('loadeddata', start);
    video.addEventListener('playing', start);
    start();

    return () => {
      mounted = false;
      cancelScheduled();
      smoothBg = null;
      prevAlpha = null;
      clearTimeout(startupFallback);
      video.removeEventListener('loadeddata', start);
      video.removeEventListener('playing', start);
    };
  }, [mode, videoSrc, themeMode, useDirectVideo]);

  return (
    <div className={`heart-scene ${mode === 'video' ? 'is-video' : ''}`} aria-label="Anatomical heart visualization">
      <div className="heart-ambient" />
      <div className="heart-rings">
        <span className="ring ring-a" />
        <span className="ring ring-b" />
        <span className="ring ring-c" />
      </div>

      <div className={`heart-model-shell ${mode === 'video' ? 'heart-model-shell--video' : ''}`}>
        {mode === 'model' &&
          // Use real anatomical 3D model when provided in public/models/anatomical-heart.glb
          // eslint-disable-next-line react/no-unknown-property
          (createElement('model-viewer', {
            className: 'heart-model-viewer',
            src: modelSrc,
            alt: 'Realistic 3D human heart model',
            autoplay: true,
            'auto-rotate': true,
            'auto-rotate-delay': '0',
            'rotation-per-second': '8deg',
            exposure: '1.08',
            'shadow-intensity': '1',
            'interaction-prompt': 'none',
            'camera-controls': true,
            'disable-zoom': true,
            loading: 'eager',
            reveal: 'auto',
          }))}

        {mode === 'image' && (
          <div className="heart-photo-wrap">
            <span className="heart-photo-halo" aria-hidden="true" />
            <span className="heart-photo-orbit orbit-a" aria-hidden="true" />
            <span className="heart-photo-orbit orbit-b" aria-hidden="true" />
            <div className="heart-photo-rotor">
              <Image
                src={imageSrc}
                alt="Anatomical human heart"
                width={760}
                height={840}
                className="heart-photo"
                priority
                quality={100}
              />
            </div>
          </div>
        )}

        {mode === 'video' && (
          <div className="heart-video-wrap">
            <span className="heart-photo-halo" aria-hidden="true" />
            <span className="heart-photo-orbit orbit-a" aria-hidden="true" />
            <span className="heart-photo-orbit orbit-b" aria-hidden="true" />
            <div className="heart-photo-rotor heart-video-rotor">
              <div className="heart-video-motion">
                <video
                  ref={videoRef}
                  src={videoSrc}
                  className={`heart-video-source ${useDirectVideo ? 'heart-video-source--direct' : ''}`}
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="auto"
                  aria-label="Anatomical human heart motion video"
                />
                {!useDirectVideo && <canvas ref={canvasRef} className="heart-video-canvas" aria-hidden="true" />}
              </div>
            </div>
          </div>
        )}

        {mode === 'missing' && (
          <div className="heart-missing">
            <strong>Add a real heart asset</strong>
            <p>
              Place a licensed heart model in <code>public/models</code> (any of: anatomical-heart.glb,
              real-human-heart.glb, human-heart.glb, heart.glb), or a heart video in <code>public/videos</code>{' '}
              (anatomical-heart/human-heart names in mp4), or a licensed heart image in <code>public/images</code>{' '}
              (anatomical-heart/human-heart names in png/jpg).
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
