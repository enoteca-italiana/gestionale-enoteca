export const dischargeNoteChangedEvent = 'scarichi:dischargeNoteChanged';

export function notifyDischargeNoteChanged() {
  window.dispatchEvent(new CustomEvent(dischargeNoteChangedEvent));
}
