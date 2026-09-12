import { useState, useRef, useCallback, useEffect } from 'react';

export interface UseDropzoneOptions {
  accept?: string;
  maxSize?: number; // In bytes
  multiple?: boolean;
  disabled?: boolean;
  onFilesAccepted?: (files: File[]) => void;
  onFileReject?: (file: File, reason: string) => void;
}

export interface UseDropzoneReturn {
  isDragging: boolean;
  rejectionMessage: string | null;
  clearRejection: () => void;
  openFileDialog: () => void;
  inputRef: React.RefObject<HTMLInputElement>;
  getInputProps: () => React.InputHTMLAttributes<HTMLInputElement> & { ref: React.RefObject<HTMLInputElement> };
  getDropzoneProps: () => React.HTMLAttributes<HTMLDivElement> & {
    role: string;
    tabIndex: number;
    'aria-disabled': boolean;
    'data-slot': string;
    'data-state': 'idle' | 'dragging' | 'error' | 'disabled';
  };
}

export function formatBytes(bytes?: number): string {
  if (bytes === undefined || bytes === null || isNaN(bytes)) return '';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = bytes / Math.pow(k, i);
  return `${val >= 10 || i === 0 ? val.toFixed(0) : val.toFixed(1)} ${sizes[i]}`;
}

export function isFileTypeAccepted(file: File, accept?: string): boolean {
  if (!accept || !accept.trim() || accept.trim() === '*') return true;

  const rules = accept
    .split(',')
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean);

  const fileName = file.name.toLowerCase();
  const fileType = (file.type || '').toLowerCase();

  return rules.some((rule) => {
    if (rule.startsWith('.')) {
      return fileName.endsWith(rule);
    }
    if (rule.endsWith('/*')) {
      const typePrefix = rule.replace('/*', '');
      return fileType.startsWith(`${typePrefix}/`);
    }
    if (rule.includes('/')) {
      return fileType === rule;
    }
    // Fallback: rule might be just extension without dot e.g. "pdf"
    return fileName.endsWith(`.${rule}`);
  });
}

export function useDropzone(options: UseDropzoneOptions = {}): UseDropzoneReturn {
  const {
    accept,
    maxSize,
    multiple = false,
    disabled = false,
    onFilesAccepted,
    onFileReject,
  } = options;

  const [isDragging, setIsDragging] = useState(false);
  const [rejectionMessage, setRejectionMessage] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const clearRejection = useCallback(() => {
    setRejectionMessage(null);
  }, []);

  const openFileDialog = useCallback(() => {
    if (disabled) return;
    inputRef.current?.click();
  }, [disabled]);

  const processFiles = useCallback(
    (rawFiles: FileList | File[]) => {
      if (disabled) return;
      clearRejection();

      const filesArray = Array.from(rawFiles);
      if (!filesArray.length) return;

      const toProcess = multiple ? filesArray : [filesArray[0]];

      const accepted: File[] = [];
      const rejected: { file: File; reason: string }[] = [];

      for (const file of toProcess) {
        if (!isFileTypeAccepted(file, accept)) {
          const ext = file.name.split('.').pop();
          const reason = `Tipo de arquivo não permitido (${ext ? `.${ext}` : file.type || 'desconhecido'}).`;
          rejected.push({ file, reason });
          continue;
        }

        if (maxSize !== undefined && file.size > maxSize) {
          const reason = `Arquivo "${file.name}" excede o tamanho máximo de ${formatBytes(maxSize)}.`;
          rejected.push({ file, reason });
          continue;
        }

        accepted.push(file);
      }

      if (rejected.length > 0) {
        setRejectionMessage(rejected[0].reason);
        for (const item of rejected) {
          onFileReject?.(item.file, item.reason);
        }
      }

      if (accepted.length > 0) {
        onFilesAccepted?.(accepted);
      }
    },
    [accept, disabled, maxSize, multiple, onFilesAccepted, onFileReject, clearRejection]
  );

  const handleDragEnter = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      dragCounterRef.current += 1;
      if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
        setIsDragging(true);
      }
    },
    [disabled]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      e.dataTransfer.dropEffect = 'copy';
      if (!isDragging) setIsDragging(true);
    },
    [disabled, isDragging]
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      dragCounterRef.current -= 1;
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0;
        setIsDragging(false);
      }
    },
    [disabled]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsDragging(false);
      if (disabled) return;

      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
      }
    },
    [disabled, processFiles]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (disabled) return;
      if (e.target.files && e.target.files.length > 0) {
        processFiles(e.target.files);
      }
      // Reset input value so selecting the same file again still fires change
      e.target.value = '';
    },
    [disabled, processFiles]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled) return;
      // Do not trigger file picker if user clicked a nested button, link, or label
      const target = e.target as HTMLElement;
      if (target.closest('button, a, label, input, textarea, select')) {
        return;
      }
      openFileDialog();
    },
    [disabled, openFileDialog]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openFileDialog();
      }
    },
    [disabled, openFileDialog]
  );

  useEffect(() => {
    return () => {
      dragCounterRef.current = 0;
    };
  }, []);

  const state: 'idle' | 'dragging' | 'error' | 'disabled' = disabled
    ? 'disabled'
    : rejectionMessage
    ? 'error'
    : isDragging
    ? 'dragging'
    : 'idle';

  const getInputProps = useCallback(
    () => ({
      ref: inputRef,
      type: 'file' as const,
      accept,
      multiple,
      disabled,
      onChange: handleInputChange,
      style: { display: 'none' },
      tabIndex: -1,
      'aria-hidden': true,
    }),
    [accept, disabled, handleInputChange, multiple]
  );

  const getDropzoneProps = useCallback(
    () => ({
      role: 'button',
      tabIndex: disabled ? -1 : 0,
      'aria-disabled': disabled,
      'aria-invalid': !!rejectionMessage,
      'data-slot': 'dropzone',
      'data-state': state,
      onDragEnter: handleDragEnter,
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
      onClick: handleClick,
      onKeyDown: handleKeyDown,
    }),
    [disabled, rejectionMessage, state, handleDragEnter, handleDragOver, handleDragLeave, handleDrop, handleClick, handleKeyDown]
  );

  return {
    isDragging,
    rejectionMessage,
    clearRejection,
    openFileDialog,
    inputRef,
    getInputProps,
    getDropzoneProps,
  };
}

export default useDropzone;
