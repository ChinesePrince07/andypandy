let cachedIndexHtml: string | null = null
export const getIndexHtml = async () => {
  if (cachedIndexHtml) {
    return cachedIndexHtml
  }

  cachedIndexHtml = await fetch(new URL('../index.html', import.meta.url)).then(
    (res) => res.text(),
  )
  return cachedIndexHtml
}
