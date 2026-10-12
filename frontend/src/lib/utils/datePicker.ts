// Opens a native date input's calendar as soon as the field is clicked or focused, instead of
// only from its small calendar icon. showPicker() needs a user gesture and isn't in every
// browser; where it can't run, the field simply keeps its normal behaviour.

export function openDatePicker(event: { currentTarget: HTMLInputElement }) {
  const input = event.currentTarget;
  if (input.disabled || input.readOnly || typeof input.showPicker !== "function") return;
  try {
    input.showPicker();
  } catch {
    // No user activation (e.g. programmatic focus) or the picker is already open.
  }
}
