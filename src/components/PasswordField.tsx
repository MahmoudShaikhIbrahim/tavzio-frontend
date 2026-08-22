import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { inputClass } from './ui';

// Same show/hide pattern already used on the login page, pulled out
// once here so every other password input in the app (email change,
// password change, anywhere else one gets added later) gets the same
// eye toggle without re-typing the same markup each time.
export default function PasswordField({ value, onChange, placeholder, required = true, autoComplete }: {
  value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean; autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className={`${inputClass} pe-11`}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute end-3 top-1/2 -translate-y-1/2 text-ivory-dim hover:text-ivory"
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
