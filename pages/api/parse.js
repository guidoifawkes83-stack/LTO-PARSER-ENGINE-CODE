export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageBase64, mediaType } = req.body;

  if (!imageBase64 || !mediaType) {
    return res.status(400).json({ error: 'Missing imageBase64 or mediaType' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const prompt = `You are parsing a screenshot of an LTO (Land Transportation Office) Philippines Motor Vehicle File Registration System report.

Extract ALL rows of vehicle records visible in the image. For each row, extract:
1. engine_no - Engine Number (format like K6A-XXXXXXX or R06A-XXXXXXX)
2. make_type - Make/Type (e.g. "Suzuki/ Utility Vehicle")
3. series - Series (e.g. "W/ Det Roofrack Multicab", "W/ Roofrack", "W/ Ladder Rack", "W/ Det Canopy")
4. owner - Owner name (Last name, First name format)
5. address - Full address
6. plate_no - Plate Number (e.g. ZAG7662)
7. or_no - OR Number
8. cr_no - CR Number

Return ONLY a valid JSON array, no markdown, no explanation, no backticks. Example:
[
  {
    "engine_no": "K6A-7759880",
    "make_type": "Suzuki/ Utility Vehicle",
    "series": "W/ Det Roofrack Multicab",
    "owner": "Elum, Renaldo E.",
    "address": "LABOGON MANDAUE CITY CEBU REGION 7",
    "plate_no": "ZAG7662",
    "or_no": "152426000003505",
    "cr_no": "000000032152254"
  }
]

If a field is not visible or unclear, use empty string "". Extract every row you can see.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: imageBase64 },
              },
              { type: 'text', text: prompt },
            ],
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Anthropic API error' });
    }

    const raw = data.content?.find((b) => b.type === 'text')?.text || '';
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return res.status(200).json({ records: parsed });
  } catch (err) {
    console.error('Parse error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
