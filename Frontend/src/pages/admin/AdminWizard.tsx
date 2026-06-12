import React, { useState, useEffect } from 'react'
import { PrisonLayout } from '@/components/PrisonLayout'
import { adminActionsApi } from '@/lib/api'
import { adminApi } from '@/lib/api'

export default function AdminWizard(){
  const [tab, setTab] = useState<'phq'|'station'|'createAdmin'>('phq')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  // PHQ form
  const [phqName, setPhqName] = useState('')
  const [phqCode, setPhqCode] = useState('')
  const [phqShort, setPhqShort] = useState('')

  // Station form
  const [stationName, setStationName] = useState('')
  const [stationCode, setStationCode] = useState('')
  const [stationShort, setStationShort] = useState('')
  const [stationParent, setStationParent] = useState<number | undefined>(undefined)
  const [provinces, setProvinces] = useState<any[]>([])

  // Create admin form
  const [orgId, setOrgId] = useState<number | undefined>(undefined)
  const [officerId, setOfficerId] = useState<number | undefined>(undefined)
  const [roleId, setRoleId] = useState<number | undefined>(undefined)
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [officerOptions, setOfficerOptions] = useState<any[]>([])
  const [roleOptions, setRoleOptions] = useState<any[]>([])

  useEffect(()=>{
    // load provinces (OrgUnit list filtered by PROVINCIAL_HQ)
    (async ()=>{
      const res = await adminApi.getOfficers()
      if(res && res.data){
        setOfficerOptions(res.data || [])
      }
      // roles for preview
      const rolesRes = await adminApi.getOfficers() // placeholder: reuse officers endpoint if roles endpoint missing
      if(rolesRes && rolesRes.data){
        setRoleOptions(rolesRes.data || [])
      }
      // provinces - call OrgUnit list via generic endpoint
      try{
        const orgs = await fetch('/api/auth/orgunits/').then(r=>r.json())
        setProvinces(orgs || [])
      }catch(e){
        // ignore
      }
    })()
  },[])

  const submitPHQ = async (e: React.FormEvent) =>{
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    const res = await adminActionsApi.createPHQ({ name: phqName, code: phqCode, code_short: phqShort })
    setLoading(false)
    if(res.data){
      setMessage(`PHQ created: ${res.data.code}`)
      setPhqName(''); setPhqCode(''); setPhqShort('')
    }else{
      setMessage(res.error || 'Failed to create PHQ')
    }
  }

  const submitStation = async (e: React.FormEvent) =>{
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    const res = await adminActionsApi.createStation({ name: stationName, code: stationCode, code_short: stationShort, parent: stationParent })
    setLoading(false)
    if(res.data){
      setMessage(`Station created: ${res.data.code}`)
      setStationName(''); setStationCode(''); setStationShort('')
    }else{
      setMessage(res.error || 'Failed to create station')
    }
  }

  const submitCreateAdmin = async (e: React.FormEvent) =>{
    e.preventDefault()
    if(!orgId){ setMessage('Select organization'); return }
    if(!officerId || !roleId){ setMessage('Select officer and role'); return }
    if(password.length < 8){ setMessage('Password should be at least 8 characters'); return }
    setLoading(true); setMessage(null)
    const res = await adminActionsApi.createOrgAdmin(orgId, { officer: officerId, role: roleId, password, email })
    setLoading(false)
    if(res.data){
      setMessage(`Admin created: ${res.data.username}`)
    }else{
      setMessage(res.error || 'Failed to create admin')
    }
  }

  return (
    <PrisonLayout title="Admin Wizard" description="NHQ / PHQ / Station administrative flows">
      <div className="max-w-4xl mx-auto">
        <div className="mb-4">
          <nav className="flex gap-2">
            <button className={`px-3 py-2 rounded ${tab==='phq'?'bg-[#0b4f2a] text-white':'bg-white'}`} onClick={()=>setTab('phq')}>Create PHQ</button>
            <button className={`px-3 py-2 rounded ${tab==='station'?'bg-[#0b4f2a] text-white':'bg-white'}`} onClick={()=>setTab('station')}>Create Station</button>
            <button className={`px-3 py-2 rounded ${tab==='createAdmin'?'bg-[#0b4f2a] text-white':'bg-white'}`} onClick={()=>setTab('createAdmin')}>Create Org Admin</button>
          </nav>
        </div>

        {message && <div className="mb-4 p-3 bg-yellow-50 text-sm border">{message}</div>}

        {tab==='phq' && (
          <form onSubmit={submitPHQ} className="space-y-3">
            <div>
              <label className="block mb-1">Name</label>
              <input className="w-full border px-2 py-1" value={phqName} onChange={e=>setPhqName(e.target.value)} />
            </div>
            <div>
              <label className="block mb-1">Code</label>
              <input className="w-full border px-2 py-1" value={phqCode} onChange={e=>setPhqCode(e.target.value)} />
            </div>
            <div>
              <label className="block mb-1">Short Code</label>
              <input className="w-full border px-2 py-1" value={phqShort} onChange={e=>setPhqShort(e.target.value)} />
            </div>
            <div className="pt-2">
              <button className="bg-blue-600 text-white px-4 py-2 rounded" type="submit" disabled={loading}>Create PHQ</button>
            </div>
          </form>
        )}

        {tab==='station' && (
          <form onSubmit={submitStation} className="space-y-3">
            <div>
              <label className="block mb-1">Name</label>
              <input className="w-full border px-2 py-1" value={stationName} onChange={e=>setStationName(e.target.value)} />
            </div>
            <div>
              <label className="block mb-1">Code</label>
              <input className="w-full border px-2 py-1" value={stationCode} onChange={e=>setStationCode(e.target.value)} />
            </div>
            <div>
              <label className="block mb-1">Short Code</label>
              <input className="w-full border px-2 py-1" value={stationShort} onChange={e=>setStationShort(e.target.value)} />
            </div>
            <div>
              <label className="block mb-1">Parent Province</label>
              <select className="w-full border px-2 py-1" value={stationParent || ''} onChange={e=>setStationParent(e.target.value?parseInt(e.target.value):undefined)}>
                <option value="">Select an option</option>
                {provinces.map((p:any)=>(<option key={p.id} value={p.id}>{p.name}</option>))}
              </select>
            </div>
            <div className="pt-2">
              <button className="bg-blue-600 text-white px-4 py-2 rounded" type="submit" disabled={loading}>Create Station</button>
            </div>
          </form>
        )}

        {tab==='createAdmin' && (
          <form onSubmit={submitCreateAdmin} className="space-y-3">
            <div>
              <label className="block mb-1">Organization (OrgUnit ID)</label>
              <input className="w-full border px-2 py-1" value={orgId||''} onChange={e=>setOrgId(e.target.value?parseInt(e.target.value):undefined)} />
            </div>
            <div>
              <label className="block mb-1">Officer ID</label>
              <input className="w-full border px-2 py-1" value={officerId||''} onChange={e=>setOfficerId(e.target.value?parseInt(e.target.value):undefined)} />
            </div>
            <div>
              <label className="block mb-1">Role ID</label>
              <input className="w-full border px-2 py-1" value={roleId||''} onChange={e=>setRoleId(e.target.value?parseInt(e.target.value):undefined)} />
            </div>
            <div>
              <label className="block mb-1">Password</label>
              <input type="password" className="w-full border px-2 py-1" value={password} onChange={e=>setPassword(e.target.value)} />
            </div>
            <div>
              <label className="block mb-1">Email (optional)</label>
              <input className="w-full border px-2 py-1" value={email} onChange={e=>setEmail(e.target.value)} />
            </div>
            <div className="pt-2">
              <button className="bg-blue-600 text-white px-4 py-2 rounded" type="submit" disabled={loading}>Create Admin</button>
            </div>
          </form>
        )}

      </div>
    </PrisonLayout>
  )
}
