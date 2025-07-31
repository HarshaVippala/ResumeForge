import { GenerateContentStreamResult } from '@google/generative-ai';

/**
 * Convert Gemini stream to Response for Vercel
 */
export async function streamToResponse(
  stream: AsyncGenerator<any, any, unknown>
): Promise<Response> {
  const encoder = new TextEncoder();

  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const text = chunk.text();
          if (text) {
            controller.enqueue(encoder.encode(text));
          }
        }
      } catch (error) {
        controller.error(error);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readableStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}