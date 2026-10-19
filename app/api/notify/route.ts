import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { clinicName, period, inspector, score, okItems, totalItems, date } = body

    const webhookUrl = process.env.DISCORD_WEBHOOK_URL
    if (!webhookUrl) {
      return NextResponse.json({ error: 'Discord Webhook URL not configured' }, { status: 500 })
    }

    // กำหนดสีของการ์ด (คะแนน >= 80% สีเขียว / น้อยกว่า 80% สีแดง)
    const cardColor = score >= 80 ? 0x22c55e : 0xef4444

    // โครงสร้างการ์ด Embed สวยๆ บน Discord
    const embed = {
      title: `🦷 รายงานผลการตรวจความเรียบร้อย (${period})`,
      description: `**${clinicName}**`,
      color: cardColor,
      fields: [
        { name: '👤 ผู้ตรวจ', value: inspector || '-', inline: true },
        { name: '📅 วันที่', value: date || '-', inline: true },
        { name: '📊 คะแนนที่ได้', value: `**${score}%**`, inline: true },
        { name: '✅ รายการที่ผ่าน', value: `${okItems} / ${totalItems} ข้อ`, inline: true },
      ],
      timestamp: new Date().toISOString(),
      footer: { text: 'ระบบตรวจความเรียบร้อยประจำสาขา' },
    }

    // ยิงส่งเข้า Discord Webhook
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    })

    if (!res.ok) {
      throw new Error(`Discord API responded with status ${res.status}`)
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}