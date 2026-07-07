import Modal from './Modal';

const VARIANT_CLASS = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  danger: 'btn-danger',
};

/**
 * 多選項確認對話框（例如：兩者皆保留 / 取消 / 返回）
 * actions: { label, onClick, variant?: 'primary'|'secondary'|'danger' }[]
 */
export default function ActionDialog({
  open,
  onClose,
  title,
  message,
  actions = [],
  closeOnBackdrop = false,
  wide = false,
}) {
  return (
    <Modal
      open={open}
      onClose={closeOnBackdrop ? onClose : () => {}}
      title={title}
      wide={wide}
    >
      <div className="text-secondary mb-6">
        {typeof message === 'string' ? (
          <p className="whitespace-pre-line">{message}</p>
        ) : (
          message
        )}
      </div>
      <div className="flex flex-wrap gap-3 justify-end">
        {actions.map(({ label, onClick, variant = 'secondary' }) => (
          <button
            key={label}
            type="button"
            className={VARIANT_CLASS[variant] || VARIANT_CLASS.secondary}
            onClick={() => {
              onClick?.();
              onClose?.();
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </Modal>
  );
}
