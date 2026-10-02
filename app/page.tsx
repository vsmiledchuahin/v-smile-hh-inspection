'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabaseClient'
import { SECTIONS } from '@/lib/sections'
import Nav from '@/components/Nav'

const CLINIC_NAME = 'คลินิกทันตกรรมวีสไมล์ สาขาหัวหิน'

type ItemState = { status: '' | 'เรียบร้อย' | 'ไม่เรียบร้อย'; note: string; fixer: string }

function emptyItems(count: number): ItemState[] {
  return Array.from({ length: count }, () => ({ status: '', note: '', fixer: '' }))
}

function freshSectionState() {
  return Object.fromEntries(
    SECTIONS.map((s) => [s.key, { doctor: '', caretaker: '', items: emptyItems(s.items.length) }])
  )
}

export default function FormPage() {
  const supabase = createClient()

  const [staffList, setStaffList] = useState<string[]>([])
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [period, setPeriod] = useState<'เช้า' | 'เย็น'>('เช้า')
  const [inspector, setInspector] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [sectionState, setSectionState] = useState(freshSectionState)

  useEffect(() => {
      //setSectionState(freshSectionState())
    supabase
      .from('staff')
      .select('name')
      .order('name')
      .then(({ data }) => {
        if (data) setStaffList(data.map((d: { name: string }) => d.name))
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function updateItem(sectionKey: string, idx: number, patch: Partial<ItemState>) {
    setSectionState((prev: any) => {
      const items = prev[sectionKey].items.slice()
      items[idx] = { ...items[idx], ...patch }
      return { ...prev, [sectionKey]: { ...prev[sectionKey], items } }
    })
  }

  function updateSectionField(sectionKey: string, field: 'doctor' | 'caretaker', value: string) {
    setSectionState((prev: any) => ({ ...prev, [sectionKey]: { ...prev[sectionKey], [field]: value } }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setMessage(null)

    if (!inspector) {
      setMessage('กรุณาเลือกชื่อผู้ตรวจ')
      return
    }

    let evaluatedItems = 0 // จำนวนรายการที่มีการตรวจจริง
    let okItems = 0
    let totalItems = 0
    const sectionsPayload: Record<string, any> = {}

    SECTIONS.forEach((s) => {
      const state = (sectionState as any)[s.key]
      const items = state.items.map((it: ItemState, idx: number) => {
        const itemDef = s.items[idx]
        const applicable = !itemDef.periods || itemDef.periods.includes(period)
        if (!applicable) {
          return { label: itemDef.text, status: 'ไม่เกี่ยวข้อง', note: '', fixer: '', resolved: null, resolvedAt: null }
        }
        totalItems++
        
        // นับเฉพาะรายการที่มีการกดเลือกสถานะจริง (เรียบร้อย หรือ ไม่เรียบร้อย)
        if (it.status) {
          evaluatedItems++
          if (it.status === 'เรียบร้อย') okItems++
        }

        return {
          label: itemDef.text,
          //label: s.items[idx],
          status: it.status,
          note: it.note,
          fixer: it.fixer,
          resolved: it.status === 'ไม่เรียบร้อย' ? false : null,
          resolvedAt: null,
        }
      })
      sectionsPayload[s.key] = { doctor: state.doctor || null, caretaker: state.caretaker || null, items }
    })

    // คำนวณ % จากเฉพาะรายการที่มีการกดตรวจจริง (หากไม่ได้ตรวจเลยสักข้อจะให้เป็น 100%)
    const score = evaluatedItems > 0 ? Math.round((okItems / evaluatedItems) * 100) : 100

    setSaving(true)
    const { error } = await supabase.from('submissions').insert({
      date,
      period,
      inspector,
      sections: sectionsPayload,
      total_items: totalItems,
      ok_items: okItems,
      score,
    })
    setSaving(false)

    if (error) {
      setMessage('บันทึกไม่สำเร็จ: ' + error.message)
      return
    }

    setMessage('บันทึกผลตรวจเรียบร้อย ✓')
    setSectionState(freshSectionState())
    setInspector('')
  }

  return (
    <div className="min-h-screen bg-[#f6f3f2] pb-24">
      <header className="sticky top-0 z-10 bg-gradient-to-br from-[#a5293c] to-[#7f1f2f] text-white px-4 pt-4 pb-1">
        <h1 className="text-lg font-bold">🦷 ใบตรวจสอบความเรียบร้อย</h1>
        <p className="text-xs opacity-90 mb-2">{CLINIC_NAME}</p>
        <Nav />
      </header>

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto p-4 text-gray-900 [&_input]:bg-white [&_input]:text-gray-900 [&_select]:bg-white [&_select]:text-gray-900">
        <div className="bg-white border border-[#e7dedc] rounded-2xl p-4 mb-4">
          <h2 className="text-[#a5293c] font-semibold text-sm mb-3">ข้อมูลทั่วไป</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">วันที่ตรวจ</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full max-w-full box-border bg-white text-gray-900 !text-gray-900 !bg-white border border-[#e7dedc] rounded-xl px-3 py-2.5 text-sm appearance-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">ช่วงเวลา</label>
              <div className="flex gap-2">
                {(['เช้า', 'เย็น'] as const).map((p) => (
                  <button
                    type="button"
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`flex-1 rounded-lg border px-2 py-2 text-sm ${
                      period === p ? 'bg-[#a5293c] text-white border-[#a5293c]' : 'border-[#e7dedc]'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">ชื่อผู้ตรวจ</label>
            <select
              value={inspector}
              onChange={(e) => setInspector(e.target.value)}
              className="w-full border border-[#e7dedc] rounded-lg px-3 py-2 text-sm"
            >
              <option value="">เลือกชื่อ</option>
              {staffList.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {SECTIONS.map((s) => (
          <div key={s.key} className="bg-white border border-[#e7dedc] rounded-2xl p-4 mb-4">
            <h2 className="text-[#a5293c] font-semibold text-sm mb-3">{s.title}</h2>

            {s.doctor && (
              <div className="mb-3">
                <label className="block text-xs text-gray-500 mb-1">แพทย์ประจำวัน</label>
                <input
                  type="text"
                  value={(sectionState as any)[s.key].doctor}
                  onChange={(e) => updateSectionField(s.key, 'doctor', e.target.value)}
                  className="w-full border border-[#e7dedc] rounded-lg px-3 py-2 text-sm"
                />
              </div>
            )}
            {s.caretaker && (
              <div className="mb-3">
                <label className="block text-xs text-gray-500 mb-1">ผู้รับผิดชอบดูแลห้อง ({period})</label>
                <select
                  value={(sectionState as any)[s.key].caretaker}
                  onChange={(e) => updateSectionField(s.key, 'caretaker', e.target.value)}
                  className="w-full border border-[#e7dedc] bg-white text-gray-900 rounded-lg px-3 py-2 text-[10px]"
                >
                  <option value="">เลือกผู้รับผิดชอบ</option>
                  {staffList.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {(() => {
              let displayIndex = 0
              return s.items.map((item, idx) => {
              const applicable = !item.periods || item.periods.includes(period)
              if (!applicable) return null
              displayIndex++
              const stateItem = (sectionState as any)[s.key].items[idx] as ItemState
              return (
                <div key={idx} className="border border-[#e7dedc] rounded-xl p-3 mb-2 bg-[#f6f3f2]">
                  <p className="text-xs mb-2">
                    {displayIndex}. {item.text}
                  </p>
                  <div className="flex gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => updateItem(s.key, idx, { status: 'เรียบร้อย' })}
                      className={`flex-1 rounded-lg border py-2 text-xs font-semibold ${
                        stateItem.status === 'เรียบร้อย'
                          ? 'bg-green-50 border-green-600 text-green-700'
                          : 'bg-white border-[#e7dedc]'
                      }`}
                    >
                      ✓ เรียบร้อย
                    </button>
                    <button
                      type="button"
                      onClick={() => updateItem(s.key, idx, { status: 'ไม่เรียบร้อย' })}
                      className={`flex-1 rounded-lg border py-2 text-xs font-semibold ${
                        stateItem.status === 'ไม่เรียบร้อย'
                          ? 'bg-red-50 border-red-600 text-red-700'
                          : 'bg-white border-[#e7dedc]'
                      }`}
                    >
                      ✕ ไม่เรียบร้อย
                    </button>
                  </div>
                  {stateItem.status === 'ไม่เรียบร้อย' && (
                    <div className="grid gap-2">
                      <textarea
                        placeholder="หมายเหตุ / สิ่งที่ขาด / ปัญหาที่พบ"
                        value={stateItem.note}
                        onChange={(e) => updateItem(s.key, idx, { note: e.target.value })}
                        className="border border-[#e7dedc] rounded-lg px-3 py-2 text-xs"
                      />
                      <select
                        value={stateItem.fixer}
                        onChange={(e) => updateItem(s.key, idx, { fixer: e.target.value })}
                        className="border border-[#e7dedc] rounded-lg px-3 py-2 text-xs"
                      >
                        <option value="">เลือกผู้แก้ไข</option>
                        {staffList.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )
            })
          })()}
          </div>
          
        ))}

        {message && <p className="text-center text-sm mb-3">{message}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-[#a5293c] text-white rounded-xl py-3 font-bold disabled:opacity-50"
        >
          {saving ? 'กำลังบันทึก...' : 'บันทึกผลตรวจ'}
        </button>
      </form>
    </div>
  )
}