import { decodeGatewayState } from '@afilmory/be-utils'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'

import { gatewayConfig } from './config'
import { buildForwardLocation, resolveTargetHost, sanitizeTenantSlug } from './resolver'

const app = new Hono()

app.get('/healthz', (c) =>
  c.json({
    status: 'ok',
    service: 'oauth-gateway',
    timestamp: new Date().toISOString(),
  }),
)

const callbackRouter = new Hono()

callbackRouter.all('/:provider', (c) => {
  const provider = c.req.param('provider')
  const requestUrl = new URL(c.req.url)
  const stateParam = requestUrl.searchParams.get('state')
  const codeParam = requestUrl.searchParams.get('code')
  const errorParam = requestUrl.searchParams.get('error')

  console.info('[oauth-gateway:callback] Request received', {
    provider,
    method: c.req.method,
    path: c.req.path,
    hasState: !!stateParam,
    hasCode: !!codeParam,
    hasError: !!errorParam,
    queryParams: Object.fromEntries(requestUrl.searchParams),
  })

  if (!provider) {
    console.warn('[oauth-gateway:callback] Missing provider param', {
      path: c.req.path,
      queryParams: Object.fromEntries(requestUrl.searchParams),
    })
    return c.json({ error: 'missing_provider', message: 'Provider param is required.' }, 400)
  }

  const decodedState =
    gatewayConfig.stateSecret && stateParam
      ? decodeGatewayState(stateParam, { secret: gatewayConfig.stateSecret })
      : null

  console.info('[oauth-gateway:callback] State decoding result', {
    provider,
    hasStateParam: !!stateParam,
    hasStateSecret: !!gatewayConfig.stateSecret,
    decodedSuccessfully: !!decodedState,
    decodedTenantSlug: decodedState?.tenantSlug ?? null,
    hasInnerState: !!decodedState?.innerState,
  })

  if (stateParam && gatewayConfig.stateSecret && !decodedState) {
    console.error('[oauth-gateway:callback] Invalid or expired state', {
      provider,
      stateLength: stateParam.length,
      statePrefix: `${stateParam.slice(0, 20)}...`,
    })
    return c.json({ error: 'invalid_state', message: 'OAuth state is invalid or expired.' }, 400)
  }

  if (decodedState?.innerState) {
    requestUrl.searchParams.set('state', decodedState.innerState)
    console.info('[oauth-gateway:callback] Replaced state with innerState', {
      provider,
      innerStateLength: decodedState.innerState.length,
    })
  }

  const tenantSlug = sanitizeTenantSlug(decodedState?.tenantSlug ?? undefined) ?? decodedState?.tenantSlug ?? null

  console.info('[oauth-gateway:callback] Tenant resolution', {
    provider,
    rawTenantSlug: decodedState?.tenantSlug ?? null,
    sanitizedTenantSlug: tenantSlug,
  })

  const targetHost = resolveTargetHost(gatewayConfig, {
    tenantSlug,
  })

  console.info('[oauth-gateway:callback] Target host resolution', {
    provider,
    tenantSlug,
    targetHost,
    baseDomain: gatewayConfig.baseDomain,
    rootSlug: gatewayConfig.rootSlug,
  })

  if (!targetHost) {
    console.error('[oauth-gateway:callback] Unable to resolve target host', {
      provider,
      tenantSlug,
      baseDomain: gatewayConfig.baseDomain,
    })
    return c.json({ error: 'unresolvable_host', message: 'Unable to resolve target tenant host.' }, 400)
  }

  const location = buildForwardLocation({
    config: gatewayConfig,
    provider,
    host: targetHost,
    query: requestUrl.searchParams,
  })

  console.info('[oauth-gateway:callback] Redirecting', {
    provider,
    tenantSlug,
    targetHost,
    location,
    queryParams: Object.fromEntries(requestUrl.searchParams),
  })

  return c.redirect(location, 302)
})

app.route(gatewayConfig.callbackBasePath, callbackRouter)

app.notFound((c) =>
  c.json(
    {
      error: 'not_found',
      path: c.req.path,
    },
    404,
  ),
)

app.onError((err, c) => {
  console.error('[oauth-gateway] Unhandled error', err)
  return c.json({ error: 'internal_error', message: 'OAuth gateway encountered an unexpected error.' }, 500)
})

serve(
  {
    fetch: app.fetch,
    hostname: gatewayConfig.host,
    port: gatewayConfig.port,
  },
  (info) => {
    console.info(
      `[oauth-gateway] listening on http://${info.address}:${info.port} | forwarding to base domain ${gatewayConfig.baseDomain}`,
    )
  },
)
