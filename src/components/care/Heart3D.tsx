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
  '/videos/anatomical-heart.mp4',
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
  const [imageSrc, setImageSrc] = useState(IMAGE_CANDIDATES[0]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let mounted = true;

    if (!document.getElementById('model-viewer-lib')) {
      const script = document.createElement('script');
      script.id = 'model-viewer-lib';
      script.type = 'module';
      script.src = 'https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js';
      document.head.appendChild(script);
    }

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
      const foundModel = await findFirstAvailable(MODEL_CANDIDATES);
      if (!mounted) return;
      if (foundModel) {
        setModelSrc(foundModel);
        setMode('model');
        return;
      }

      const foundVideo = await findFirstAvailable(VIDEO_CANDIDATES);
      if (!mounted) return;
      if (foundVideo) {
        setVideoSrc(foundVideo);
        setMode('video');
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
    if (mode !== 'video') return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    let rafId = 0;
    let mounted = true;
    let lastFrameTime = 0;
    const workCanvas = document.createElement('canvas');
    const workCtx = workCanvas.getContext('2d', { willReadFrequently: true });
    if (!workCtx) return;

    const setCanvasSize = () => {
      const size = 540;
      if (canvas.width !== size || canvas.height !== size) {
        canvas.width = size;
        canvas.height = size;
      }
      if (workCanvas.width !== size || workCanvas.height !== size) {
        workCanvas.width = size;
        workCanvas.height = size;
      }
    };

    const draw = (time: number) => {
      if (!mounted) return;
      rafId = requestAnimationFrame(draw);

      if (time - lastFrameTime < 33) return;
      lastFrameTime = time;
      if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) return;

      setCanvasSize();

      const dw = canvas.width;
      const dh = canvas.height;
      const vw = video.videoWidth;
      const vh = video.videoHeight;

      const square = Math.min(vw, vh);
      const sx = Math.max(0, Math.floor((vw - square) * 0.5));
      const sy = Math.max(0, Math.floor((vh - square) * 0.48));

      workCtx.clearRect(0, 0, dw, dh);
      workCtx.drawImage(video, sx, sy, square, square, 0, 0, dw, dh);

      const frame = workCtx.getImageData(0, 0, dw, dh);
      const pixels = frame.data;
      let minX = dw;
      let minY = dh;
      let maxX = -1;
      let maxY = -1;
      const alphaCutoff = 20;

      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const a = pixels[i + 3];

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const saturation = max - min;
        const redness = r - ((g + b) >> 1);

        // Aggressive background removal for dark/black pixels
        const isBlack = max < 25;
        const isDarkGray = max < 45 && saturation < 15;
        const isLowSatDark = max < 50 && saturation < 12 && redness < 10;

        if (isBlack || isDarkGray || isLowSatDark) {
          pixels[i + 3] = 0;
          continue;
        }

        // Soft fade for very dark regions
        if (max < 60) {
          const keep = Math.max(0, (max - 25) / 35);
          pixels[i + 3] = Math.floor(a * keep);
        }

        // Enhance red tissue (heart)
        if (redness > 20) {
          pixels[i] = Math.min(255, Math.floor(r * 1.12 + 12));
          pixels[i + 1] = Math.max(0, Math.floor(g * 0.91));
          pixels[i + 2] = Math.max(0, Math.floor(b * 0.88));
          pixels[i + 3] = Math.min(255, Math.floor(pixels[i + 3] * 1.14));
        }

        // Track bounds for content-aware scaling
        if (pixels[i + 3] >= alphaCutoff) {
          const px = (i >> 2) % dw;
          const py = Math.floor((i >> 2) / dw);
          if (px < minX) minX = px;
          if (py < minY) minY = py;
          if (px > maxX) maxX = px;
          if (py > maxY) maxY = py;
        }
      }
      workCtx.putImageData(frame, 0, 0);

      ctx.clearRect(0, 0, dw, dh);

      if (maxX > minX && maxY > minY) {
        const pad = 12;
        const bx = Math.max(0, minX - pad);
        const by = Math.max(0, minY - pad);
        const bw = Math.min(dw - bx, maxX - minX + 1 + pad * 2);
        const bh = Math.min(dh - by, maxY - minY + 1 + pad * 2);

        // Better aspect ratio handling for perfect fit
        const targetSize = dw * 0.88;
        const scale = targetSize / Math.max(bw, bh);
        const outW = bw * scale;
        const outH = bh * scale;
        
        // Center perfectly
        const dx = (dw - outW) * 0.5;
        const dy = (dh - outH) * 0.5;

        ctx.drawImage(workCanvas, bx, by, bw, bh, dx, dy, outW, outH);

        // Glow effect - brighter for better visibility
        const glow = ctx.createRadialGradient(dw * 0.5, dh * 0.5, dw * 0.06, dw * 0.5, dh * 0.5, dw * 0.4);
        glow.addColorStop(0, 'rgba(255,110,110,0.22)');
        glow.addColorStop(0.6, 'rgba(255,85,85,0.08)');
        glow.addColorStop(1, 'rgba(255,82,82,0)');
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, dw, dh);
        ctx.globalCompositeOperation = 'source-over';
      } else {
        ctx.drawImage(workCanvas, 0, 0);
      }
    };

    const start = () => {
      video.play().catch(() => {
        // Ignore autoplay restrictions; muted+playsInline should pass on most browsers.
      });
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(draw);
    };

    video.addEventListener('loadeddata', start);
    video.addEventListener('playing', start);
    start();

    return () => {
      mounted = false;
      cancelAnimationFrame(rafId);
      video.removeEventListener('loadeddata', start);
      video.removeEventListener('playing', start);
    };
  }, [mode, videoSrc]);

  return (
    <div className="heart-scene" aria-label="Anatomical heart visualization">
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
          <div className="heart-photo-wrap heart-video-wrap">
            <span className="heart-photo-halo" aria-hidden="true" />
            <span className="heart-photo-orbit orbit-a" aria-hidden="true" />
            <span className="heart-photo-orbit orbit-b" aria-hidden="true" />
            <div className="heart-photo-rotor heart-video-rotor">
              <video
                ref={videoRef}
                src={videoSrc}
                className="heart-video-source"
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
                aria-label="Anatomical human heart motion video"
              />
              <canvas ref={canvasRef} className="heart-video-canvas" aria-hidden="true" />
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
