export function assigneeLabel(assignee) {
  return typeof assignee === 'string' && assignee.trim() ? assignee.trim() : 'Unassigned';
}
