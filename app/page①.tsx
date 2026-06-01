'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const GENRE_ICONS: Record<string, string> = {izakaya:'🍺',restaurant:'🍽',bar:'🥂',ramen:'🍜',cafe:'☕',other:'🍴'}
const STATUS_LABELS: Record<string, string> = {open:'◎ 余裕あり',some:'○ 空きあり',few:'△ 残りわずか'}
const STATUS_COLORS: Record<string, string> = {open:'#22c55e',some:'#f97316',few:'#ef4444'}
const TABLE_LABELS: Record<string, string> = {t2:'2名席',t4:'4名席',t6:'6名以上',tc:'カウンター'}
const TABLE_UNITS: Record<string, string> = {t2:'卓',t4:'卓',t6:'卓',tc:'席'}

function calcDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`
  return `${km.toFixed(1)}km`
}

export default function Home() {
  const [stores, setStores] = useState<any[]>([])
  const [filter, setFilter] = useState('all')
  const [area, setArea] = useState('all')
  const [areas, setAreas] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [userLat, setUserLat] = useState<number|null>(null)
  const [userLng, setUserLng] = useState<number|null>(null)
  const [gpsStatus, setGpsStatus] = useState<'idle'|'loading'|'ok'|'denied'>('idle')
  const [sortByDistance, setSortByDistance] = useState(false)

  useEffect(() => {
    fetchStores()
    const channel = supabase
      .channel('live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_statuses' }, () => fetchStores())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function fetchStores() {
    const now = new Date().toISOString()
    const { data } = await supabase
      .from('live_statuses')
      .select('*')
      .gt('expires_at', now)
      .neq('status', 'closed')
      .order('created_at', { ascending: false })
    if (data) {
      setStores(data)
      setAreas([...new Set(data.map((s: any) => s.area))])
    }
    setLoading(false)
  }

  function getLocation() {
    if (!navigator.geolocation) { setGpsStatus('denied'); return }
    setGpsStatus('loading')
    navigator.geolocation.getCurrentPosition(
      pos => {
        setUserLat(pos.coords.latitude)
        setUserLng(pos.coords.longitude)
        setGpsStatus('ok')
        setSortByDistance(true)
      },
      () => setGpsStatus('denied')
    )
  }

  function formatTables(tables: any) {
    if (!tables) return ''
    return Object.entries(tables)
      .filter(([, v]) => (v as number) > 0)
      .map(([k, v]) => `${TABLE_LABELS[k]} ${v}${TABLE_UNITS[k]}`)
      .join(' / ')
  }

  let filtered = stores.filter(s =>
    (filter === 'all' || s.genre === filter) &&
    (area === 'all' || s.area === area)
  )

  if (sortByDistance && userLat !== null && userLng !== null) {
    filtered = filtered
      .map(s => ({
        ...s,
        _distance: s.lat && s.lng ? calcDistance(userLat, userLng, s.lat, s.lng) : null
      }))
      .sort((a, b) => {
        if (a._distance === null) return 1
        if (b._distance === null) return -1
        return a._distance - b._distance
      })
  }

  return (
    <div style={{fontFamily:'sans-serif',background:'#f5f4f0',minHeight:'100vh'}}>
      <header style={{background:'#fff',borderBottom:'1px solid rgba(0,0,0,0.08)',padding:'0 20px',position:'sticky',top:0,zIndex:100}}>
        <div style={{maxWidth:540,margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'space-between',height:56}}>
          <span style={{fontSize:20,fontWeight:800,color:'#f97316'}}>AkiBoard</span>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            {gpsStatus === 'idle' && (
              <button onClick={getLocation} style={{fontSize:12,color:'#f97316',border:'1px solid #f97316',padding:'5px 12px',borderRadius:20,background:'none',cursor:'pointer'}}>📍 近い順</button>
            )}
            {gpsStatus === 'loading' && (
              <span style={{fontSize:12,color:'#888'}}>取得中...</span>
            )}
            {gpsStatus === 'ok' && (
              <button onClick={()=>setSortByDistance(v=>!v)} style={{fontSize:12,color:sortByDistance?'#fff':'#f97316',border:'1px solid #f97316',padding:'5px 12px',borderRadius:20,background:sortByDistance?'#f97316':'none',cursor:'pointer'}}>
                📍 近い順{sortByDistance ? ' ON' : ' OFF'}
              </button>
            )}
            {gpsStatus === 'denied' && (
              <span style={{fontSize:11,color:'#888'}}>GPS無効</span>
            )}
            <a href="/store" style={{fontSize:12,color:'#888',border:'1px solid rgba(0,0,0,0.08)',padding:'5px 12px',borderRadius:20,textDecoration:'none'}}>店舗の方</a>
          </div>
        </div>
      </header>

      <div style={{maxWidth:540,margin:'0 auto',padding:20}}>
        <div style={{display:'flex',gap:8,marginBottom:8,overflowX:'auto',paddingBottom:4}}>
          {['all',...areas].map(a => (
            <button key={a} onClick={() => setArea(a)}
              style={{padding:'7px 14px',borderRadius:20,border:'1px solid',borderColor:area===a?'#f97316':'rgba(0,0,0,0.08)',background:area===a?'#f97316':'#fff',color:area===a?'#fff':'#888',fontSize:13,cursor:'pointer',whiteSpace:'nowrap'}}>
              {a === 'all' ? 'すべてのエリア' : a}
            </button>
          ))}
        </div>

        <div style={{display:'flex',gap:8,marginBottom:16,overflowX:'auto',paddingBottom:4}}>
          {[['all','すべて'],['izakaya','🍺 居酒屋'],['bar','🥂 バー'],['ramen','🍜 ラーメン'],['cafe','☕ カフェ'],['restaurant','🍽 レストラン']].map(([v,l]) => (
            <button key={v} onClick={() => setFilter(v)}
              style={{padding:'7px 14px',borderRadius:20,border:'1px solid',borderColor:filter===v?'#f97316':'rgba(0,0,0,0.08)',background:filter===v?'#f97316':'#fff',color:filter===v?'#fff':'#888',fontSize:13,cursor:'pointer',whiteSpace:'nowrap'}}>
              {l}
            </button>
          ))}
        </div>

        {loading && <div style={{textAlign:'center',padding:40,color:'#888'}}>読み込み中...</div>}

        {!loading && filtered.length === 0 && (
          <div style={{textAlign:'center',padding:60,color:'#888'}}>
            <div style={{fontSize:40,marginBottom:12}}>🍺</div>
            <div style={{fontSize:16,fontWeight:700,marginBottom:8}}>現在空いているお店はありません</div>
            <div style={{fontSize:13}}>また後で確認してみてください</div>
          </div>
        )}

        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {filtered.map((s: any) => (
            <div key={s.id} style={{background:'#fff',borderRadius:18,border:'1px solid rgba(0,0,0,0.08)',padding:18}}>
              <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:10}}>
                <div style={{width:46,height:46,borderRadius:12,background:'#fff7ed',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>
                  {GENRE_ICONS[s.genre] || '🍴'}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:16,fontWeight:700}}>{s.store_name}</div>
                  <div style={{fontSize:12,color:'#888',display:'flex',gap:8,alignItems:'center'}}>
                    <span>{s.area}</span>
                    {sortByDistance && s._distance !== null && (
                      <span style={{background:'#fff7ed',color:'#f97316',fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:20}}>
                        📍 {formatDistance(s._distance)}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{fontSize:13,fontWeight:700,color:STATUS_COLORS[s.status]||'#22c55e'}}>
                  {STATUS_LABELS[s.status]||'空きあり'}
                </div>
              </div>
              <div style={{fontSize:13,color:'#f97316',fontWeight:700,marginBottom:6}}>
                {formatTables(s.tables)}空き
              </div>
              {s.memo && <div style={{fontSize:12,color:'#888',marginBottom:8}}>{s.memo}</div>}
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <span style={{fontSize:11,color:'#bbb'}}>{s.from_time}〜{s.to_time}</span>
                {s.map_url && (
                  <a href={s.map_url} target="_blank" rel="noreferrer"
                    style={{background:'#f97316',color:'#fff',padding:'8px 16px',borderRadius:20,fontSize:13,fontWeight:700,textDecoration:'none'}}>
                    📍 経路を見る
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
