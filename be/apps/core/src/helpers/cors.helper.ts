export function applySimpleCorsHeaders(response: Response): Response {
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type')
  return response
}
