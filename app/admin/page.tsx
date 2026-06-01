'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const ADMIN_PASS = 'axia2026admin'

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [pass, setPass] = useState('')
  const [passErr, setPassErr] = useState(false)

  const [stores, setStores] = useState<any[]>([])
  const [liveList, setLiveList] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)

  useEffect(() => {
    if (sessionStorage.getItem('akiboard_admin')) {
      setAuthed(true)
      fetchAll()
    }
  }, [])

  useEffect(() => {
    if (!authed) return
    const channel = supabase
      .channel('admin-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_statuses' }, () => fetchLive())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [authed])

  async function fetchAll() {
    setLoading(true)
    await Promise.all([fetchStores(), fetchLive()])
    setLoading(false)
  }

  async function fetchStores() {
    const { data } = await supabase.from('stores').select('*').order('created_at', { ascending: false })
    if (data) setStores(data)
  }

  async function fetchLive() {
    const now = new Date().toISOString()
    const { data } = await supabase
      .from('live_statuses')
      .select('*')
      .gt('expires_at', now)
      .neq('status', 'closed')
      .order('created_at', { ascending: false })
    if (data) setLiveList(data)
  }

  async function deleteStore(store: any) {
    await supabase.from('live_statuses').delete().eq('store_code', store.code)
    await supabase.from('stores').delete().eq('id', store.id)
    setDeleteTarget(null)
    fetchAll()
  }

  function doLogin() {
    if (pass === ADMIN_PASS) {
      sessionStorage.setItem('akiboard_admin', '1')
      setAuthed(true)
      fetchAll()
    } else {
      setPassErr(true)
      setPass('')
    }
  }

  function doLogout() {
    sessionStorage.removeItem('akiboard_admin')
    setAuthed(false)
  }

  const filtered = stores.filter(s =>
    !search || s.name?.includes(search) || s.area?.includes(search) || s.code?.includes(search) || s.email?.includes(search)
  )

  const STATUS_LABEL: Record<string, string> = { open: '◎ 余裕あり', some: '○ 空きあり', few: '△ 残りわずか' }
  const STATUS_COLOR: Record<string, string> = { open: '#22c55e', some: '#f97316', few: '#ef4444' }

  function timerRemain(expiresAt: string) {
    return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 60000))
  }

  if (!authed) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'#f5f4f0',padding:24}}>
      <div style={{background:'#fff',borderRadius:18,border:'1px solid rgba(0,0,0,0.08)',padding:'32px 28px',width:'100%',maxWidth:360,textAlign:'center'}}>
        <div style={{fontSize:20,fontWeight:800,color:'#f97316',marginBottom:4}}>AkiBoard</div>
        <div style={{fontSize:12,background:'#1a1a1a',color:'#fff',display:'inline-block',padding:'2px 10px',borderRadius:20,marginBottom:24,fontSize:11,fontWeight:600}}>ADMIN</div>
        <div>
          <label style={{fontSize:12,color:'#888',display:'block',textAlign:'left',marginBottom:6}}>管理者パスワード</label>
          <input type="password" value={pass} onChange={e=>setPass(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&doLogin()}
            placeholder="パスワードを入力"
            style={{width:'100%',padding:'11px 14px',border:'1px solid rgba(0,0,0,0.08)',borderRadius:10,fontSize:14,marginBottom:14,boxSizing:'border-box'}}/>
          <button onClick={doLogin} style={{width:'100%',padding:13,background:'#1a1a1a',color:'#fff',border:'none',borderRadius:10,fontSize:15,fontWeight:700,cursor:'pointer'}}>ログイン</button>
          {passErr && <div style={{color:'#ef4444',fontSize:12,marginTop:10}}>パスワードが違います</div>}
        </div>
      </div>
    </div>
  )

  return (
    <div style={{fontFamily:'sans-serif',background:'#f5f4f0',minHeight:'100vh'}}>
      {/* 削除確認モーダル */}
      {deleteTarget && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
          <div style={{background:'#fff',borderRadius:18,padding:28,width:'100%',maxWidth:360}}>
            <div style={{fontSize:16,fontWeight:700,marginBottom:8}}>店舗を削除しますか？</div>
            <div style={{fontSize:13,color:'#888',marginBottom:20}}>「{deleteTarget.name}」（{deleteTarget.code}）を削除します。この操作は取り消せません。</div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setDeleteTarget(null)} style={{flex:1,padding:12,background:'#f5f4f0',border:'none',borderRadius:10,fontSize:14,cursor:'pointer'}}>キャンセル</button>
              <button onClick={()=>deleteStore(deleteTarget)} style={{flex:1,padding:12,background:'#ef4444',color:'#fff',border:'none',borderRadius:10,fontSize:14,fontWeight:700,cursor:'pointer'}}>削除する</button>
            </div>
          </div>
        </div>
      )}

      <header style={{background:'#fff',borderBottom:'1px solid rgba(0,0,0,0.08)',padding:'0 20px',position:'sticky',top:0,zIndex:100}}>
        <div style={{maxWidth:1000,margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'space-between',height:56}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:18,fontWeight:800,color:'#f97316'}}>AkiBoard</span>
            <span style={{fontSize:10,background:'#1a1a1a',color:'#fff',padding:'2px 8px',borderRadius:20,fontWeight:600}}>ADMIN</span>
          </div>
          <div style={{display:'flex',gap:10,alignItems:'center'}}>
            <button onClick={fetchAll} style={{fontSize:12,color:'#f97316',border:'1px solid #f97316',padding:'5px 12px',borderRadius:20,background:'none',cursor:'pointer'}}>更新</button>
            <a href="/" style={{fontSize:12,color:'#888',border:'1px solid rgba(0,0,0,0.08)',padding:'5px 12px',borderRadius:20,textDecoration:'none'}}>お客さん画面</a>
            <button onClick={doLogout} style={{fontSize:12,color:'#888',background:'none',border:'none',cursor:'pointer'}}>ログアウト</button>
          </div>
        </div>
      </header>

      <div style={{maxWidth:1000,margin:'0 auto',padding:20}}>

        {/* 統計カード */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12,marginBottom:20}}>
          {[
            ['登録店舗数', stores.length, '#f97316'],
            ['今夜公開中', liveList.length, '#22c55e'],
            ['今月の新規', stores.filter(s => new Date(s.created_at).getMonth() === new Date().getMonth()).length, '#3b82f6'],
            ['公開率', stores.length > 0 ? Math.round(liveList.length / stores.length * 100) + '%' : '0%', '#8b5cf6'],
          ].map(([label, val, color]) => (
            <div key={label as string} style={{background:'#fff',borderRadius:16,border:'1px solid rgba(0,0,0,0.08)',padding:18}}>
              <div style={{fontSize:11,color:'#888',fontWeight:500,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>{label as string}</div>
              <div style={{fontSize:30,fontWeight:800,color: color as string}}>{val as string|number}</div>
            </div>
          ))}
        </div>

        {/* 公開中の店舗 */}
        <div style={{background:'#fff',borderRadius:18,border:'1px solid rgba(0,0,0,0.08)',overflow:'hidden',marginBottom:16}}>
          <div style={{padding:'14px 20px',borderBottom:'1px solid rgba(0,0,0,0.06)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div>
              <div style={{fontSize:14,fontWeight:700}}>今夜公開中の店舗</div>
              <div style={{fontSize:11,color:'#888'}}>リアルタイム更新</div>
            </div>
          </div>
          {liveList.length === 0 ? (
            <div style={{padding:32,textAlign:'center',color:'#888',fontSize:13}}>現在公開中の店舗はありません</div>
          ) : (
            <div style={{padding:'12px 20px',display:'flex',flexDirection:'column',gap:10}}>
              {liveList.map(s => (
                <div key={s.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:12}}>
                  <div style={{width:8,height:8,borderRadius:'50%',background:'#22c55e',flexShrink:0,animation:'pulse 1.5s infinite'}}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700}}>{s.store_name}</div>
                    <div style={{fontSize:11,color:'#888'}}>{s.area} / {s.from_time}〜{s.to_time}</div>
                  </div>
                  <span style={{fontSize:12,fontWeight:600,color:STATUS_COLOR[s.status]||'#22c55e'}}>{STATUS_LABEL[s.status]||'空きあり'}</span>
                  <span style={{fontSize:11,color:'#16a34a',background:'#dcfce7',padding:'3px 10px',borderRadius:20,fontWeight:600}}>残{timerRemain(s.expires_at)}分</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 登録店舗一覧 */}
        <div style={{background:'#fff',borderRadius:18,border:'1px solid rgba(0,0,0,0.08)',overflow:'hidden'}}>
          <div style={{padding:'14px 20px',borderBottom:'1px solid rgba(0,0,0,0.06)',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
            <div>
              <div style={{fontSize:14,fontWeight:700}}>登録店舗一覧</div>
              <div style={{fontSize:11,color:'#888'}}>{filtered.length}件</div>
            </div>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="店名・エリア・コードで検索"
              style={{padding:'8px 12px',border:'1px solid rgba(0,0,0,0.08)',borderRadius:10,fontSize:13,width:220,boxSizing:'border-box'}}/>
          </div>

          {loading ? (
            <div style={{padding:32,textAlign:'center',color:'#888',fontSize:13}}>読み込み中...</div>
          ) : filtered.length === 0 ? (
            <div style={{padding:32,textAlign:'center',color:'#888',fontSize:13}}>登録店舗がありません</div>
          ) : (
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead>
                  <tr style={{background:'#f9f8f5'}}>
                    {['店舗コード','店舗名','エリア','メールアドレス','登録日','公開中',''].map(h => (
                      <th key={h} style={{padding:'10px 16px',textAlign:'left',fontSize:11,fontWeight:600,color:'#888',textTransform:'uppercase',letterSpacing:'0.08em',borderBottom:'1px solid rgba(0,0,0,0.06)',whiteSpace:'nowrap'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => {
                    const isLive = liveList.some(l => l.store_code === s.code)
                    return (
                      <tr key={s.id} style={{borderBottom:'1px solid rgba(0,0,0,0.04)'}}>
                        <td style={{padding:'12px 16px'}}>
                          <span style={{fontFamily:'monospace',fontSize:12,fontWeight:700,background:'#fff7ed',color:'#f97316',padding:'3px 10px',borderRadius:20}}>{s.code}</span>
                        </td>
                        <td style={{padding:'12px 16px',fontSize:13,fontWeight:500}}>{s.name}</td>
                        <td style={{padding:'12px 16px',fontSize:13,color:'#888'}}>{s.area}</td>
                        <td style={{padding:'12px 16px',fontSize:12,color:'#888'}}>{s.email || '—'}</td>
                        <td style={{padding:'12px 16px',fontSize:12,color:'#888',whiteSpace:'nowrap'}}>{new Date(s.created_at).toLocaleDateString('ja-JP')}</td>
                        <td style={{padding:'12px 16px'}}>
                          {isLive
                            ? <span style={{fontSize:11,fontWeight:600,color:'#22c55e',background:'#f0fdf4',padding:'3px 10px',borderRadius:20}}>● 公開中</span>
                            : <span style={{fontSize:11,color:'#bbb'}}>—</span>
                          }
                        </td>
                        <td style={{padding:'12px 16px'}}>
                          <button onClick={()=>setDeleteTarget(s)} style={{fontSize:11,color:'#ef4444',background:'none',border:'1px solid #fca5a5',padding:'4px 10px',borderRadius:20,cursor:'pointer'}}>削除</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
