import { useCallback } from 'react';
import { useSeatingWorkspaceStore } from '../store/seatingWorkspaceStore';

const UNSAVED_MSG =
  '您有尚未儲存的排位變更，確定要離開嗎？未儲存的進度將會遺失。';

export function useUnsavedGuard(isDashboard = false) {
  const hasUnsaved = useSeatingWorkspaceStore((s) => s.hasUnsavedChanges);
  const revertToSaved = useSeatingWorkspaceStore((s) => s.revertToSaved);

  const confirmLeave = useCallback(() => {
    if (!isDashboard || !hasUnsaved()) return true;
    if (confirm(UNSAVED_MSG)) {
      revertToSaved();
      return true;
    }
    return false;
  }, [isDashboard, hasUnsaved, revertToSaved]);

  return { confirmLeave, hasUnsavedChanges: hasUnsaved };
}
