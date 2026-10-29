import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../ui/Modal.jsx';

// Live camera capture (ported from simple_editable_train). Works with desktop
// webcams and phone/tablet cameras. Defaults to the back camera, since kids
// photograph a drawing lying on the table. Returns the full frame as a PNG data
// URL; the cropper decides the final square.
export default function CameraCapture({ onCapture, onCancel }) {
  const { t } = useTranslation();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState('starting');
  const [errorMsg, setErrorMsg] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [facingMode, setFacingMode] = useState('environment');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const startStream = useCallback(async (mode) => {
    stopStream();
    setStatus('starting');
    setErrorMsg(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error');
      setErrorMsg(t('camera.error_unsupported'));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setStatus('ready');
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setHasMultipleCameras(devices.filter((d) => d.kind === 'videoinput').length > 1);
      } catch {
        setHasMultipleCameras(false);
      }
    } catch (err) {
      setStatus('error');
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError' || name === 'SecurityError') setErrorMsg(t('camera.error_denied'));
      else if (name === 'NotFoundError' || name === 'OverconstrainedError') setErrorMsg(t('camera.error_no_device'));
      else setErrorMsg(t('camera.error_generic'));
    }
  }, [stopStream, t]);

  useEffect(() => {
    startStream(facingMode);
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A laptop webcam reports facingMode 'user' even when we asked for the back one.
  const isMirrored = () => streamRef.current?.getVideoTracks()[0]?.getSettings().facingMode === 'user';

  const handleSwitch = () => {
    const next = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(next);
    startStream(next);
  };

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (isMirrored()) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);
    setSnapshot(canvas.toDataURL('image/png'));
    stopStream();
  };

  const handleRetake = () => {
    setSnapshot(null);
    startStream(facingMode);
  };

  const handleCancel = () => {
    stopStream();
    onCancel();
  };

  return (
    <Modal onClose={handleCancel}>
      <h2>{t('camera.title')}</h2>
      <p className="muted small">{t('camera.hint')}</p>
      <div className="cam-view">
        {snapshot ? (
          <img src={snapshot} alt="" style={{ objectFit: 'contain' }} />
        ) : (
          <>
            <video ref={videoRef} playsInline muted className={isMirrored() ? 'mirror' : ''} />
            {status === 'starting' && <div className="cam-msg">{t('camera.starting')}</div>}
            {status === 'error' && <div className="cam-msg error-text">{errorMsg}</div>}
          </>
        )}
      </div>
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn" onClick={handleCancel}>{t('common.cancel')}</button>
        <span className="spacer" />
        {snapshot ? (
          <>
            <button className="btn" onClick={handleRetake}>↺ {t('camera.retake')}</button>
            <button className="btn primary" onClick={() => onCapture(snapshot)}>✓ {t('camera.use')}</button>
          </>
        ) : (
          <>
            {hasMultipleCameras && status === 'ready' && (
              <button className="btn" onClick={handleSwitch} title={t('camera.switch')}>⇄</button>
            )}
            {status === 'error' ? (
              <button className="btn primary" onClick={() => startStream(facingMode)}>↺ {t('camera.retry')}</button>
            ) : (
              <button className="btn primary" onClick={handleCapture} disabled={status !== 'ready'}>📷 {t('camera.capture')}</button>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
