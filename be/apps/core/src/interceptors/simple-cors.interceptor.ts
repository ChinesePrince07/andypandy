import type { CallHandler, ExecutionContext, FrameworkResponse, Interceptor } from '@afilmory/framework'
import { shouldAllowSimpleCors } from 'core/decorators/simple-cors.decorator'
import { applySimpleCorsHeaders } from 'core/helpers/cors.helper'
import { injectable } from 'tsyringe'

@injectable()
export class SimpleCorsInterceptor implements Interceptor {
  async intercept(context: ExecutionContext, next: CallHandler): Promise<FrameworkResponse> {
    const handler = context.getHandler()
    const clazz = context.getClass()

    if (!shouldAllowSimpleCors(handler) && !shouldAllowSimpleCors(clazz)) {
      return await next.handle()
    }

    const response = await next.handle()
    return applySimpleCorsHeaders(response)
  }
}
