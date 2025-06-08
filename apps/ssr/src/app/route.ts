import { getIndexHtml } from '../constants'

export const runtime = 'edge'
export const GET = async () => {
  const indexHtml = await getIndexHtml()
  return new Response(indexHtml, {
    headers: {
      'Content-Type': 'text/html',
      'X-SSR': '1',
    },
  })
}
