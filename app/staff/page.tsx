'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabaseClient'
import Nav from '@/components/Nav'

export default function StaffPage() {
  const supabase = createClient()
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([])
  const [newName, setNewName] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('staff').select('id, name').order('name')
    if (data) setStaff(data)
  }

  async function addStaff() {
    const name = newName.trim()
    if (!name) return
    if (staff.some((s) => s.name === name)) { setMsg('มีชื่อนี้อยู่แล้ว'); return }
    const { error } = await supabase.from('staff').insert({ name })
    if (error) setMsg('เพิ่มไม่สำเร็จ')
    else { setNewName(''); setMsg(null); load() }
  }

  async function removeStaff(id: string) {
    if (!confirm('ยืนยันลบชื่อนี้?')) return
    const { error } = await supabase.from('staff').delete().eq('id', id)
    if (!error) load()
  }

  return (
    <div className="min-h-screen bg-[#f6f3f2] pb-16">
      <header className="bg-gradient-to-br from-[#a5293c] to-[#7f1f2f] text-white px-4 pt-4 pb-1">
        <h1 className="text-lg font-bold">👥 รายชื่อพนักงาน</h1>
        <p className="text-xs opacity-90 mb-2">คลินิกทันตกรรมวีสไมล์ สาขาหัวหิน</p>
        <Nav />
      </header>

      <main className="max-w-2xl mx-auto p-4">
        <div className="bg-white border border-[#e7dedc] rounded-2xl p-4">
          <h2 className="text-[#a5293c] font-semibold text-sm mb-1">รายชื่อผู้ตรวจ / ผู้แก้ไข</h2>
          <p className="text-xs text-gray-500 mb-3">ใช้เลือกในฟอร์มตรวจ — เพิ่มหรือลบได้ทุกเมื่อ</p>

          <div className="flex flex-wrap gap-2 mb-4">
            {staff.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-2 bg-[#f6f3f2] text-gray-900 border border-[#e7dedc] rounded-full pl-3 pr-1 py-1 text-sm font-medium">
                {s.name}
                <button onClick={() => removeStaff(s.id)} className="text-red-600 px-1">✕</button>
              </span>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addStaff() }}
              placeholder="พิมพ์ชื่อใหม่..."
              className="flex-1 bg-white text-gray-900 placeholder-gray-400 border border-[#e7dedc] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#a5293c]"
            />
            <button onClick={addStaff} className="rounded-lg bg-[#a5293c] text-white px-4 text-sm font-medium hover:bg-[#8e2232] transition-colors">+ เพิ่ม</button>
          </div>
          {msg && <p className="text-xs text-red-600 mt-2">{msg}</p>}
        </div>
      </main>
    </div>
  )
}