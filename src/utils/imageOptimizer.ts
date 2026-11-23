export interface ImageOptimizeOptions {
  enabled: boolean;
  maxWidth: number;
  qualityPercent: number; // 40..100
  autoOrganizeName: boolean;
}

export interface OptimizedImageResult {
  dataUrl: string;
  ext: string;
  suggestedFileName: string;
  originalBytes: number;
  optimizedBytes: number;
  wasResizedOrCompressed: boolean;
}

export function buildOrganizedImageName(
  originalName: string,
  targetExt: string,
  now = new Date()
): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const stem = originalName
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9\u3040-\u30ff\u4e00-\u9faf_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  const cleanStem = stem && stem !== 'image' ? stem : 'img';
  return `${stamp}-${cleanStem}.${targetExt}`;
}

export function formatFileSizeShort(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function estimateDataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return 0;
  const b64 = dataUrl.slice(comma + 1);
  return Math.floor((b64.length * 3) / 4);
}

/**
 * Resizes and compresses raster images in the browser Canvas when `options.enabled` is true.
 * Preserves SVG/GIF untouched and falls back safely if Canvas/Image decoding is unavailable.
 */
export async function optimizeImageDataUrl(
  rawDataUrl: string,
  originalName: string,
  originalExt: string,
  options: ImageOptimizeOptions
): Promise<OptimizedImageResult> {
  const originalBytes = estimateDataUrlBytes(rawDataUrl);
  const cleanExt = originalExt.toLowerCase().replace('jpeg', 'jpg') || 'png';
  const suggestedBaseName = options.autoOrganizeName
    ? buildOrganizedImageName(originalName, cleanExt)
    : originalName;

  if (
    !options.enabled ||
    cleanExt === 'svg' ||
    cleanExt === 'gif' ||
    typeof document === 'undefined' ||
    typeof Image === 'undefined'
  ) {
    return {
      dataUrl: rawDataUrl,
      ext: cleanExt,
      suggestedFileName: suggestedBaseName,
      originalBytes,
      optimizedBytes: originalBytes,
      wasResizedOrCompressed: false,
    };
  }

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Image decode failed'));
      el.src = rawDataUrl;
    });

    const maxW = Math.max(320, Math.min(4096, options.maxWidth || 1600));
    const scale = img.naturalWidth > maxW ? maxW / img.naturalWidth : 1;
    const targetW = Math.max(1, Math.round(img.naturalWidth * scale));
    const targetH = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return {
        dataUrl: rawDataUrl,
        ext: cleanExt,
        suggestedFileName: suggestedBaseName,
        originalBytes,
        optimizedBytes: originalBytes,
        wasResizedOrCompressed: false,
      };
    }

    ctx.drawImage(img, 0, 0, targetW, targetH);
    const quality = Math.max(0.4, Math.min(1, (options.qualityPercent || 85) / 100));
    // Prefer WebP where the WebView supports encoding it (Windows WebView2 / Chromium)
    const webpUrl = canvas.toDataURL('image/webp', quality);
    const webpBytes = estimateDataUrlBytes(webpUrl);
    const useWebp =
      webpUrl.startsWith('data:image/webp') &&
      (scale < 1 || webpBytes < originalBytes * 0.92);

    if (useWebp) {
      const nextExt = 'webp';
      return {
        dataUrl: webpUrl,
        ext: nextExt,
        suggestedFileName: options.autoOrganizeName
          ? buildOrganizedImageName(originalName, nextExt)
          : originalName.replace(/\.[^.]+$/, '.webp'),
        originalBytes,
        optimizedBytes: webpBytes,
        wasResizedOrCompressed: true,
      };
    }

    // Fallback for macOS WKWebView and Linux WebKitGTK (which do not support WebP canvas encoding):
    // compress JPEGs via image/jpeg, and preserve resized PNGs via image/png so maxWidth still applies.
    if (cleanExt === 'jpg') {
      const jpegUrl = canvas.toDataURL('image/jpeg', quality);
      const jpegBytes = estimateDataUrlBytes(jpegUrl);
      if (
        jpegUrl.startsWith('data:image/jpeg') &&
        (scale < 1 || jpegBytes < originalBytes * 0.92)
      ) {
        return {
          dataUrl: jpegUrl,
          ext: 'jpg',
          suggestedFileName: suggestedBaseName,
          originalBytes,
          optimizedBytes: jpegBytes,
          wasResizedOrCompressed: true,
        };
      }
    } else if (scale < 1) {
      const pngUrl = canvas.toDataURL('image/png');
      const pngBytes = estimateDataUrlBytes(pngUrl);
      if (pngUrl.startsWith('data:image/png')) {
        return {
          dataUrl: pngUrl,
          ext: 'png',
          suggestedFileName: options.autoOrganizeName
            ? buildOrganizedImageName(originalName, 'png')
            : originalName.replace(/\.[^.]+$/, '.png'),
          originalBytes,
          optimizedBytes: pngBytes,
          wasResizedOrCompressed: true,
        };
      }
    }

    return {
      dataUrl: rawDataUrl,
      ext: cleanExt,
      suggestedFileName: suggestedBaseName,
      originalBytes,
      optimizedBytes: originalBytes,
      wasResizedOrCompressed: false,
    };
  } catch {
    return {
      dataUrl: rawDataUrl,
      ext: cleanExt,
      suggestedFileName: suggestedBaseName,
      originalBytes,
      optimizedBytes: originalBytes,
      wasResizedOrCompressed: false,
    };
  }
}
