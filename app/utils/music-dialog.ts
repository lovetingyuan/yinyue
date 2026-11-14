const dialogs: { element: HTMLDialogElement }[] = [];

export function showMusicDialog(dialog?: HTMLDialogElement | null) {
  if (!dialog || dialog.open) return;
  dialog.showModal();
  const entry = { element: dialog };
  dialogs.push(entry);
  dialog.addEventListener(
    "close",
    () => {
      const index = dialogs.indexOf(entry);
      if (index !== -1) dialogs.splice(index, 1);
    },
    { once: true },
  );
}

export function closeTopMusicDialog() {
  while (dialogs.length) {
    const dialog = dialogs.at(-1)?.element;
    if (dialog?.isConnected && dialog.open) {
      if (typeof dialog.requestClose === "function") dialog.requestClose();
      else if (dialog.dispatchEvent(new Event("cancel", { cancelable: true }))) dialog.close();
      return true;
    }
    dialogs.pop();
  }
  return false;
}
