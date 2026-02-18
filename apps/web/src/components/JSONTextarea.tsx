'use client';

import { useId, useRef, useState } from 'react';

type JSONTextareaProps = {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  helperText?: string;
};

export default function JSONTextarea({
  label,
  name,
  defaultValue,
  placeholder,
  helperText,
}: JSONTextareaProps) {
  const id = useId();
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validate = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setError(null);
      ref.current?.setCustomValidity('');
      return;
    }
    try {
      JSON.parse(trimmed);
      setError(null);
      ref.current?.setCustomValidity('');
    } catch {
      const message = `${label} must be valid JSON`;
      setError(message);
      ref.current?.setCustomValidity(message);
    }
  };

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-xs uppercase tracking-wider text-muted">
        {label}
      </label>
      <textarea
        ref={ref}
        id={id}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        onChange={(event) => validate(event.target.value)}
        onBlur={(event) => validate(event.target.value)}
        className={`min-h-[120px] w-full rounded-lg border px-3 py-2 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30 ${
          error ? 'border-red-400 bg-red-50' : 'border-border bg-surface'
        }`}
      />
      <div className="text-xs text-muted">
        {error ? <span className="text-red-500">{error}</span> : helperText}
      </div>
    </div>
  );
}
