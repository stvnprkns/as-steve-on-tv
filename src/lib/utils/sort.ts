export function compareByDisplayName(left: { displayName: string }, right: { displayName: string }) {
  return left.displayName.localeCompare(right.displayName);
}

export function compareByTitle(left: { title: string }, right: { title: string }) {
  return left.title.localeCompare(right.title);
}

