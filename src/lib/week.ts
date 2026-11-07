export const inLastDays = (date: string, today: string, days: number) => date >= addDays(today, -days + 1) && date <= today
export const dueWithinDays = (date: string, today: string, days: number) => date >= today && date <= addDays(today, days - 1)

function addDays(date: string, days: number) {
  return new Date(Date.parse(date) + days * 864e5).toISOString().slice(0, 10)
}
