import {ArrowUpRight,Factory,Route,Truck,Trees} from 'lucide-react';
import './park.css';
export function ParkOverview({onEnter}:{onEnter:(shop:'stamping'|'welding')=>void}){
 return <div className="park-overlay">
  <section className="park-kpi-bar"><span className="park-kpi-intro"><Factory size={18}/><strong>智能制造园区<small>CAMPUS OPERATIONS</small></strong></span><div><small>可进入车间</small><b>02 <em>/ 04</em></b></div><div><small>设备在线 · 演示</small><b>100<em>%</em></b></div><div><small>冲压 / 焊装节拍</small><b>4<em>s</em> / 76<em>s</em></b></div><span className="park-demo">● 演示数据</span></section>
  <section className="park-intro"><span className="park-eyebrow">AXIOM INDUSTRIAL CAMPUS</span><h1>一座工厂，<br/>看见每一道工序。</h1><p>从钢卷到白车身，走进连续运行的<br/>汽车工厂数字孪生。</p><div className="park-legend"><span><i/>生产车间</span><span><i/>规划车间</span><span><Trees size={12}/>绿地与公共区域</span></div></section>
  <section className="park-entry-cards"><button data-testid="park-enter-stamping" onClick={()=>onEnter('stamping')}><span className="park-entry-number">01</span><div><small>STAMPING</small><strong>冲压车间</strong><span>钢卷 · 四序成形 · 装框发货</span></div><ArrowUpRight size={20}/></button><button data-testid="park-enter-welding" onClick={()=>onEnter('welding')}><span className="park-entry-number">02</span><div><small>BODY IN WHITE</small><strong>焊装车间</strong><span>22 台机器人 · 八工位协同</span></div><ArrowUpRight size={20}/></button></section>
  <aside className="park-map-key"><span><Route size={13}/>制造物流环线</span><span><Truck size={13}/>货场 / 成品车场</span><small>点击厂房或下方入口，镜头飞入车间</small></aside>
 </div>
}
