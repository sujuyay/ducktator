// Shared display formatting for open gym pages.
export function formatDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00`)
  return parsed.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}
