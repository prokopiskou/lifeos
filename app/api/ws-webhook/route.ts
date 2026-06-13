import { NextRequest, NextResponse } from 'next/server'

const MAILERLITE_API_KEY = process.env.MAILERLITE_API_KEY || ''
const MAILERLITE_GROUP_ID = process.env.MAILERLITE_GROUP_ID || '183641948771321117'
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ''
const TARGET_PRODUCT_ID = 9489

async function getVocative(firstName: string): Promise<string> {
  if (!firstName) return ''
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 20,
      messages: [{
        role: 'user',
        content: `Your only response is going to be a name in greek. billing name: ${firstName}. If the name is female, return its Greek version; if male, return a vocative form suitable after Dear. The response is only going to be a word in greek. If the given name is blank then dont return anything.`
      }]
    })
  })
  const data = await response.json()
  return data.content?.[0]?.text?.trim() ?? firstName
}

async function addToMailerLite(email: string, name: string) {
  const response = await fetch('https://connect.mailerlite.com/api/subscribers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MAILERLITE_API_KEY}`,
    },
    body: JSON.stringify({
      email,
      fields: { name },
      groups: [MAILERLITE_GROUP_ID],
    })
  })
  return response.status
}

export async function POST(req: NextRequest) {
  try {
    const text = await req.text()
    console.log('RAW BODY:', text.substring(0, 1000))

    let order: any
    try {
      order = JSON.parse(text)
    } catch {
      console.log('NOT JSON — raw text:', text.substring(0, 500))
      return NextResponse.json({ ok: true, ping: true })
    }

    console.log('ORDER ID:', order.id)
    console.log('LINE ITEMS:', JSON.stringify(order.line_items))

    const hasProduct = order.line_items?.some(
      (item: any) => item.product_id === TARGET_PRODUCT_ID
    )

    console.log('HAS PRODUCT 9489:', hasProduct)

    if (!hasProduct) {
      return NextResponse.json({ ok: true, skipped: true })
    }

    const email = order.billing?.email
    const firstName = order.billing?.first_name?.trim() ?? ''

    if (!email) {
      return NextResponse.json({ ok: false, error: 'no email' }, { status: 400 })
    }

    const vocative = await getVocative(firstName)
    const mlStatus = await addToMailerLite(email, vocative || firstName)

    console.log(`WS Webhook — Order: ${order.id} | Email: ${email} | Vocative: ${vocative} | ML: ${mlStatus}`)

    return NextResponse.json({ ok: true, email, vocative, mlStatus })

  } catch (err) {
    console.error('WS Webhook error:', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}