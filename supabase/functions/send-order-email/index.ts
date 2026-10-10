// Sends the order confirmation email (and an optional "new order" alert to the
// shop owner) through Resend whenever a row is inserted into the orders table.
//
// It is triggered by a Supabase Database Webhook (Database -> Webhooks ->
// orders -> Insert). See SUPABASE_SETUP.md, "Order confirmation emails".
//
// Secrets it reads (Edge Functions -> Secrets):
//   RESEND_API_KEY   required  your Resend API key
//   WEBHOOK_SECRET   required  any long random string; the webhook sends it in
//                              the "x-webhook-secret" header
//   FROM_EMAIL       optional  default: orders@honeybun.online
//   REPLY_TO         optional  where customer replies go (e.g. your Gmail)
//   OWNER_EMAIL      optional  also email the shop owner about each new order
//   SITE_URL         optional  default: https://www.honeybun.online

const SITE_URL = (Deno.env.get('SITE_URL') || 'https://www.honeybun.online').replace(/\/$/, '')
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'orders@honeybun.online'
const REPLY_TO = Deno.env.get('REPLY_TO') || ''
const OWNER_EMAIL = Deno.env.get('OWNER_EMAIL') || ''

const BROWN = '#4A3A2E'
const HONEY = '#E0972C'
const CREAM = '#FFF9F4'
const MUTED = '#8D8D8D'

// Everything a customer typed ends up in the email, so it is always escaped.
const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const money = (n) => `$${Number(n || 0).toFixed(2)}`

