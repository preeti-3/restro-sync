"use client";
import { useState,useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2,Loader2 } from "lucide-react";
import { acceptInvitation } from "@/app/actions/staff";
import { Button } from "@/components/ui/button";
export function AcceptInvite({token}:{token:string}){const[pending,start]=useTransition();const[error,setError]=useState("");const router=useRouter();return <div><Button className="w-full" size="lg" disabled={pending} onClick={()=>start(async()=>{const r=await acceptInvitation(token);if(r.error)setError(r.error);else router.push("/")})}>{pending?<Loader2 className="animate-spin"/>:<CheckCircle2/>}Accept invitation</Button>{error&&<p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}</div>}
