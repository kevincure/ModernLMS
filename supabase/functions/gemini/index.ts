// Supabase Edge Function for Gemini API calls
// Supports native function calling, system instructions, and tool configuration.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MODEL = 'gemini-3.0-flash'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')

    if (!GEMINI_API_KEY) {
      console.error('[Gemini Function] GEMINI_API_KEY secret not configured')
      return new Response(
        JSON.stringify({ error: 'Gemini API key not configured on server' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { contents, generationConfig, system_instruction, tools, tool_config } = await req.json()

    if (!contents || !Array.isArray(contents)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request: contents array required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build request body — only include optional fields when provided
    const requestBody: Record<string, unknown> = {
      contents,
      generationConfig: generationConfig || {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      },
    }

    if (system_instruction) {
      requestBody.system_instruction = system_instruction
    }
    if (tools) {
      requestBody.tools = tools
    }
    if (tool_config) {
      requestBody.tool_config = tool_config
    }

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }
    )

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text()
      console.error('[Gemini Function] API error:', geminiResponse.status, errorText)
      return new Response(
        JSON.stringify({ error: `Gemini API error: ${geminiResponse.status}`, details: errorText }),
        { status: geminiResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const data = await geminiResponse.json()

    return new Response(
      JSON.stringify(data),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[Gemini Function] Error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
