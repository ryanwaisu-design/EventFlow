import { GUEST_CATEGORIES } from '../../data/constants';

export function FormField({ label, required, children, className = '' }) {
  return (
    <div className={`mb-4 ${className}`}>
      <label className="block text-sm font-medium text-secondary mb-1.5">
        {label}{required && <span className="text-danger ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

export function Input({ className = '', ...props }) {
  return <input className={`input ${className}`} {...props} />;
}

export function Select({ className = '', children, ...props }) {
  return <select className={`input ${className}`} {...props}>{children}</select>;
}

export function Textarea({ className = '', ...props }) {
  return <textarea className={`input min-h-[80px] resize-y ${className}`} {...props} />;
}

export function EventSelect({ events, value, onChange, required, allowEmpty, emptyLabel = '請選擇活動' }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} required={required}>
      {allowEmpty && <option value="">{emptyLabel}</option>}
      {(events || []).map((ev) => (
        <option key={ev.id} value={ev.id}>{ev.name} — {ev.date}</option>
      ))}
    </Select>
  );
}

export function CategorySelect({ value, onChange, required }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} required={required}>
      {Object.entries(GUEST_CATEGORIES).map(([k, v]) => (
        <option key={k} value={k}>{v}</option>
      ))}
    </Select>
  );
}
