export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // удалить все кроме букв, цифр, пробелов и тире
    .replace(/[\s_-]+/g, '-') // заменить пробелы и подчёркивания на тире
    .replace(/^-+|-+$/g, ''); // удалить тире в начале и конце
}
