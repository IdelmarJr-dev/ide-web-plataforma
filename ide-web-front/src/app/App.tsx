import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '~features/auth/context/AuthProvider'
import { BotaoTema } from '~components/Tema/BotaoTema'
import { TemaProvider } from '~components/Tema/TemaProvider'
import { queryClient } from './queryClient'
import { AppRoutes } from './routes'

export const App = (): ReactNode => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <TemaProvider>
            <BotaoTema />
            <AppRoutes />
          </TemaProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
