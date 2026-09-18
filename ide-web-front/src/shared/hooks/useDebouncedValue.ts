import { useEffect, useState } from 'react'

export function useDebouncedValue<TValue>(value: TValue, delayMs = 400): TValue {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timeoutId = setTimeout(() => { setDebouncedValue(value) }, delayMs)
    return () => { clearTimeout(timeoutId) }
  }, [value, delayMs])

  return debouncedValue
}
