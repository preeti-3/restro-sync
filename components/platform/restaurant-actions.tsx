"use client";
import { useState,useTransition } from "react";
import { Ban,CheckCircle2,Loader2,RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setRestaurantStatus } from "@/app/actions/platform";
export function RestaurantActions({id,status}:{id:string;status:string}){const[pending,start]=useTransition();const[error,setError]=useState("");const next=status==="ACTIVE"?"SUSPENDED":"ACTIVE";return <div><Button size="sm" variant={next==="SUSPENDED"?"destructive":"outline"} disabled={pending} onClick={()=>start(async()=>{const result=await setRestaurantStatus(id,next);setError(result.error??"")})}>{pending?<Loader2 className="animate-spin"/>:next==="SUSPENDED"?<Ban/>:status==="PENDING"?<CheckCircle2/>:<RefreshCw/>}{next==="SUSPENDED"?"Suspend":status==="PENDING"?"Approve":"Reactivate"}</Button>{error&&<p className="mt-1 text-xs text-red-600">{error}</p>}</div>}
