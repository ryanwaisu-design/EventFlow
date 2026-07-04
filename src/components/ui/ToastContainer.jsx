export default function ToastContainer({ toasts }) {
  const typeStyles = {
    success: 'border-success/50 bg-success/10',
    error: 'border-danger/50 bg-danger/10',
    warning: 'border-warning/50 bg-warning/10',
    info: 'border-info/50 bg-info/10',
  };

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div key={t.id} className={`px-4 py-3 rounded-card border text-sm text-primary shadow-lg animate-slide-up ${typeStyles[t.type] || typeStyles.info}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
