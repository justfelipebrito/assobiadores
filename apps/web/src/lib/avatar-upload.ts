export const AVATAR_MAX_DIMENSION = 512;
export const AVATAR_JPEG_QUALITY = 0.78;

export function getAvatarCanvasSize(
  width: number,
  height: number,
  maxDimension = AVATAR_MAX_DIMENSION,
) {
  if (width <= 0 || height <= 0) return { width: maxDimension, height: maxDimension };
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export async function compressAvatarImage(file: File) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Nao foi possivel carregar a imagem'));
    });
    image.src = objectUrl;
    await loaded;

    const size = getAvatarCanvasSize(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Nao foi possivel processar a imagem');
    }

    context.drawImage(image, 0, 0, size.width, size.height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Nao foi possivel comprimir a imagem'));
            return;
          }
          resolve(blob);
        },
        'image/jpeg',
        AVATAR_JPEG_QUALITY,
      );
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