export function renderCustomerEmail(order) {
  const items = Array.isArray(order.items) ? order.items : []
  const rows = items
    .map(
      (i) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #eee;color:${BROWN};font-size:15px;">
            ${esc(i.name)}${i.size ? ` <span style="color:${MUTED};">(${esc(i.size)})</span>` : ''}
            <span style="color:${MUTED};"> × ${esc(i.qty)}</span>
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #eee;color:${BROWN};font-size:15px;text-align:right;white-space:nowrap;">
            ${money(Number(i.price) * Number(i.qty))}
          </td>
        </tr>`
    )
    .join('')

  const discount =
    Number(order.discount_amount) > 0
      ? `<tr>
          <td style="padding:10px 0;color:${BROWN};font-size:15px;">Discount${order.discount_code ? ` (${esc(order.discount_code)})` : ''}</td>
          <td style="padding:10px 0;color:${BROWN};font-size:15px;text-align:right;">−${money(order.discount_amount)}</td>
        </tr>`
      : ''

  const notes = order.notes
    ? `<p style="margin:16px 0 0;color:${BROWN};font-size:14px;"><strong>Your note:</strong> ${esc(order.notes)}</p>`
    : ''

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${CREAM};font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;">
          <tr><td align="center" style="background:${CREAM};padding:24px 24px 8px;">
            <img src="${SITE_URL}/email-logo.png" alt="Honeybun Kidswear" width="170" style="display:block;height:auto;border:0;">
          </td></tr>
          <tr><td style="padding:24px 28px 8px;">
            <h1 style="margin:0;color:${BROWN};font-size:24px;">Thank you, ${esc(order.customer_name)}!</h1>
            <p style="margin:10px 0 0;color:${BROWN};font-size:15px;line-height:1.5;">
              We've received your order <strong>#${esc(order.order_number)}</strong>. We'll contact you on
              <strong>${esc(order.phone)}</strong> to confirm delivery. You pay in cash when it arrives.
            </p>
          </td></tr>
          <tr><td style="padding:12px 28px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${rows}
              ${discount}
              <tr>
                <td style="padding:14px 0 0;color:${BROWN};font-size:17px;font-weight:bold;">Total (cash on delivery)</td>
                <td style="padding:14px 0 0;color:${HONEY};font-size:17px;font-weight:bold;text-align:right;">${money(order.total)}</td>
              </tr>
            </table>
          </td></tr>
          <tr><td style="padding:20px 28px 8px;">
            <p style="margin:0;color:${MUTED};font-size:12px;letter-spacing:1px;text-transform:uppercase;">Delivering to</p>
            <p style="margin:6px 0 0;color:${BROWN};font-size:15px;line-height:1.5;white-space:pre-line;">${esc(order.address)}, ${esc(order.city)}</p>
            ${notes}
          </td></tr>
          <tr><td style="padding:20px 28px 28px;">
            <p style="margin:0;color:${BROWN};font-size:14px;line-height:1.5;">
              Questions? Just reply to this email or message us on WhatsApp.
            </p>
            <p style="margin:14px 0 0;color:${BROWN};font-size:14px;">Sweet outfits for your little honey,<br><strong>Honeybun Kidswear</strong></p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`

  const text = [
    `Thank you, ${order.customer_name}!`,
    `We've received your order #${order.order_number}. We'll contact you on ${order.phone} to confirm delivery. You pay in cash when it arrives.`,
    '',
    ...items.map((i) => `- ${i.name}${i.size ? ` (${i.size})` : ''} x ${i.qty}: ${money(Number(i.price) * Number(i.qty))}`),
    Number(order.discount_amount) > 0 ? `Discount: -${money(order.discount_amount)}` : '',
    `Total (cash on delivery): ${money(order.total)}`,
    '',
    `Delivering to: ${order.address}, ${order.city}`,
    '',
    'Honeybun Kidswear',
  ]
    .filter((line, i, all) => line !== '' || all[i - 1] !== '')
    .join('\n')

  return { subject: `Your Honeybun order #${order.order_number}`, html, text }
}

export function renderOwnerEmail(order) {
  const items = Array.isArray(order.items) ? order.items : []
  const lines = items.map((i) => `${i.name}${i.size ? ` (${i.size})` : ''} x ${i.qty} — ${money(Number(i.price) * Number(i.qty))}`)
  const text = [
    `New order #${order.order_number} — ${money(order.total)} (cash on delivery)`,
    '',
    ...lines,
    '',
    `${order.customer_name} · ${order.phone} · ${order.email}`,
    `${order.address}, ${order.city}`,
    order.notes ? `Note: ${order.notes}` : '',
    '',
    `Manage it: ${SITE_URL}/admin/orders`,
  ]
    .filter((line, i, all) => line !== '' || all[i - 1] !== '')
    .join('\n')
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:${BROWN};font-size:15px;line-height:1.5;">${esc(text).replace(/\n/g, '<br>')}</div>`
  return { subject: `New order #${order.order_number} — ${money(order.total)}`, html, text }
}

async function sendEmail(apiKey, { to, subject, html, text, replyTo }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `Honeybun Kidswear <${FROM_EMAIL}>`,
      to: [to],
      subject,
      html,
      text,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  })
  if (!response.ok) {
    throw new Error(`Resend ${response.status}: ${await response.text()}`)
  }
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const secret = Deno.env.get('WEBHOOK_SECRET')
  if (!secret || request.headers.get('x-webhook-secret') !== secret) {
    return new Response('Unauthorized', { status: 401 })
  }

  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) return new Response('RESEND_API_KEY is not set', { status: 500 })

  let payload
  try {
    payload = await request.json()
  } catch {
    return new Response('Bad request', { status: 400 })
  }

  const order = payload?.record
  if (payload?.type !== 'INSERT' || payload?.table !== 'orders' || !order?.email) {
    return new Response('Ignored', { status: 200 })
  }

  const results = []

  try {
    await sendEmail(apiKey, { to: order.email, replyTo: REPLY_TO, ...renderCustomerEmail(order) })
    results.push('customer: sent')
  } catch (error) {
    console.error('Customer email failed:', error)
    results.push('customer: failed')
  }

  if (OWNER_EMAIL) {
    try {
      await sendEmail(apiKey, { to: OWNER_EMAIL, replyTo: order.email, ...renderOwnerEmail(order) })
      results.push('owner: sent')
    } catch (error) {
      console.error('Owner email failed:', error)
      results.push('owner: failed')
    }
  }

  // Always 200: the order itself is already saved; a failed email should be
  // read in the function logs, not retried forever by the webhook.
  return new Response(results.join(', '), { status: 200 })
})
