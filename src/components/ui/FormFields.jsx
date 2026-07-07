import { useState } from 'react';

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

const ADD_CATEGORY_VALUE = '__add_category__';
const ADD_SUBCATEGORY_VALUE = '__add_subcategory__';

export function CategoryFilterSelect({
  categories,
  value,
  onChange,
  className = '',
  emptyLabel = '全部類別',
}) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} className={className}>
      <option value="">{emptyLabel}</option>
      {Object.entries(categories).map(([k, v]) => (
        <option key={k} value={k}>{v}</option>
      ))}
    </Select>
  );
}

export function CategorySelect({
  value,
  onChange,
  required,
  categories,
  onAddCategory,
}) {
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');

  const handleSelectChange = (e) => {
    const next = e.target.value;
    if (next === ADD_CATEGORY_VALUE) {
      setAdding(true);
      return;
    }
    setAdding(false);
    onChange(next);
  };

  const submitNew = () => {
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    const key = onAddCategory?.(trimmed);
    if (key) {
      onChange(key);
      setAdding(false);
      setNewLabel('');
    }
  };

  const cancelAdd = () => {
    setAdding(false);
    setNewLabel('');
  };

  return (
    <div>
      <Select
        value={adding ? ADD_CATEGORY_VALUE : value}
        onChange={handleSelectChange}
        required={required && !adding}
      >
        {Object.entries(categories).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
        {onAddCategory && <option value={ADD_CATEGORY_VALUE}>＋ 新增類別…</option>}
      </Select>
      {adding && (
        <div className="flex gap-2 mt-2 items-center">
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="例：內地"
            className="flex-1"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submitNew();
              }
              if (e.key === 'Escape') cancelAdd();
            }}
          />
          <button type="button" className="btn-primary btn-sm shrink-0" onClick={submitNew}>
            加入
          </button>
          <button type="button" className="btn-secondary btn-sm shrink-0" onClick={cancelAdd}>
            取消
          </button>
        </div>
      )}
    </div>
  );
}

function SubcategorySelect({
  parentCategory,
  value,
  onChange,
  subcategories,
  onAddSubcategory,
}) {
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');

  const handleSelectChange = (e) => {
    const next = e.target.value;
    if (next === ADD_SUBCATEGORY_VALUE) {
      setAdding(true);
      return;
    }
    setAdding(false);
    onChange(next);
  };

  const submitNew = () => {
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    const label = onAddSubcategory?.(parentCategory, trimmed);
    if (label) {
      onChange(label);
      setAdding(false);
      setNewLabel('');
    }
  };

  const cancelAdd = () => {
    setAdding(false);
    setNewLabel('');
  };

  if (!parentCategory) {
    return (
      <Select disabled className="opacity-60">
        <option>請先選擇主類別</option>
      </Select>
    );
  }

  return (
    <div>
      <Select value={adding ? ADD_SUBCATEGORY_VALUE : (value || '')} onChange={handleSelectChange}>
        <option value="">不選擇</option>
        {subcategories.map((label) => (
          <option key={label} value={label}>{label}</option>
        ))}
        {value && !subcategories.includes(value) && (
          <option value={value}>{value}</option>
        )}
        {onAddSubcategory && <option value={ADD_SUBCATEGORY_VALUE}>＋ 新增次類別…</option>}
      </Select>
      {adding && (
        <div className="flex gap-2 mt-2 items-center">
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="例：行政會"
            className="flex-1"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submitNew();
              }
              if (e.key === 'Escape') cancelAdd();
            }}
          />
          <button type="button" className="btn-primary btn-sm shrink-0" onClick={submitNew}>
            加入
          </button>
          <button type="button" className="btn-secondary btn-sm shrink-0" onClick={cancelAdd}>
            取消
          </button>
        </div>
      )}
    </div>
  );
}

/** 嘉賓主類別 + 次類別（選填） */
export function GuestCategoryFields({
  category,
  subcategory,
  onCategoryChange,
  onSubcategoryChange,
  categories,
  subcategories,
  onAddCategory,
  onAddSubcategory,
  required,
}) {
  const handleCategoryChange = (next) => {
    onCategoryChange(next);
    onSubcategoryChange('');
  };

  return (
    <div className="space-y-0">
      <FormField label="主類別" required={required}>
        <CategorySelect
          value={category}
          onChange={handleCategoryChange}
          categories={categories}
          onAddCategory={onAddCategory}
          required={required}
        />
      </FormField>
      <FormField label="次類別">
        <SubcategorySelect
          parentCategory={category}
          value={subcategory || ''}
          onChange={onSubcategoryChange}
          subcategories={subcategories}
          onAddSubcategory={onAddSubcategory}
        />
      </FormField>
    </div>
  );
}
