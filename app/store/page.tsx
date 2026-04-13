'use client'

import emailjs from '@emailjs/browser'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const TABLE_LABELS: Record<string, string> = {t2:'2名席',t4:'4名席',t6:'6名以上',tc:'カウンター'}
const TABLE_UNITS: Record<string, string> = {t2:'卓',t4:'卓',t6:'卓',tc:'席'}

export default function StorePage() {
  const [screen, setScreen] = useState<'login'|'register'|'complete'|'app'>('login')
  const [session, setSession] = useState<any>(null)
  const [liveStatus, setLiveStatus] = useState<any>(null)
  const [tables, setTables] = useState({t2:0,t4:2,t6:0,tc:0})
  const [fromTime, setFromTime] = useState('21:00')
  const [toTime, setToTime] = useState('25:00')
  const [memo, setMemo] = useState('')
  const [issuedCode, setIssuedCode] = useState('')
  const [tab, setTab] = useState<'publish'|'register'>('publish')
  const [timerMin, setTimerMin] = useState(60)

  // ログインフォーム
  const [loginCode, setLoginCode] = useState('')
  const [loginPass, setLoginPass] = useState('')
  const [loginErr, setLoginErr] = useState('')

  // 新規登録フォーム
  const [regName, setRegName] = useState('')
  const [regArea, setRegArea] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPass, setRegPass] = useState('')
  const [regPass2, setRegPass2] = useState('')
  const [regErr, setRegErr] = useState('')

  // 店舗情報編集フォーム
  const [regStoreName, setRegStoreName] = useState('')
  const [regStoreArea, setRegStoreArea] = useState('')
  const [regAccess, setRegAccess] = useState('')
  const [regMapUrl, setRegMapUrl] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [saveNotice, setSaveNotice] = useState(false)

  useEffect(() => {
    const saved = sessionStorage.getItem('akiboard_session')
    if (saved) {
      const s = JSON.parse(saved)
      setSession(s)
      setScreen('app')
      fetchLiveStatus(s.code)
      setRegStoreName(s.name || '')
      setRegStoreArea(s.area || '')
      setRegAccess(s.access || '')
      setRegMapUrl(s.mapUrl || '')
    }
  }, [])

  useEffect(() => {
    if (!liveStatus) return
    const interval = setInterval(() => {
      const remaining = Math.ceil((new Date(liveStatus.expires_at).getTime() - Date.now()) / 60000)
      setTimerMin(Math.max(0, remaining))
    }, 30000)
    const remaining = Math.ceil((new Date(liveStatus.expires_at).getTime() - Date.now()) / 60000)
    setTimerMin(Math.max(0, remaining))
    return () => clearInterval(interval)
  }, [liveStatus])

  async function fetchLiveStatus(code: string) {
    const now = new Date().toISOString()
    const { data } = await supabase
      .from('live_statuses')
      .select('*')
      .eq('store_code', code)
      .gt('expires_at', now)
      .order('created_at', { ascending: false })
      .limit(1)
    setLiveStatus(data && data.length > 0 ? data[0] : null)
  }

  function generateCode() {
    return 'AKIB-' + Math.floor(1000 + Math.random() * 9000)
  }

  async function doLogin() {
    const { data } = await supabase
      .from('stores')
      .select('*')
      .eq('code', loginCode.toUpperCase())
      .single()
    if (data && data.password_hash === loginPass) {
      const s = { code: data.code, name: data.name, area: data.area, mapUrl: data.map_url, access: data.access }
      sessionStorage.setItem('akiboard_session', JSON.stringify(s))
      setSession(s)
      setRegStoreName(data.name || '')
      setRegStoreArea(data.area || '')
      setRegAccess(data.access || '')
      setRegMapUrl(data.map_url || '')
      setScreen('app')
      fetchLiveStatus(data.code)
      setLoginErr('')
    } else {
      setLoginErr('店舗コードまたはパスワードが違います')
    }
  }

  async function doRegister() {
    if (!regName || !regArea) { setRegErr('店舗名とエリアを入力してください'); return }
    if (!regEmail.includes('@')) { setRegErr('正しいメールアドレスを入力してください'); return }
    if (regPass.length < 4) { setRegErr('パスワードは4文字以上にしてください'); return }
    if (regPass !== regPass2) { setRegErr('パスワードが一致しません'); return }

    const code = generateCode()
    const { error } = await supabase.from('stores').insert({
      code, name: regName, area: regArea, email: regEmail, password_hash: regPass, genre: 'izakaya'
    })
    if (error) { setRegErr('登録に失敗しました: ' + error.message); return }

    setIssuedCode(code)
    const s = { code, name: regName, area: regArea }
    sessionStorage.setItem('akiboard_session', JSON.stringify(s))
    setSession(s)
    setRegStoreName(regName)
    setRegStoreArea(regArea)
    // EmailJSでメール送信
    emailjs.init('M8Uh82xbEBhX85YRa')
    emailjs.send('service_2j5ly9x', 'template_a0upj4b', {
      to_email: regEmail,
      store_name: regName,
      store_code: code,
    }, 'M8Uh82xbEBhX85YRa').catch(e => console.warn('メール送信エラー:', e))
    setScreen('complete')
    setRegErr('')
  }

  async function publish() {
    if (!session) return
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    const { data, error } = await supabase.from('live_statuses').insert({
      store_code: session.code,
      store_name: session.name,
      area: session.area,
      genre: 'izakaya',
      map_url: session.mapUrl || '',
      tables, from_time: fromTime, to_time: toTime, memo,
      status: 'open', expires_at: expiresAt
    }).select().single()
    if (!error && data) setLiveStatus(data)
  }

  async function updateStatus(status: string) {
    if (!liveStatus) return
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    const { data } = await supabase.from('live_statuses')
      .update({ status, expires_at: expiresAt })
      .eq('id', liveStatus.id).select().single()
    if (data) setLiveStatus(data)
    if (status === 'closed') setTimeout(() => setLiveStatus(null), 800)
  }

  async function extendTimer() {
    if (!liveStatus) return
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    const { data } = await supabase.from('live_statuses')
      .update({ expires_at: expiresAt })
      .eq('id', liveStatus.id).select().single()
    if (data) setLiveStatus(data)
  }

  async function unpublish() {
    if (!liveStatus) return
    await supabase.from('live_statuses').update({ status: 'closed' }).eq('id', liveStatus.id)
    setLiveStatus(null)
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !session) return
    const ext = file.name.split('.').pop()
    const path = `${session.code}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('store-photos').upload(path, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('store-photos').getPublicUrl(path)
      setPhotoUrl(data.publicUrl)
    }
  }

  async function saveStoreInfo() {
    if (!session) return
    await supabase.from('stores').update({
      name: regStoreName,
      area: regStoreArea,
      access: regAccess,
      map_url: regMapUrl,
    }).eq('code', session.code)
    const updated = { ...session, name: regStoreName, area: regStoreArea, mapUrl: regMapUrl, access: regAccess }
    sessionStorage.setItem('akiboard_session', JSON.stringify(updated))
    setSession(updated)
    setSaveNotice(true)
    setTimeout(() => setSaveNotice(false), 3000)
  }

  function changeTable(key: string, d: number) {
    setTables(prev => ({ ...prev, [key]: Math.max(0, Math.min(20, (prev as any)[key] + d)) }))
  }

  if (screen === 'login') return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'#f5f4f0',padding:24}}>
      <div style={{background:'#fff',borderRadius:18,border:'1px solid rgba(0,0,0,0.08)',padding:'32px 28px',width:'100%',maxWidth:380}}>
        <div style={{fontSize:22,fontWeight:800,color:'#f97316',textAlign:'center',marginBottom:6}}>AkiBoard</div>
        <div style={{fontSize:13,color:'#888',textAlign:'center',marginBottom:28}}>店舗管理画面</div>
        <label style={{fontSize:12,color:'#888',display:'block',marginBottom:6}}>店舗コード</label>
        <input value={loginCode} onChange={e=>setLoginCode(e.target.value)} placeholder="例：AKIB-2847"
          style={{width:'100%',padding:'11px 14px',border:'1px solid rgba(0,0,0,0.08)',borderRadius:10,fontSize:14,marginBottom:14,boxSizing:'border-box'}}/>
        <label style={{fontSize:12,color:'#888',display:'block',marginBottom:6}}>パスワード</label>
        <input type="password" value={loginPass} onChange={e=>setLoginPass(e.target.value)} placeholder="パスワードを入力"
          onKeyDown={e=>e.key==='Enter'&&doLogin()}
          style={{width:'100%',padding:'11px 14px',border:'1px solid rgba(0,0,0,0.08)',borderRadius:10,fontSize:14,marginBottom:14,boxSizing:'border-box'}}/>
        <button onClick={doLogin} style={{width:'100%',padding:13,background:'#f97316',color:'#fff',border:'none',borderRadius:10,fontSize:15,fontWeight:700,cursor:'pointer'}}>ログイン</button>
        {loginErr && <div style={{color:'#ef4444',fontSize:12,textAlign:'center',marginTop:10}}>{loginErr}</div>}
        <div style={{textAlign:'center',marginTop:20,paddingTop:20,borderTop:'1px solid rgba(0,0,0,0.08)'}}>
          <div style={{fontSize:12,color:'#888',marginBottom:12}}>初めてご利用の方はこちら</div>
          <button onClick={()=>setScreen('register')} style={{width:'100%',padding:13,background:'#f5f4f0',color:'#1a1a1a',border:'1px solid rgba(0,0,0,0.08)',borderRadius:10,fontSize:14,cursor:'pointer'}}>新規登録する</button>
        </div>
      </div>
    </div>
  )

  if (screen === 'register') return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'#f5f4f0',padding:24}}>
      <div style={{background:'#fff',borderRadius:18,border:'1px solid rgba(0,0,0,0.08)',padding:'32px 28px',width:'100%',maxWidth:380}}>
        <div style={{fontSize:22,fontWeight:800,color:'#f97316',textAlign:'center',marginBottom:20}}>新規登録</div>
        {([['店舗名','text',regName,setRegName,'例：居酒屋 むらさき'],['エリア','text',regArea,setRegArea,'例：梅田'],['メールアドレス','email',regEmail,setRegEmail,'store@example.com'],['パスワード（4文字以上）','password',regPass,setRegPass,''],['パスワード（確認）','password',regPass2,setRegPass2,'']] as [string,string,string,any,string][]).map(([label,type,val,setter,ph]) => (
          <div key={label}>
            <label style={{fontSize:12,color:'#888',display:'block',marginBottom:6}}>{label}</label>
            <input type={type} value={val} onChange={e=>setter(e.target.value)} placeholder={ph}
              style={{width:'100%',padding:'11px 14px',border:'1px solid rgba(0,0,0,0.08)',borderRadius:10,fontSize:14,marginBottom:14,boxSizing:'border-box'}}/>
          </div>
        ))}
        <button onClick={doRegister} style={{width:'100%',padding:13,background:'#f97316',color:'#fff',border:'none',borderRadius:10,fontSize:15,fontWeight:700,cursor:'pointer'}}>登録して店舗コードを取得する</button>
        {regErr && <div style={{color:'#ef4444',fontSize:12,textAlign:'center',marginTop:10}}>{regErr}</div>}
        <div style={{textAlign:'center',marginTop:16}}>
          <button onClick={()=>setScreen('login')} style={{background:'none',border:'none',color:'#888',fontSize:13,cursor:'pointer'}}>← ログインに戻る</button>
        </div>
      </div>
    </div>
  )

  if (screen === 'complete') return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'#f5f4f0',padding:24}}>
      <div style={{background:'#fff',borderRadius:18,border:'1px solid rgba(0,0,0,0.08)',padding:'32px 28px',width:'100%',maxWidth:380,textAlign:'center'}}>
        <div style={{fontSize:40,marginBottom:12}}>🎉</div>
        <div style={{fontSize:22,fontWeight:800,color:'#f97316',marginBottom:8}}>登録完了！</div>
        <div style={{fontSize:13,color:'#888',marginBottom:24}}>あなたの店舗コードをメモしてください</div>
        <div style={{background:'#fff7ed',border:'2px solid #f97316',borderRadius:10,padding:20,marginBottom:20}}>
          <div style={{fontSize:12,color:'#f97316',marginBottom:6}}>店舗コード</div>
          <div style={{fontSize:28,fontWeight:800,color:'#f97316',letterSpacing:'0.1em'}}>{issuedCode}</div>
        </div>
        <div style={{fontSize:12,color:'#888',marginBottom:24,lineHeight:1.8}}>このコードは次回ログイン時に必要です。<br/>大切に保管してください。</div>
        <button onClick={()=>setScreen('app')} style={{width:'100%',padding:14,background:'#f97316',color:'#fff',border:'none',borderRadius:10,fontSize:15,fontWeight:700,cursor:'pointer'}}>管理画面に進む →</button>
      </div>
    </div>
  )

  return (
    <div style={{fontFamily:'sans-serif',background:'#f5f4f0',minHeight:'100vh'}}>
      <header style={{background:'#fff',borderBottom:'1px solid rgba(0,0,0,0.08)',padding:'0 20px',position:'sticky',top:0,zIndex:100}}>
        <div style={{maxWidth:540,margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'space-between',height:56}}>
          <div>
            <span style={{fontSize:18,fontWeight:800,color:'#f97316'}}>AkiBoard</span>
            <span style={{fontSize:11,color:'#888',marginLeft:6}}>店舗管理</span>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <a href="/" style={{fontSize:12,color:'#f97316',border:'1px solid #f97316',padding:'5px 12px',borderRadius:20,textDecoration:'none'}}>お客さん画面 →</a>
            <button onClick={()=>{sessionStorage.removeItem('akiboard_session');setScreen('login')}} style={{fontSize:12,color:'#888',background:'none',border:'none',cursor:'pointer'}}>ログアウト</button>
          </div>
        </div>
      </header>

      <div style={{maxWidth:540,margin:'0 auto',borderBottom:'1px solid rgba(0,0,0,0.08)',background:'#fff',display:'flex',padding:'0 20px'}}>
        {(['publish','register'] as const).map(t => (
          <button key={t} onClick={()=>setTab(t)}
            style={{padding:'13px 20px',fontSize:13,fontWeight:500,color:tab===t?'#f97316':'#888',border:'none',background:'none',cursor:'pointer',borderBottom:tab===t?'2px solid #f97316':'2px solid transparent',marginBottom:-1}}>
            {t === 'publish' ? '空き公開' : '店舗登録'}
          </button>
        ))}
      </div>

      <div style={{maxWidth:540,margin:'0 auto',padding:20}}>
        {tab === 'publish' && (
          <>
            {liveStatus ? (
              <div style={{background:'#fff',borderRadius:18,border:'1px solid rgba(0,0,0,0.08)',overflow:'hidden',marginBottom:16}}>
                <div style={{background:'#f0fdf4',padding:'12px 18px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,fontSize:14,fontWeight:700,color:'#15803d'}}>
                    <div style={{width:8,height:8,borderRadius:'50%',background:'#22c55e'}}/>公開中
                  </div>
                  <span style={{fontSize:12,fontWeight:600,color:timerMin<=15?'#dc2626':'#16a34a',background:timerMin<=15?'#fef2f2':'#dcfce7',padding:'4px 10px',borderRadius:20}}>{timerMin}分</span>
                </div>
                <div style={{padding:'16px 18px',display:'flex',flexDirection:'column',gap:10}}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                    {([['open','◎ 余裕あり'],['some','○ 空きあり'],['few','△ 残りわずか'],['closed','× 本日終了']] as [string,string][]).map(([s,l]) => (
                      <button key={s} onClick={()=>updateStatus(s)}
                        style={{padding:'13px 8px',borderRadius:12,border:`1.5px solid ${liveStatus.status===s?'#86efac':'rgba(0,0,0,0.08)'}`,background:liveStatus.status===s?'#f0fdf4':'#f5f4f0',fontSize:13,fontWeight:500,cursor:'pointer',color:liveStatus.status===s?'#16a34a':'#888'}}>
                        {l}
                      </button>
                    ))}
                  </div>
                  <button onClick={extendTimer} style={{width:'100%',padding:13,background:'#f0fdf4',color:'#16a34a',border:'1.5px solid #86efac',borderRadius:10,fontSize:14,fontWeight:700,cursor:'pointer'}}>✓ まだ空いてます（1時間延長）</button>
                  <button onClick={unpublish} style={{width:'100%',padding:10,background:'none',border:'1px solid rgba(0,0,0,0.08)',borderRadius:10,fontSize:13,color:'#888',cursor:'pointer'}}>公開を取り消す</button>
                </div>
              </div>
            ) : (
              <div style={{background:'#fff',borderRadius:18,border:'1px solid rgba(0,0,0,0.08)',padding:20,marginBottom:14}}>
                <div style={{fontSize:11,fontWeight:500,color:'#888',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:14}}>今夜の空き状況</div>
                <div style={{marginBottom:14}}>
                  <label style={{fontSize:12,color:'#888',display:'block',marginBottom:8}}>席の種類と卓数</label>
                  {([['t2','2名席','卓'],['t4','4名席','卓'],['t6','6名以上','卓'],['tc','カウンター','席']] as [string,string,string][]).map(([k,l,u]) => (
                    <div key={k} style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                      <span style={{fontSize:13,fontWeight:500,minWidth:90}}>{l}</span>
                      <button onClick={()=>changeTable(k,-1)} style={{width:34,height:34,borderRadius:8,border:'1px solid rgba(0,0,0,0.08)',background:'#f5f4f0',fontSize:18,cursor:'pointer'}}>−</button>
                      <span style={{fontSize:22,fontWeight:700,color:'#f97316',minWidth:32,textAlign:'center'}}>{(tables as any)[k]}</span>
                      <button onClick={()=>changeTable(k,1)} style={{width:34,height:34,borderRadius:8,border:'1px solid rgba(0,0,0,0.08)',background:'#f5f4f0',fontSize:18,cursor:'pointer'}}>+</button>
                      <span style={{fontSize:13,color:'#888'}}>{u}</span>
                    </div>
                  ))}
                </div>
                <div style={{marginBottom:14}}>
                  <label style={{fontSize:12,color:'#888',display:'block',marginBottom:6}}>受付時間</label>
                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    <select value={fromTime} onChange={e=>setFromTime(e.target.value)} style={{flex:1,padding:'10px 13px',border:'1px solid rgba(0,0,0,0.08)',borderRadius:10,fontSize:14}}>
                      {['18:00','19:00','20:00','21:00','22:00','23:00'].map(t=><option key={t}>{t}</option>)}
                    </select>
                    <span style={{color:'#888'}}>〜</span>
                    <select value={toTime} onChange={e=>setToTime(e.target.value)} style={{flex:1,padding:'10px 13px',border:'1px solid rgba(0,0,0,0.08)',borderRadius:10,fontSize:14}}>
                      {['23:00','24:00','25:00','26:00','27:00'].map(t=><option key={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{marginBottom:14}}>
                  <label style={{fontSize:12,color:'#888',display:'block',marginBottom:6}}>一言メモ（任意）</label>
                  <textarea value={memo} onChange={e=>setMemo(e.target.value)} placeholder="例：個室あり・飲み放題プランあり"
                    style={{width:'100%',padding:'10px 13px',border:'1px solid rgba(0,0,0,0.08)',borderRadius:10,fontSize:14,minHeight:68,resize:'vertical',boxSizing:'border-box'}}/>
                </div>
                <button onClick={publish} style={{width:'100%',padding:16,background:'#f97316',color:'#fff',border:'none',borderRadius:18,fontSize:16,fontWeight:700,cursor:'pointer'}}>今すぐ公開する</button>
              </div>
            )}
          </>
        )}

        {tab === 'register' && (
          <div>
            <div style={{background:'#fff',borderRadius:18,border:'1px solid rgba(0,0,0,0.08)',padding:20,marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:500,color:'#888',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:14}}>基本情報</div>
              {([['店舗名',regStoreName,setRegStoreName,'例：居酒屋 むらさき'],['エリア',regStoreArea,setRegStoreArea,'例：梅田'],['最寄り駅・徒歩分数',regAccess,setRegAccess,'例：梅田駅 徒歩2分'],['GoogleマップURL',regMapUrl,setRegMapUrl,'https://maps.app.goo.gl/xxxx']] as [string,string,any,string][]).map(([label,val,setter,ph]) => (
                <div key={label} style={{marginBottom:14}}>
                  <label style={{fontSize:12,color:'#888',display:'block',marginBottom:6}}>{label}</label>
                  <input value={val} onChange={e=>setter(e.target.value)} placeholder={ph}
                    style={{width:'100%',padding:'10px 13px',border:'1px solid rgba(0,0,0,0.08)',borderRadius:10,fontSize:14,boxSizing:'border-box'}}/>
                </div>
              ))}
            </div>

            <div style={{background:'#fff',borderRadius:18,border:'1px solid rgba(0,0,0,0.08)',padding:20,marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:500,color:'#888',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:14}}>宣材写真</div>
              <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{display:'none'}} id="photo-input"/>
              <label htmlFor="photo-input" style={{display:'block',width:'100%',padding:13,background:'#f5f4f0',border:'1.5px dashed rgba(0,0,0,0.15)',borderRadius:10,textAlign:'center',fontSize:13,color:'#888',cursor:'pointer',boxSizing:'border-box'}}>
                + 写真をアップロード
              </label>
              {photoUrl && (
                <div style={{marginTop:10}}>
                  <img src={photoUrl} style={{width:'100%',borderRadius:10,objectFit:'cover',maxHeight:200}} alt="宣材写真"/>
                </div>
              )}
              <div style={{fontSize:11,color:'#888',marginTop:8}}>Instagramへの自動投稿に使用されます</div>
            </div>

            <button onClick={saveStoreInfo} style={{width:'100%',padding:14,background:'#1a1a1a',color:'#fff',border:'none',borderRadius:18,fontSize:15,fontWeight:700,cursor:'pointer'}}>
              この内容で保存する
            </button>
            {saveNotice && <div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:10,padding:'12px 16px',fontSize:13,color:'#15803d',textAlign:'center',marginTop:12}}>✓ 保存しました</div>}
          </div>
        )}
      </div>
    </div>
  )
}
