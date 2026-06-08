import 'dotenv/config'

import { deleteFromR2, getFromR2, listR2, presignPutUrl, publicUrl, uploadToR2 } from '../apps/ssr/src/lib/r2'

async function main() {
  const key = 'photos/_verify/roundtrip.txt'
  const body = `verify-${Date.now()}`

  console.log('1. uploadToR2…')
  const url = await uploadToR2(key, Buffer.from(body), 'text/plain', { immutable: false })
  console.log('   public url:', url)

  console.log('2. getFromR2…')
  const got = await getFromR2(key)
  if (got?.toString() !== body) throw new Error(`getFromR2 mismatch: got ${got?.toString()}`)
  console.log('   ok, content matches')

  console.log('3. public fetch…')
  const pub = await fetch(publicUrl(key))
  console.log('   public GET status:', pub.status)

  console.log('4. presignPutUrl + PUT…')
  const pkey = 'photos/_verify/presigned.txt'
  const put = await fetch(await presignPutUrl(pkey), { method: 'PUT', body: 'presigned-ok' })
  console.log('   presigned PUT status:', put.status)
  const back = await getFromR2(pkey)
  if (back?.toString() !== 'presigned-ok') throw new Error('presigned PUT did not persist')
  console.log('   ok, presigned upload persisted')

  console.log('5. listR2(photos/_verify/)…')
  const list = await listR2('photos/_verify/')
  console.log(
    '   found:',
    list.map((o) => o.pathname),
  )

  console.log('6. cleanup…')
  await deleteFromR2(key)
  await deleteFromR2(pkey)
  const goneA = await getFromR2(key)
  const goneB = await getFromR2(pkey)
  if (goneA || goneB) throw new Error('cleanup failed')
  console.log('   ok, deleted')

  console.log('\nALL R2 CHECKS PASSED ✅')
}

main().catch((e) => {
  console.error('R2 VERIFY FAILED ❌', e)
  process.exit(1)
})
