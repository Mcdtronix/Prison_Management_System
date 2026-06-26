import React, { useState, useEffect } from 'react'
import { PrisonLayout } from '@/components/PrisonLayout'
import { adminActionsApi, adminApi } from '@/lib/api'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'

const phqSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters long"),
  code: z.string().min(2, "Code must be at least 2 characters long"),
  code_short: z.string().min(2, "Short code must be at least 2 characters long").max(10, "Short code is too long")
})

const stationSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters long"),
  code: z.string().min(2, "Code must be at least 2 characters long"),
  code_short: z.string().min(2, "Short code must be at least 2 characters long").max(10, "Short code is too long"),
  parent: z.string().min(1, "Parent province is required")
})

const adminSchema = z.object({
  orgId: z.string().min(1, "Organization is required"),
  officerId: z.string().min(1, "Officer ID is required"),
  roleId: z.string().min(1, "Role ID is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  email: z.string().email("Invalid email").optional().or(z.literal(''))
})

export default function AdminWizard(){
  const [tab, setTab] = useState<'phq'|'station'|'createAdmin'>('phq')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null)

  const [provinces, setProvinces] = useState<any[]>([])

  const phqForm = useForm<z.infer<typeof phqSchema>>({
    resolver: zodResolver(phqSchema),
    defaultValues: { name: '', code: '', code_short: '' },
    mode: 'onChange'
  })

  const stationForm = useForm<z.infer<typeof stationSchema>>({
    resolver: zodResolver(stationSchema),
    defaultValues: { name: '', code: '', code_short: '', parent: '' },
    mode: 'onChange'
  })

  const adminForm = useForm<z.infer<typeof adminSchema>>({
    resolver: zodResolver(adminSchema),
    defaultValues: { orgId: '', officerId: '', roleId: '', password: '', email: '' },
    mode: 'onChange'
  })

  useEffect(()=>{
    (async ()=>{
      try{
        const orgs = await fetch('/api/auth/orgunits/').then(r=>r.json())
        setProvinces(orgs || [])
      }catch(e){}
    })()
  },[])

  const submitPHQ = async (data: z.infer<typeof phqSchema>) =>{
    setLoading(true); setMessage(null)
    const res = await adminActionsApi.createPHQ(data)
    setLoading(false)
    if(res.data){
      setMessage({type: 'success', text: `PHQ created: ${res.data.code}`})
      phqForm.reset()
    } else {
      setMessage({type: 'error', text: res.error || 'Failed to create PHQ'})
    }
  }

  const submitStation = async (data: z.infer<typeof stationSchema>) =>{
    setLoading(true); setMessage(null)
    const payload = { ...data, parent: parseInt(data.parent) }
    const res = await adminActionsApi.createStation(payload)
    setLoading(false)
    if(res.data){
      setMessage({type: 'success', text: `Station created: ${res.data.code}`})
      stationForm.reset()
    } else {
      setMessage({type: 'error', text: res.error || 'Failed to create station'})
    }
  }

  const submitCreateAdmin = async (data: z.infer<typeof adminSchema>) =>{
    setLoading(true); setMessage(null)
    const payload = { officer: parseInt(data.officerId), role: parseInt(data.roleId), password: data.password, email: data.email || undefined }
    const res = await adminActionsApi.createOrgAdmin(parseInt(data.orgId), payload)
    setLoading(false)
    if(res.data){
      setMessage({type: 'success', text: `Admin created: ${res.data.username}`})
      adminForm.reset()
    } else {
      setMessage({type: 'error', text: res.error || 'Failed to create admin'})
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

        {message && (
          <div className={`mb-4 p-3 text-sm border rounded ${message.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
            {message.text}
          </div>
        )}

        <div className="bg-white p-6 rounded shadow-sm border">
          {tab==='phq' && (
            <Form {...phqForm}>
              <form onSubmit={phqForm.handleSubmit(submitPHQ)} className="space-y-4 max-w-md">
                <FormField control={phqForm.control} name="name" render={({field}) => (
                  <FormItem><FormLabel>PHQ Name</FormLabel><FormControl><Input placeholder="e.g. Lusaka Provincial HQ" {...field}/></FormControl><FormMessage/></FormItem>
                )}/>
                <FormField control={phqForm.control} name="code" render={({field}) => (
                  <FormItem><FormLabel>Code</FormLabel><FormControl><Input placeholder="e.g. LSK_PHQ" {...field}/></FormControl><FormMessage/></FormItem>
                )}/>
                <FormField control={phqForm.control} name="code_short" render={({field}) => (
                  <FormItem><FormLabel>Short Code</FormLabel><FormControl><Input placeholder="e.g. LSK" {...field}/></FormControl><FormMessage/></FormItem>
                )}/>
                <Button type="submit" disabled={!phqForm.formState.isValid || loading}>Create PHQ</Button>
              </form>
            </Form>
          )}

          {tab==='station' && (
            <Form {...stationForm}>
              <form onSubmit={stationForm.handleSubmit(submitStation)} className="space-y-4 max-w-md">
                <FormField control={stationForm.control} name="name" render={({field}) => (
                  <FormItem><FormLabel>Station Name</FormLabel><FormControl><Input placeholder="e.g. Lusaka Central" {...field}/></FormControl><FormMessage/></FormItem>
                )}/>
                <FormField control={stationForm.control} name="code" render={({field}) => (
                  <FormItem><FormLabel>Code</FormLabel><FormControl><Input placeholder="e.g. LSK_CENTRAL" {...field}/></FormControl><FormMessage/></FormItem>
                )}/>
                <FormField control={stationForm.control} name="code_short" render={({field}) => (
                  <FormItem><FormLabel>Short Code</FormLabel><FormControl><Input placeholder="e.g. LC" {...field}/></FormControl><FormMessage/></FormItem>
                )}/>
                <FormField control={stationForm.control} name="parent" render={({field}) => (
                  <FormItem>
                    <FormLabel>Parent Province</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select province"/></SelectTrigger></FormControl>
                      <SelectContent>
                        {provinces.filter(p=>p.unit_type==='PROVINCIAL_HQ').map(p=>(
                          <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage/>
                  </FormItem>
                )}/>
                <Button type="submit" disabled={!stationForm.formState.isValid || loading}>Create Station</Button>
              </form>
            </Form>
          )}

          {tab==='createAdmin' && (
            <Form {...adminForm}>
              <form onSubmit={adminForm.handleSubmit(submitCreateAdmin)} className="space-y-4 max-w-md">
                <FormField control={adminForm.control} name="orgId" render={({field}) => (
                  <FormItem>
                    <FormLabel>Organization (OrgUnit ID)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select organization"/></SelectTrigger></FormControl>
                      <SelectContent>
                        {provinces.map(p=>(
                          <SelectItem key={p.id} value={String(p.id)}>{p.name} ({p.unit_type})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage/>
                  </FormItem>
                )}/>
                <FormField control={adminForm.control} name="officerId" render={({field}) => (
                  <FormItem><FormLabel>Officer ID (Service Number)</FormLabel><FormControl><Input placeholder="e.g. 1" {...field}/></FormControl><FormMessage/></FormItem>
                )}/>
                <FormField control={adminForm.control} name="roleId" render={({field}) => (
                  <FormItem><FormLabel>Role ID</FormLabel><FormControl><Input placeholder="e.g. 1" {...field}/></FormControl><FormMessage/></FormItem>
                )}/>
                <FormField control={adminForm.control} name="password" render={({field}) => (
                  <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" placeholder="Min 8 chars" {...field}/></FormControl><FormMessage/></FormItem>
                )}/>
                <FormField control={adminForm.control} name="email" render={({field}) => (
                  <FormItem><FormLabel>Email (Optional)</FormLabel><FormControl><Input type="email" placeholder="admin@example.com" {...field}/></FormControl><FormMessage/></FormItem>
                )}/>
                <Button type="submit" disabled={!adminForm.formState.isValid || loading}>Create Admin</Button>
              </form>
            </Form>
          )}
        </div>
      </div>
    </PrisonLayout>
  )
}
