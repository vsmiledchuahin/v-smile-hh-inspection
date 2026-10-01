'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabaseClient'
import { sectionTitle } from '@/lib/sections'
import Nav from '@/components/Nav'

type Submission = {
  id: string
  date: string
  period: string
  sections: Record<string, { items: any[] }>
  created_at: string
}

function formatDuration(ms: number | null) {
  if (ms == null || ms < 0) return '-'
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return mins + ' นาที'
  const hours = Math.floor(mins / 60)
  if (hours < 24) return hours + ' ชม.'
  const days = Math.floor(hours / 24)
  return days + ' วัน'
}

export default function TasksPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<Submission[]>([])
  const [staffList, setStaffList] = useState<string[]>([])
  const [who, setWho] = useState('')
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    load()
    supabase.from('staff').select('name').order('name').then(({ data }) => {
      if (data) setStaffList(data.map((d: any) => d.name))
    })
    const timer = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(timer)
  }, [])

  async function load() {
    const { data } = await supabase.from('submissions').select('*').order('created_at', { ascending: false }).limit(300)
    if (data) setRows(data as Submission[])
  }

  const allIssues = useMemo(() => {
    const list: { subId: string; sectionKey: string; idx: number; date: string; period: string; foundAt: number; item: any }[] = []
    rows.forEach((sub) => {
      Object.entries(sub.sections || {}).forEach(([key, secData]) => {
        ;(secData.items || []).forEach((it: any, idx: number) => {
          if (it.status === 'ไม่เรียบร้อย') {
            list.push({ subId: sub.id, sectionKey: key, idx, date: sub.date, period: sub.period, foundAt: new Date(sub.created_at).getTime(), item: it })
          }
        })
      })
    })
    return list
  }, [rows])

  const pending = allIssues
    .filter((i) => !i.item.resolved && (!who || i.item.fixer === who))
    .sort((a, b) => a.foundAt - b.foundAt)

  const resolved = allIssues
    .filter((i) => i.item.resolved)
    .sort((a, b) => (b.item.resolvedAt || 0) - (a.item.resolvedAt || 0))
    .slice(0, 20)

  async function markResolved(subId: string, sectionKey: string, idx: number) {
    if (!confirm('ยืนยันว่ารายการนี้แก้ไขเรียบร้อยแล้ว?')) return
    const sub = rows.find((s) => s.id === subId)
    if (!sub) return
    const items = sub.sections[sectionKey].items.slice()
    items[idx] = { ...items[idx], resolved: true, resolvedAt: Date.now() }
    const newSections = { ...sub.sections, [sectionKey]: { ...sub.sections[sectionKey], items } }
    const { error } = await supabase.from('submissions').update({ sections: newSections }).eq('id', subId)
    if (!error) load()
  }

  return (
    <div className="min-h-screen bg-[#f6f3f2] pb-16">
      <header className="bg-gradient-to-br from-[#a5293c] to-[#7f1f2f] text-white px-4 pt-4 pb-1">
        <h1 className="text-lg font-bold">✅ งานที่ต้องแก้ไข</h1>
        <p className="text-xs opacity-90 mb-2">คลินิกทันตกรรมวีสไมล์ สาขาหัวหิน</p>
        <Nav />
      </header>

      <main className="max-w-2xl mx-auto p-4">
        <div className="bg-white border border-[#e7dedc] rounded-2xl p-4 mb-4">
          <h2 className="text-[#a5293c] font-semibold text-sm mb-1">งานที่ต้องแก้ไข</h2>
          <p className="text-xs text-gray-500 mb-3">ไม่กระทบคะแนนที่บันทึกไว้แล้ว — ใช้ติดตามงานเท่านั้น</p>
          <select value={who} onChange={(e) => setWho(e.target.value)} className="mb-3 bg-white text-gray-900 border border-[#e7dedc] rounded-lg px-3 py-1.5 text-xs">
            <option value="" className="bg-white text-gray-900">ดูงานของ: ทุกคน</option>
            {staffList.map((n) => <option key={n} value={n} className="bg-white text-gray-900">{n}</option>)}
          </select>

          {pending.length === 0 ? (
            <p className="text-center text-sm text-gray-500 py-6">ไม่มีงานค้าง ทุกอย่างเรียบร้อย 🎉</p>
          ) : (
            <div className="overflow-x-auto w-full 
                    [&::-webkit-scrollbar]:h-2 
                    [&::-webkit-scrollbar-track]:bg-gray-100 
                    [&::-webkit-scrollbar-track]:rounded-full
                    [&::-webkit-scrollbar-thumb]:bg-gray-300 
                    [&::-webkit-scrollbar-thumb]:rounded-full
                    hover:[&::-webkit-scrollbar-thumb]:bg-gray-400">
              <table className="w-full text-[10px] min-w-[500px]">
                <thead><tr className="text-gray-700 font-semibold text-left border-b border-[#e7dedc]">
                  <th className="py-2 px-1 whitespace-nowrap">วันที่</th>
                  <th className="px-1 whitespace-nowrap">ช่วง</th>
                  <th className="px-1 whitespace-nowrap">โซน</th>
                  <th className="px-1 min-w-[150px]">รายการ</th>
                  <th className="px-1 whitespace-nowrap">ผู้แก้ไข</th>
                  <th className="px-1 whitespace-nowrap">รอมาแล้ว</th>
                  <th className="px-1 text-right whitespace-nowrap"></th>
                </tr></thead>
                <tbody>
                  {pending.map((i, idx) => {
                    const elapsed = now - i.foundAt
                    return (
                      <tr key={idx} className="border-t border-[#e7dedc]">
                        <td className="py-2 px-1 !text-gray-900 font-medium whitespace-nowrap">{i.date}</td>
                        <td className="px-1 !text-gray-900 font-medium whitespace-nowrap">{i.period}</td>
                        <td className="px-1 !text-gray-900 font-medium whitespace-nowrap">{sectionTitle(i.sectionKey)}</td>
                        <td className="px-1 !text-gray-900 font-medium whitespace-normal leading-tight break-all">{i.item.note || i.item.label || 'ไม่ระบุ'}</td>
                        <td className="px-1 !text-gray-900 font-medium whitespace-nowrap">{i.item.fixer || '-'}</td>
                        <td className={elapsed > 24 * 3600 * 1000 ? 'text-red-600 font-bold text-right' : 'text-gray-900 font-medium'}>{formatDuration(elapsed)}</td>
                        <td><button onClick={() => markResolved(i.subId, i.sectionKey, i.idx)} className="rounded border border-amber-300 bg-amber-50 px-1 py-0.5 text-[10px] font-medium text-amber-800 hover:bg-amber-100 transition-colors shadow-sm leading-none">แก้ไขแล้ว</button></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white border border-[#e7dedc] rounded-2xl p-4">
          <h2 className="text-[#a5293c] font-semibold text-sm mb-3">ประวัติที่แก้ไขล่าสุด</h2>
          {resolved.length === 0 ? (
            <p className="text-center text-sm text-gray-500 py-4">ยังไม่มีประวัติ</p>
          ) : (
            <div className="overflow-x-auto w-full 
                    [&::-webkit-scrollbar]:h-2 
                    [&::-webkit-scrollbar-track]:bg-gray-100 
                    [&::-webkit-scrollbar-track]:rounded-full
                    [&::-webkit-scrollbar-thumb]:bg-gray-300 
                    [&::-webkit-scrollbar-thumb]:rounded-full
                    hover:[&::-webkit-scrollbar-thumb]:bg-gray-400">
            <table className="w-full text-[10px]">
              <thead><tr className="text-gray-700 font-semibold text-left"><th className="py-2 px-1 whitespace-nowrap">วันที่</th>
              <th className="px-1 whitespace-nowrap">ช่วง</th>
              <th className="py-2 px-1 whitespace-nowrap">โซน</th>
              <th className="px-1 min-w-[150px]">รายการ</th>
              <th className="py-2 px-1 whitespace-nowrap">ผู้แก้ไข</th>
              <th className="py-2 px-1 whitespace-nowrap">แก้ไขเมื่อ</th>
              </tr></thead>
              <tbody>
                {resolved.map((i, idx) => (
                  <tr key={idx} className="border-t border-[#e7dedc]">
                    <td className="py-2 px-1 !text-gray-900 font-medium whitespace-nowrap">{i.date}</td>
                    <td className="px-1 !text-gray-900 font-medium whitespace-nowrap">{i.period}</td>
                    <td className="px-1 !text-gray-900 font-medium whitespace-nowrap">{sectionTitle(i.sectionKey)}</td>
                    <td className="px-1 !text-gray-900 font-medium whitespace-normal leading-tight break-all">{i.item.note}</td>
                    <td className="px-1 !text-gray-900 font-medium whitespace-nowrap">{i.item.fixer || '-'}</td>
                    <td className="py-2 px-1 !text-gray-900 font-medium whitespace-nowrap">{i.item.resolvedAt ? new Date(i.item.resolvedAt).toLocaleString('th-TH') : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}