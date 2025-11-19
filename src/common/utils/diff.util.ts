export function getSimpleChanges(
  original: any,
  updated: any,
  fields: string[]
): Record<string, { old: any; new: any }> {
  const changes: Record<string, { old: any; new: any }> = {};
  
  fields.forEach((field) => {
    if (updated[field] !== undefined && original[field] !== updated[field]) {
      changes[field] = { old: original[field], new: updated[field] };
    }
  });

  return changes;
}

export function getDateChange(
  originalDate: Date | null,
  updatedDate: Date | string | null,
  fieldName: string = 'dueDate'
): Record<string, { old: Date | null; new: Date | string | null }> {
  const oldIso = originalDate ? originalDate.toISOString() : null;
  const newIso = updatedDate ? new Date(updatedDate).toISOString() : null;

  if (oldIso !== newIso) {
    return { [fieldName]: { old: originalDate, new: updatedDate } };
  }
  return {};
}

export function getArrayChange(
  oldArray: any[],
  newArray: any[],
  fieldName: string
): Record<string, { old: any[]; new: any[] }> {
  const sortedOld = [...oldArray].sort();
  const sortedNew = [...newArray].sort();

  if (JSON.stringify(sortedOld) !== JSON.stringify(sortedNew)) {
    return { [fieldName]: { old: sortedOld, new: sortedNew } };
  }
  return {};
}
