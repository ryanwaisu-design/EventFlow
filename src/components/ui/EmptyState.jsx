export default function EmptyState({ icon = '◇', title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="text-5xl mb-4 opacity-40">{icon}</div>
      <h3 className="text-lg font-semibold text-primary mb-2">{title}</h3>
      {description && <p className="text-secondary text-sm max-w-md mb-6">{description}</p>}
      {action}
    </div>
  );
}
