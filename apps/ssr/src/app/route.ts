import indexHtml from '../index.html'

export const runtime = 'edge'
export const GET = async () => {
  return new Response(indexHtml, {
    headers: {
      'Content-Type': 'text/html',
      'X-SSR': '1',
    },
  })
}
