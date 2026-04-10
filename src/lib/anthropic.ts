import Anthropic from '@anthropic-ai/sdk'

// Singleton client — imported by API routes only (server-side)
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})
