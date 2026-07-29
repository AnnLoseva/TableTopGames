'use client'

import { Suspense } from 'react'
import ReferencePage from './components/ReferencePage'

function ReferenceLoading() {
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
      <p>Загружаю справочник...</p>
    </main>
  )
}

export default function ReferenceRoute() {
  return (
    <Suspense fallback={<ReferenceLoading />}>
      <ReferencePage />
    </Suspense>
  )
}