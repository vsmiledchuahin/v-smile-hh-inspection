import { NextResponse } from 'next/server'

// ฟังก์ชันสำหรับกำหนดสีเปอร์เซ็นต์ (100% = เขียว, น้อยกว่า 100% = แดง)
function getScoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return '#4b5563' // สีเทาสำหรับยังไม่ตรวจ
  return score === 100 ? '#15803d' : '#dc2626'
}

export async function POST(req: Request) {
  try {
    const { date, morningScore, eveningScore, pendingIssues } = await req.json()

    // 1. จัดรูปแบบรายการค้างแก้ไข (ใช้ item.note แทน item.label)
    let issueContents: any[] = []
    if (pendingIssues && pendingIssues.length > 0) {
      issueContents = pendingIssues.map((item: any) => {
        // ใช้สิ่งที่ต้องแก้ไข (note) ถ้าไม่มีให้ใช้ชื่อรายการ (label) แทน
        const noteText = item.note && item.note.trim() !== '' ? item.note : item.label

        return {
        type: 'box',
        layout: 'vertical',
        margin: 'sm',
        contents: [
          {
            type: 'text',
            text: `• ${noteText}`,
            size: 'xs',
            color: '#dc2626',
            wrap: true
          },
          {
            type: 'text',
            text: `   └ 👤 รอแก้ไขโดย: ${item.fixer || 'ยังไม่ระบุ'}`,
            size: 'xs',
            color: '#2563eb',
            wrap: true
          }
        ]
      }
      })
    } else {
      issueContents = [{
        type: 'text',
        text: '✨ ไม่มีรายการค้างแก้ไข เรียบร้อยดีมาก!',
        size: 'xs',
        color: '#15803d',
        margin: 'sm'
      }]
    }

    // 2. สร้างโครงสร้าง Flex Message
    const flexPayload = {
      to: process.env.LINE_TARGET_ID,
      messages: [
        {
          type: 'flex',
          altText: `สรุปการตรวจความเรียบร้อย ประจำวันที่ ${date}`,
          contents: {
            type: 'bubble',
            header: {
              type: 'box',
              layout: 'vertical',
              backgroundColor: '#a5293c',
              contents: [
                { type: 'text', text: '🏥 สรุปตรวจความเรียบร้อย', color: '#FFFFFF', weight: 'bold', size: 'md' },
                { type: 'text', text: `V Smile สาขาหัวหิน — 🗓️ วันที่ ${date}`, color: '#FFFFFF', size: 'xs', margin: 'xs' }
              ]
            },
            body: {
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'box',
                  layout: 'horizontal',
                  contents: [
                    { type: 'text', text: '☀️ รอบเช้า:', size: 'xs', color: '#4b5563' },
                    {
                      type: 'text',
                      text: morningScore !== null && morningScore !== undefined ? `${morningScore}%` : 'ยังไม่ตรวจ',
                      size: 'xs',
                      weight: 'bold',
                      align: 'end',
                      color: getScoreColor(morningScore)
                    }
                  ]
                },
                {
                  type: 'box',
                  layout: 'horizontal',
                  margin: 'xs',
                  contents: [
                    { type: 'text', text: '🌙 รอบเย็น:', size: 'xs', color: '#4b5563' },
                    {
                      type: 'text',
                      text: eveningScore !== null && eveningScore !== undefined ? `${eveningScore}%` : 'ยังไม่ตรวจ',
                      size: 'xs',
                      weight: 'bold',
                      align: 'end',
                      color: getScoreColor(eveningScore)
                    }
                  ]
                },
                { type: 'separator', margin: 'md' },
                { type: 'text', text: '⚠️ รายการค้างแก้ไข ณ วันนี้:', weight: 'bold', size: 'xs', margin: 'md', color: '#1f2937' },
                ...issueContents
              ]
            },
            footer: {
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'button',
                  action: {
                    type: 'uri',
                    label: '🔍 ดูรายละเอียดบนเว็บ',
                    uri: 'https://red-smile-inspection.vercel.app/dashboard'
                  },
                  style: 'primary',
                  color: '#a5293c',
                  height: 'sm'
                }
              ]
            }
          }
        }
      ]
    }

    // 3. ยิงข้อความเข้า LINE API
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
      },
      body: JSON.stringify(flexPayload)
    })

    if (!response.ok) {
      throw new Error('LINE API Error')
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}