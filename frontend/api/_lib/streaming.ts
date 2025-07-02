import { Stream } from 'openai/streaming';
import { ChatCompletionChunk } from 'openai/resources';

/**
 * Convert OpenAI stream to Response for Vercel
 */
export async function streamToResponse(
  stream: Stream<ChatCompletionChunk>
): Promise<Response> {
  const encoder = new TextEncoder();

  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            controller.enqueue(encoder.encode(content));
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