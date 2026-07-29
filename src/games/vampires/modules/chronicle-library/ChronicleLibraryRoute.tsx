'use client'

import { Suspense } from 'react'
import ChronicleLibraryPage from './components/ChronicleLibraryPage'

function ChronicleLibraryLoading() {
  return (
    <main style={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      background: '#080506',
      color: '#f4eadf',
      fontFamily: '"Courier New", Courier, monospace',
    }}
    >
      <p>Загружаю хроники...</p>
    </main>
  )
}

export default function ChronicleLibraryRoute() {
  return (
    <Suspense fallback={<ChronicleLibraryLoading />}>
      <ChronicleLibraryPage />
    </Suspense>
  )
}
