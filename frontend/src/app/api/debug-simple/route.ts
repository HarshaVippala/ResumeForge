export async function GET() {
  return new Response('SIMPLE TEST WORKS', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      'X-Debug': 'simple-test'
    }
  })
} 