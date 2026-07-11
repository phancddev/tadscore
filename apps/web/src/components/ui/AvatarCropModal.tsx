import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { Modal } from './Modal';

const VIEW = 280;
const OUTPUT = 512;

type Props = {
  open: boolean;
  file: File | null;
  onClose: () => void;
  onConfirm: (file: File) => void;
};

export function AvatarCropModal({ open, file, onClose, onConfirm }: Props) {
  const { t } = useTranslation('auth');
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const minScale = useMemo(() => {
    if (!natural.w || !natural.h) return 1;
    return Math.max(VIEW / natural.w, VIEW / natural.h);
  }, [natural]);

  const scale = minScale * zoom;

  const clampOffset = useCallback(
    (x: number, y: number, nextScale = scale) => {
      const drawW = natural.w * nextScale;
      const drawH = natural.h * nextScale;
      const minX = VIEW - drawW;
      const minY = VIEW - drawH;
      return {
        x: Math.min(0, Math.max(minX, x)),
        y: Math.min(0, Math.max(minY, y)),
      };
    },
    [natural.h, natural.w, scale],
  );

  const resetForImage = useCallback(
    (w: number, h: number) => {
      setNatural({ w, h });
      setZoom(1);
      const cover = Math.max(VIEW / w, VIEW / h);
      setOffset({
        x: (VIEW - w * cover) / 2,
        y: (VIEW - h * cover) / 2,
      });
    },
    [],
  );

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const dx = event.clientX - dragRef.current.x;
    const dy = event.clientY - dragRef.current.y;
    setOffset(clampOffset(dragRef.current.ox + dx, dragRef.current.oy + dy));
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  const onZoomChange = (value: number) => {
    const nextZoom = value;
    const nextScale = minScale * nextZoom;
    setZoom(nextZoom);
    setOffset((prev) => {
      const cx = VIEW / 2;
      const cy = VIEW / 2;
      const imgX = (cx - prev.x) / scale;
      const imgY = (cy - prev.y) / scale;
      const nextX = cx - imgX * nextScale;
      const nextY = cy - imgY * nextScale;
      const drawW = natural.w * nextScale;
      const drawH = natural.h * nextScale;
      return {
        x: Math.min(0, Math.max(VIEW - drawW, nextX)),
        y: Math.min(0, Math.max(VIEW - drawH, nextY)),
      };
    });
  };

  const confirm = async () => {
    const image = imgRef.current;
    if (!image || !file || !natural.w) return;
    setBusy(true);
    try {
      const sx = -offset.x / scale;
      const sy = -offset.y / scale;
      const sSize = VIEW / scale;
      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT;
      canvas.height = OUTPUT;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image, sx, sy, sSize, sSize, 0, 0, OUTPUT, OUTPUT);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.92),
      );
      if (!blob) throw new Error('blob');
      const cropped = new File([blob], `avatar-${Date.now()}.jpg`, { type: 'image/jpeg' });
      onConfirm(cropped);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open && !!file} onClose={onClose} title={t('profile.cropTitle')}>
      <div className="grid gap-4">
        <p className="m-0 text-sm text-[var(--muted-foreground)]">{t('profile.cropHint')}</p>
        <div
          className="relative mx-auto touch-none select-none overflow-hidden rounded-full border border-[var(--border)] bg-[var(--muted)]"
          style={{ width: VIEW, height: VIEW, cursor: 'grab' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {url && (
            <img
              ref={imgRef}
              src={url}
              alt=""
              draggable={false}
              className="absolute max-w-none pointer-events-none"
              style={{
                width: natural.w ? natural.w * scale : undefined,
                height: natural.h ? natural.h * scale : undefined,
                left: offset.x,
                top: offset.y,
              }}
              onLoad={(event) => {
                const el = event.currentTarget;
                resetForImage(el.naturalWidth, el.naturalHeight);
              }}
            />
          )}
        </div>
        <label className="grid gap-2 text-sm">
          <span className="font-medium">{t('profile.cropZoom')}</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(event) => onZoomChange(Number(event.target.value))}
            className="w-full"
          />
        </label>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" type="button" onClick={onClose} disabled={busy}>
            {t('profile.cropCancel')}
          </Button>
          <Button type="button" loading={busy} onClick={() => void confirm()}>
            {t('profile.cropConfirm')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
