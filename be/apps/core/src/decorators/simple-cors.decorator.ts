const SIMPLE_CORS_METADATA = Symbol.for('core.cors.simple')

type DecoratorTarget = object | Function

function setSimpleCorsMetadata(target: DecoratorTarget): void {
  Reflect.defineMetadata(SIMPLE_CORS_METADATA, true, target)
}

export function AllowSimpleCors(): ClassDecorator & MethodDecorator {
  return ((target: DecoratorTarget, _propertyKey?: string | symbol, descriptor?: PropertyDescriptor) => {
    if (descriptor?.value && typeof descriptor.value === 'function') {
      setSimpleCorsMetadata(descriptor.value)
      return descriptor
    }

    setSimpleCorsMetadata(target)
    return descriptor
  }) as unknown as ClassDecorator & MethodDecorator
}

export function shouldAllowSimpleCors(target: DecoratorTarget | undefined): boolean {
  if (!target) {
    return false
  }

  try {
    return (Reflect.getMetadata(SIMPLE_CORS_METADATA, target) ?? false) === true
  } catch {
    return false
  }
}
