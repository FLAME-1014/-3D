import {create} from 'zustand';
export type Shop = 'park'|'stamping'|'welding';
export type Quality = 'smooth'|'balanced'|'fine';
export interface UIState {shop:Shop;roof:boolean;dashboard:boolean;process:boolean;quality:Quality;station:number;selected:string|null;exploded:boolean;playing:boolean;speed:number;time:number;set:(patch:Partial<Omit<UIState,'set'>>)=>void}
const initial = new URLSearchParams(location.search).get('shop');
export const useUI = create<UIState>((set)=>({shop:initial==='stamping'||initial==='welding'?initial:'park',roof:false,dashboard:true,process:false,quality:'balanced',station:-1,selected:null,exploded:false,playing:true,speed:1,time:0,set:(patch)=>set(patch)}));
