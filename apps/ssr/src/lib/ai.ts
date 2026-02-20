const OPENAI_API_KEY = process.env.OPENAI_API_KEY

export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<{ city: string | null; country: string | null; locationName: string | null }> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&zoom=10&addressdetails=1`,
      { headers: { 'User-Agent': 'afilmory/1.0' } },
    )
    if (!res.ok) return { city: null, country: null, locationName: null }
    const data = await res.json()
    const city =
      data.address?.city ||
      data.address?.town ||
      data.address?.village ||
      data.address?.municipality ||
      data.address?.county ||
      null
    const country = data.address?.country || null
    const state = data.address?.state || null
    const parts = [city, state, country].filter(Boolean)
    const locationName = parts.length > 0 ? parts.join(', ') : null
    return { city: city ? String(city).trim().toLowerCase() : null, country, locationName }
  } catch {
    return { city: null, country: null, locationName: null }
  }
}

export async function generatePhotoAI(imageBase64: string): Promise<{ title: string; tags: string[] } | null> {
  if (!OPENAI_API_KEY) return null

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze this photo and respond with ONLY a JSON object (no markdown, no code blocks) with two fields:\n1. "title": A compelling title in 3 words or less\n2. "tags": An array of 2-4 specific keywords describing the image. Avoid generic terms like "nature", "travel", "photography", "sky". Use terms highly specific to the image content.',
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/webp;base64,${imageBase64}`,
                  detail: 'low',
                },
              },
            ],
          },
        ],
        max_tokens: 150,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      console.error('OpenAI API error:', response.status)
      return null
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content?.trim()
    if (!content) return null

    // Parse JSON response, handling potential markdown wrapping
    const jsonStr = content
      .replace(/^```json?\n?/, '')
      .replace(/\n?```$/, '')
      .trim()
    const parsed = JSON.parse(jsonStr)

    return {
      title: typeof parsed.title === 'string' ? parsed.title.replace(/['"]/g, '').trim() : '',
      tags: Array.isArray(parsed.tags)
        ? parsed.tags.map((t: any) => String(t).trim().toLowerCase()).filter(Boolean)
        : [],
    }
  } catch (error) {
    console.error('AI generation failed:', error)
    return null
  }
}
