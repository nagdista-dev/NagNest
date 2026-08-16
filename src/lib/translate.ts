const API = 'https://api.mymemory.translated.net/get'

export async function translateToArabic(text: string): Promise<string> {
  const url = `${API}?q=${encodeURIComponent(text)}&langpair=en|ar`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`translate HTTP ${res.status}`)
  const json = (await res.json()) as {
    responseStatus?: number
    responseData?: { translatedText?: string }
  }
  if (json.responseStatus !== 200 || !json.responseData?.translatedText) {
    throw new Error('no translation available')
  }
  return json.responseData.translatedText
    .replace(/MYMEMORY WARNING[^\n]*\n?/g, '')
    .trim()
}

export function containsArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text)
}
