'use client';
import {useEffect} from 'react';
import {useRouter} from 'next/navigation';
import {OPEN_TENBOT_EVENT} from '@/modules/tenbot/events';
export default function TenbotPage(){
 const router=useRouter();
 useEffect(()=>{window.dispatchEvent(new Event(OPEN_TENBOT_EVENT));router.replace('/my-work');},[router]);
 return <p className="p-6 text-sm text-slate-600">Opening TenBot in Messaging…</p>;
}
