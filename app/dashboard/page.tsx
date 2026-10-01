'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabaseClient'
import { SECTIONS, sectionTitle } from '@/lib/sections'
import Nav from '@/components/Nav'
import SendLineButton from './SendLineButton'

type Submission = {
  id: string
  date: string
  period: string
  inspector: string
  sections: Record<string, { doctor: string | null; caretaker: string | null; items: any[] }>
  total_items: number
  ok_items: number
  score: number
  created_at: string
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}
function daysAgoStr(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

export default function DashboardPage() {
  const supabase = createClient()
  const [staffList, setStaffList] = useState<string[]>([])
  const [rows, setRows] = useState<Submission[]>([])
  const [rangeStart, setRangeStart] = useState(daysAgoStr(29))
  const [rangeEnd, setRangeEnd] = useState(todayStr())
  const [preset, setPreset] = useState('30')
  const [sectionFilter, setSectionFilter] = useState('')
  const [openFixer, setOpenFixer] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('staff').select('name').order('name').then(({ data }) => {
      if (data) setStaffList(data.map((d: any) => d.name))
    })
  }, [])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeStart, rangeEnd])

  async function load() {
    let q = supabase.from('submissions').select('*').order('created_at', { ascending: false })
    if (rangeStart && rangeEnd) q = q.gte('date', rangeStart).lte('date', rangeEnd)
    const { data } = await q
    if (data) setRows(data as Submission[])
  }

  function applyPreset(p: string) {
    setPreset(p)
    if (p === 'all') {
      setRangeStart('')
      setRangeEnd('')
    } else {
      setRangeStart(daysAgoStr(parseInt(p, 10) - 1))
      setRangeEnd(todayStr())
    }
  }

  const avgScore = rows.length ? Math.round(rows.reduce((s, d) => s + d.score, 0) / rows.length) : 0

  const issues = useMemo(() => {
    const list: { date: string; period: string; sectionKey: string; item: any; subId: string }[] = []
    rows.forEach((sub) => {
      Object.entries(sub.sections || {}).forEach(([key, secData]) => {
        ;(secData.items || []).forEach((it: any) => {
          if (it.status === 'ไม่เรียบร้อย') list.push({ date: sub.date, period: sub.period, sectionKey: key, item: it, subId: sub.id })
        })
      })
    })
    return list
  }, [rows])

  const fixerCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    staffList.forEach((n) => (counts[n] = 0))
    issues.forEach((i) => {
      if (i.item.fixer) counts[i.item.fixer] = (counts[i.item.fixer] || 0) + 1
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [issues, staffList])

  const fixerDetail = useMemo(() => {
    if (!openFixer) return []
    const grouped: Record<string, { count: number; lastDate: string }> = {}
    issues
      .filter((i) => i.item.fixer === openFixer)
      .forEach((i) => {
        const key = i.item.note || i.item.label || 'ไม่ระบุ'
        if (!grouped[key]) grouped[key] = { count: 0, lastDate: i.date }
        grouped[key].count++
        if (i.date > grouped[key].lastDate) grouped[key].lastDate = i.date
      })
    return Object.entries(grouped).sort((a, b) => b[1].count - a[1].count)
  }, [openFixer, issues])

  const filteredIssues = sectionFilter ? issues.filter((i) => i.sectionKey === sectionFilter) : issues

  async function deleteSubmission(id: string) {
    if (!confirm('ยืนยันลบข้อมูลการตรวจรอบนี้ทั้งรายการ?')) return
    const { error } = await supabase.from('submissions').delete().eq('id', id)
    if (error) setMsg('ลบไม่สำเร็จ')
    else load()
  }

  async function exportExcel() {
    const XLSX = await import('xlsx')
    const issueRows = filteredIssues.map((i) => ({
      วันที่: i.date,
      ช่วง: i.period,
      โซน: sectionTitle(i.sectionKey),
      รายการ: i.item.label,
      หมายเหตุ: i.item.note || '',
      ผู้แก้ไข: i.item.fixer || '',
      สถานะ: i.item.resolved ? 'แก้ไขแล้ว' : 'รอแก้ไข',
    }))
    if (!issueRows.length) {
      setMsg('ไม่มีรายการไม่เรียบร้อยในช่วงที่เลือก')
      return
    }
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(issueRows), 'รายการไม่เรียบร้อย')
    XLSX.writeFile(wb, `inspection-issues-${rangeStart || 'all'}_${rangeEnd || 'all'}.xlsx`)
  }

  return (
    <div className="min-h-screen bg-[#f6f3f2] pb-16">
      <header className="bg-gradient-to-br from-[#a5293c] to-[#7f1f2f] text-white px-4 pt-4 pb-1">
        <h1 className="text-lg font-bold">📊 แดชบอร์ดสรุปผล</h1>
        <p className="text-xs opacity-90 mb-2">คลินิกทันตกรรมวีสไมล์ สาขาหัวหิน</p>
        <Nav />
      </header>

      <main className="max-w-2xl mx-auto p-4 w-full box-border">
        <div className="bg-white border border-[#e7dedc] rounded-2xl p-4 mb-4 w-full box-border">
          <h2 className="text-[#a5293c] font-semibold text-sm mb-3">ช่วงเวลาที่แสดงผล</h2>
          <div className="flex flex-wrap gap-2 mb-3">
            {[['7', '7 วันล่าสุด'], ['30', 'รายเดือน (30 วัน)'], ['90', '3 เดือนล่าสุด'], ['all', 'ทั้งหมด']].map(([v, l]) => (
              <button
                key={v}
                onClick={() => applyPreset(v)}
                className={`rounded-lg border px-3 py-1.5 text-xs ${preset === v ? 'bg-[#a5293c] text-white border-[#a5293c]' : 'bg-white text-gray-900 border-[#e7dedc]'}`}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">ตั้งแต่วันที่</label>
              <input type="date" value={rangeStart} onChange={(e) => { setRangeStart(e.target.value); setPreset('custom') }} className="w-full max-w-full box-border bg-white text-gray-900 !text-gray-900 !bg-white border border-[#e7dedc] rounded-lg px-3 py-2 text-sm appearance-none" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">ถึงวันที่</label>
              <input type="date" value={rangeEnd} onChange={(e) => { setRangeEnd(e.target.value); setPreset('custom') }} className="w-full max-w-full box-border bg-white text-gray-900 !text-gray-900 !bg-white border border-[#e7dedc] rounded-lg px-3 py-2 text-sm appearance-none" />
            </div>
          </div>
          <button onClick={exportExcel} className="w-full mb-3 bg-white text-gray-900 !text-gray-900 !bg-white font-medium rounded-lg border border-[#e7dedc] py-2 text-sm hover:bg-gray-50 box-border">📥 ดาวน์โหลด Excel รายการไม่เรียบร้อย</button>
          <SendLineButton rows={rows} filteredIssues={filteredIssues} />
          {msg && <p className="text-xs text-center mt-2 text-red-600">{msg}</p>}
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-white border border-[#e7dedc] rounded-xl p-3 text-center">
            <div className="text-xl font-extrabold text-[#a5293c]">{rows.length}</div>
            <div className="text-[11px] text-gray-500">รอบตรวจในช่วงนี้</div>
          </div>
          <div className="bg-white border border-[#e7dedc] rounded-xl p-3 text-center">
            <div className="text-xl font-extrabold text-[#a5293c]">{rows.length ? avgScore + '%' : '–'}</div>
            <div className="text-[11px] text-gray-500">คะแนนเฉลี่ย</div>
          </div>
          <div className="bg-white border border-[#e7dedc] rounded-xl p-3 text-center">
            <div className="text-xl font-extrabold text-[#a5293c]">{issues.length}</div>
            <div className="text-[11px] text-gray-500">รายการไม่เรียบร้อย</div>
          </div>
        </div>

        <div className="bg-white border border-[#e7dedc] rounded-2xl p-4 mb-4">
          <h2 className="text-[#a5293c] font-semibold text-sm mb-3">สถิติผู้แก้ไขงาน</h2>
          <table className="w-full text-xs">
            <thead><tr className="text-gray-500 text-left"><th className="py-1">ชื่อ</th><th>ครั้ง</th><th></th></tr></thead>
            <tbody>
              {fixerCounts.map(([name, count]) => (
                <tr key={name} className="border-t border-[#e7dedc]">
                  <td className="py-1.5 text-gray-900 font-medium">{name}</td>
                  <td className={count === 0 ? 'text-green-700 font-bold' : 'text-red-600 font-bold !text-red-600'}>{count === 0 ? '0 (ดี)' : count}</td>
                  <td>{count > 0 && <button onClick={() => setOpenFixer(name)} className="text-[#a5293c] underline">ดูรายการ</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {openFixer && (
          <div className="bg-white border border-[#e7dedc] rounded-2xl p-4 mb-4">
            <h2 className="text-[#a5293c] font-semibold text-sm mb-1">รายการที่ "{openFixer}" เคยต้องแก้ไข</h2>
            <div className= "overflow-x-auto w-full">
              <table className="w-full text-[10px] mt-2">
              <thead><tr className="text-gray-500 text-left"><th className="py-1">สิ่งที่ต้องแก้ไข</th>
              <th className="text-gray-500 text-md whitespace-nowrap">วันที่</th></tr></thead>
              <tbody>
                {fixerDetail.map(([note, info]) => (
                  <tr key={note} className="border-t border-[#e7dedc]">
                    <td className="py-2 px-1 text-[10px] !text-gray-900 font-medium whitespace-normal leading-tight break-all">{note}</td>
                    <td className="text-[10px] text-gray-900">{info.lastDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
              </div>
          </div>
        )}

        <div className="bg-white border border-[#e7dedc] rounded-2xl p-4 mb-4">
          <h2 className="text-[#a5293c] font-semibold text-sm mb-3">รายการไม่เรียบร้อยล่าสุด</h2>
          <select value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)} className="mb-3 bg-white text-gray-900 !text-gray-900 !bg-white border border-[#e7dedc] rounded-lg px-3 py-1.5 text-xs w-full max-w-full font-medium">
            <option value="">ทุกโซน</option>
            {SECTIONS.map((s) => <option key={s.key} value={s.key}>{s.title}</option>)}
          </select>
          <div className="overflow-x-auto w-full
                    [&::-webkit-scrollbar]:h-2 
                    [&::-webkit-scrollbar-track]:bg-gray-100 
                    [&::-webkit-scrollbar-track]:rounded-full
                    [&::-webkit-scrollbar-thumb]:bg-gray-300 
                    [&::-webkit-scrollbar-thumb]:rounded-full
                    hover:[&::-webkit-scrollbar-thumb]:bg-gray-400">
            <table className="w-full text-[10px] min-w-[500px]">
              <thead><tr className="text-gray-900 text-left border-b border-[#e7dedc]">
                <th className="py-2 px-1 whitespace-nowrap">วันที่</th>
                <th className="px-1 whitespace-nowrap">ช่วง</th>
                <th className="px-1 whitespace-nowrap">โซน</th>
                <th className="px-1 whitespace-normal leading-tight">สิ่งที่ต้องแก้ไข</th>
                <th className="px-1 whitespace-nowrap">ผู้แก้ไข</th>
                <th className="px-1 whitespace-nowrap">สถานะ</th>
              </tr></thead>
              <tbody>
                {filteredIssues.slice(0, 100).map((i, idx) => (
                  <tr key={idx} className="border-t border-[#e7dedc]">
                    <td className="py-2 px-1 !text-gray-900 font-medium whitespace-nowrap">{i.date}</td>
                    <td className="px-1 !text-gray-900 font-medium whitespace-nowrap">{i.period}</td>
                    <td className="px-1 !text-gray-900 font-medium whitespace-nowrap">{sectionTitle(i.sectionKey)}</td>
                    <td className="px-1 !text-gray-900 font-medium whitespace-normal leading-tight">{i.item.note}</td>
                    <td className="px-1 !text-gray-900 font-medium whitespace-nowrap">{i.item.fixer || '-'}</td>
                    <td className={`px-1 font-bold whitespace-nowrap ${i.item.resolved ? 'text-green-700' : 'text-red-600 !text-red-600'}`}>{i.item.resolved ? 'แก้ไขแล้ว' : 'รอแก้ไข'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-[#e7dedc] rounded-2xl p-4">
          <h2 className="text-[#a5293c] font-semibold text-sm mb-3">ประวัติการตรวจล่าสุด</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-gray-500 text-left"><th className="py-1">วันที่</th><th>ช่วง</th><th>ผู้ตรวจ</th><th>คะแนน</th><th>บันทึกจริง</th><th></th></tr></thead>
              <tbody>
                {rows.slice(0, 30).map((d) => (
                  <tr key={d.id} className="border-t border-[#e7dedc]">
                    <td className="py-1.5 text-gray-900 font-medium">{d.date}</td>
                    <td className="!text-gray-900">{d.period}</td>
                    <td className="!text-gray-900">{d.inspector}</td>
                    <td className={d.score >= 90 ? 'text-green-700 font font-bold' : d.score < 70 ? 'text-red-600 font-bold' : '!text-gray-900 font-bold'}>
                      {d.score}%</td>
                    <td className="!text-gray-900">
                      {new Date(d.created_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td><button onClick={() => deleteSubmission(d.id)} className="text-red-600 underline">ลบ</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
