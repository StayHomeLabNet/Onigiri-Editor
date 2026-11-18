const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|bmp|ico|avif|svg)$/i;

function normalizeSlashes(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+$/, '');
}

function splitPathSegments(p: string): { prefix: string; parts: string[] } {
  const norm = normalizeSlashes(p);
  const winDrive = norm.match(/^([A-Za-z]:)(?:\/(.*))?$/);
  if (winDrive) {
    const rest = (winDrive[2] || '').split('/').filter((s) => s && s !== '.');
    return { prefix: winDrive[1].toUpperCase(), parts: rest };
  }
  if (norm.startsWith('/')) {
    return {
      prefix: '/',
      parts: norm.slice(1).split('/').filter((s) => s && s !== '.'),
    };
  }
  return {
    prefix: '',
    parts: norm.split('/').filter((s) => s && s !== '.'),
  };
}

function resolveDotSegments(parts: string[]): string[] {
  const stack: string[] = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (stack.length > 0 && stack[stack.length - 1] !== '..') {
        stack.pop();
      }
    } else {
      stack.push(part);
    }
  }
  return stack;
}

export function getDirPath(filePath: string): string {
  const norm = normalizeSlashes(filePath);
  const idx = norm.lastIndexOf('/');
  if (idx <= 0) {
    return norm.startsWith('/') ? '/' : '';
  }
  return norm.slice(0, idx);
}

export function computeRelativePath(
  fromFileOrDir: string,
  fromIsFile: boolean,
  targetPath: string
): string {
  const baseDir = fromIsFile ? getDirPath(fromFileOrDir) : normalizeSlashes(fromFileOrDir);
  if (!baseDir) {
    return normalizeSlashes(targetPath);
  }

  const from = splitPathSegments(baseDir);
  const to = splitPathSegments(targetPath);
  if (from.prefix !== to.prefix) {
    return normalizeSlashes(targetPath);
  }

  const fromParts = resolveDotSegments(from.parts);
  const toParts = resolveDotSegments(to.parts);

  const isCaseInsensitive = /^[A-Z]:$/.test(from.prefix);
  let common = 0;
  while (
    common < fromParts.length &&
    common < toParts.length &&
    (isCaseInsensitive
      ? fromParts[common].toLowerCase() === toParts[common].toLowerCase()
      : fromParts[common] === toParts[common])
  ) {
    common++;
  }

  const ups = fromParts.length - common;
  const downs = toParts.slice(common);
  if (ups === 0) {
    return downs.length > 0 ? `./${downs.join('/')}` : '.';
  }
  return `${'../'.repeat(ups)}${downs.join('/')}`;
}

export function buildMarkdownDropLink(params: {
  targetPath: string;
  targetName: string;
  relativePathFromRoot?: string;
  activeDocPath?: string;
  workspaceRoot?: string | null;
}): string {
  const { targetPath, targetName, relativePathFromRoot, activeDocPath, workspaceRoot } = params;
  let rel: string;
  if (activeDocPath && activeDocPath.trim()) {
    rel = computeRelativePath(activeDocPath, true, targetPath);
  } else if (workspaceRoot && workspaceRoot.trim()) {
    rel = computeRelativePath(workspaceRoot, false, targetPath);
  } else if (relativePathFromRoot) {
    const cleaned = normalizeSlashes(relativePathFromRoot).replace(/^\/+/, '');
    rel = cleaned.startsWith('./') ? cleaned : `./${cleaned}`;
  } else {
    rel = normalizeSlashes(targetPath);
  }

  const encodedPath = /\s/.test(rel) ? rel.replace(/ /g, '%20') : rel;
  if (IMAGE_EXT_RE.test(targetName)) {
    const stem = targetName.replace(/\.[^.]+$/, '') || 'image';
    return `![${stem}](${encodedPath})`;
  }
  return `[${targetName}](${encodedPath})`;
}
