import React, { createContext, useContext } from 'react';
import { CloudUpload, AlertCircle } from 'lucide-react';
import { useDropzone, formatBytes } from '../hooks/use-dropzone';
import { cn } from '../lib/utils';
import './Dropzone.css';

export interface DropzoneContextValue {
  openFileDialog: () => void;
  disabled?: boolean;
}

const DropzoneContext = createContext<DropzoneContextValue | null>(null);

export function useDropzoneContext() {
  return useContext(DropzoneContext);
}

export type DropzoneSize = 'sm' | 'md' | 'lg';

export interface DropzoneProps extends Omit<React.ComponentPropsWithoutRef<'div'>, 'title'> {
  accept?: string;
  maxSize?: number;
  multiple?: boolean;
  disabled?: boolean;
  error?: boolean;
  errorMessage?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  onFilesAccepted?: (files: File[]) => void;
  onFileReject?: (file: File, reason: string) => void;
  size?: DropzoneSize;
  className?: string;
  children?: React.ReactNode;
}

export const Dropzone: React.FC<DropzoneProps> = ({
  accept,
  maxSize,
  multiple = false,
  disabled = false,
  error: forcedError,
  errorMessage,
  title,
  description,
  onFilesAccepted,
  onFileReject,
  size = 'lg',
  className,
  children,
  ...restProps
}) => {
  const {
    isDragging,
    rejectionMessage,
    openFileDialog,
    getInputProps,
    getDropzoneProps,
  } = useDropzone({
    accept,
    maxSize,
    multiple,
    disabled,
    onFilesAccepted,
    onFileReject,
  });

  const isError = forcedError || Boolean(rejectionMessage);
  const activeErrorMsg = errorMessage || rejectionMessage;

  const dropzoneProps = getDropzoneProps();
  const inputProps = getInputProps();

  // State derivation for data-state
  const state: 'idle' | 'dragging' | 'error' | 'disabled' = disabled
    ? 'disabled'
    : isError
    ? 'error'
    : isDragging
    ? 'dragging'
    : 'idle';

  // Derived description
  const derivedDesc = description !== undefined
    ? description
    : accept && maxSize
    ? `${accept} até ${formatBytes(maxSize)}`
    : maxSize
    ? `Até ${formatBytes(maxSize)} por arquivo`
    : accept
    ? `Arquivos ${accept}`
    : 'Arraste e solte seus arquivos aqui ou navegue no computador';

  const defaultTitle = title || (isDragging ? 'Solte os arquivos aqui' : 'Arraste arquivos ou clique para enviar');

  return (
    <DropzoneContext.Provider value={{ openFileDialog, disabled }}>
      <div
        {...restProps}
        {...dropzoneProps}
        data-state={state}
        data-size={size}
        className={cn('dropzone-root', className)}
      >
        <input {...inputProps} />

        {children ? (
          children
        ) : (
          <>
            <DropzoneHeader>
              <DropzoneIcon>
                {isError ? (
                  <AlertCircle size={size === 'sm' ? 18 : 24} />
                ) : (
                  <CloudUpload size={size === 'sm' ? 18 : 24} />
                )}
              </DropzoneIcon>

              <DropzoneHeading>
                <DropzoneTitle>{defaultTitle}</DropzoneTitle>
                {derivedDesc && <DropzoneDescription>{derivedDesc}</DropzoneDescription>}
                {isError && activeErrorMsg && (
                  <div className="dropzone-error-msg">
                    <AlertCircle size={14} />
                    <span>{activeErrorMsg}</span>
                  </div>
                )}
              </DropzoneHeading>
            </DropzoneHeader>

            {size === 'lg' && <DropzoneSeparator>ou</DropzoneSeparator>}

            <DropzoneTrigger>
              Procurar arquivos
            </DropzoneTrigger>
          </>
        )}
      </div>
    </DropzoneContext.Provider>
  );
};

/* ── Composition Parts ────────────────────────────────────────── */

export const DropzoneHeader: React.FC<React.ComponentPropsWithoutRef<'div'>> = ({
  className,
  children,
  ...props
}) => (
  <div data-slot="dropzone-header" className={cn('dropzone-header', className)} {...props}>
    {children}
  </div>
);

export const DropzoneHeading: React.FC<React.ComponentPropsWithoutRef<'div'>> = ({
  className,
  children,
  ...props
}) => (
  <div data-slot="dropzone-heading" className={cn('dropzone-heading', className)} {...props}>
    {children}
  </div>
);

export const DropzoneIcon: React.FC<React.ComponentPropsWithoutRef<'div'>> = ({
  className,
  children,
  ...props
}) => (
  <div data-slot="dropzone-icon" className={cn('dropzone-icon-box', className)} {...props}>
    {children || <CloudUpload size={22} />}
  </div>
);

export const DropzoneTitle: React.FC<React.ComponentPropsWithoutRef<'p'>> = ({
  className,
  children,
  ...props
}) => (
  <p data-slot="dropzone-title" className={cn('dropzone-title', className)} {...props}>
    {children}
  </p>
);

export const DropzoneDescription: React.FC<React.ComponentPropsWithoutRef<'div'>> = ({
  className,
  children,
  ...props
}) => (
  <div data-slot="dropzone-description" className={cn('dropzone-description', className)} {...props}>
    {children}
  </div>
);

export const DropzoneSeparator: React.FC<React.ComponentPropsWithoutRef<'div'>> = ({
  className,
  children = 'ou',
  ...props
}) => (
  <div data-slot="dropzone-separator" className={cn('dropzone-separator', className)} {...props}>
    {children}
  </div>
);

export interface DropzoneTriggerProps extends React.ComponentPropsWithoutRef<'button'> {
  accept?: string;
  maxSize?: number;
  multiple?: boolean;
}

export const DropzoneTrigger: React.FC<DropzoneTriggerProps> = ({
  className,
  children,
  onClick,
  ...props
}) => {
  const ctx = useDropzoneContext();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    if (!e.defaultPrevented && ctx) {
      ctx.openFileDialog();
    }
  };

  return (
    <button
      data-slot="dropzone-trigger"
      type="button"
      className={cn('dropzone-trigger-btn', className)}
      disabled={ctx?.disabled}
      onClick={handleClick}
      {...props}
    >
      {children || 'Procurar'}
    </button>
  );
};

export default Dropzone;
