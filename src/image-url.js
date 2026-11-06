const BLOCKED_SCHEME = /^(javascript|data|file|blob|vbscript|filesystem|about|chrome|chrome-extension|view-source):/i;

export function inspectImageSrc(src) {
  if (typeof src !== 'string') return { ok: false, message: 'La URL de la imagen debe ser texto' };
  const raw = src.trim();
  if (!raw) return { ok: false, message: 'La URL de la imagen está vacía' };
  if (/[\u0000-\u001F\u007F]/.test(raw) || /\s/.test(raw)) {
    return { ok: false, message: 'La URL de la imagen contiene caracteres no permitidos' };
  }
  if (raw.startsWith('//')) {
    return { ok: false, message: 'Las URLs de protocolo relativo no están permitidas' };
  }

  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return { ok: false, message: 'La URL de la imagen no se puede decodificar' };
  }
  const probe = decoded.trim();
  if (BLOCKED_SCHEME.test(probe) || BLOCKED_SCHEME.test(raw)) {
    return { ok: false, message: 'Esquema de imagen no permitido' };
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(probe)) {
    let url;
    try {
      url = new URL(raw);
    } catch {
      return { ok: false, message: 'URL de imagen inválida' };
    }
    if (url.protocol !== 'https:') {
      return { ok: false, message: 'Solo se permiten imágenes https: o rutas relativas' };
    }
    if (!url.hostname) return { ok: false, message: 'La URL https no tiene host' };
    return { ok: true, src: raw };
  }

  if (raw.includes('\\') || raw.includes('://')) {
    return { ok: false, message: 'Ruta de imagen inválida' };
  }
  return { ok: true, src: raw };
}
