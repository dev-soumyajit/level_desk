'use client';
import { Input } from '@/components/ui/input';
import type { ExportOptions } from '@/lib/types';
import { resolveLabelSize } from '@/lib/paper';
type Props={options:ExportOptions;disabled:boolean;onChange:(options:ExportOptions)=>void};
function shown(value:number|undefined,fallback:number):number|string{return value===undefined?fallback:Number.isFinite(value)?value:'';}
export default function PrintControls({options,disabled,onChange}:Props){
 return <details className="printer-details" open={options.paper==='custom'?true:undefined}><summary>Printer adjustments{(options.copies??1)>1&&<span className="copies-hint"> · {options.copies} copies</span>}</summary><fieldset className="advanced-print" disabled={disabled}>
 {options.paper==='custom'&&<div className="print-fields"><label>Label width (mm)<Input type="number" min={25} max={300} step={.1} value={shown(options.customWidthMm,100)} onChange={e=>onChange({...options,customWidthMm:e.target.valueAsNumber})}/></label><label>Label height (mm)<Input type="number" min={25} max={300} step={.1} value={shown(options.customHeightMm,150)} onChange={e=>onChange({...options,customHeightMm:e.target.valueAsNumber})}/></label></div>}
 <div className="print-fields"><label>Copies per label<Input type="number" min={1} max={10} value={shown(options.copies,1)} onChange={e=>onChange({...options,copies:e.target.valueAsNumber})}/></label><label>Inset / margin (mm)<Input type="number" min={0} max={10} step={.1} disabled={options.paper==='original'} value={shown(options.marginMm,2.1)} onChange={e=>onChange({...options,marginMm:e.target.valueAsNumber})}/></label></div>
 <label className="auto-rotate"><input type="checkbox" checked={options.autoRotate!==false} disabled={options.paper==='original'} onChange={e=>onChange({...options,autoRotate:e.target.checked})}/>Auto-rotate for the largest fit</label>
 {options.paper==='custom'&&<p className="field-help">Match your label pack and printer driver. {resolveLabelSize(options)?.map(n=>(n*25.4/72).toFixed(1)).join(' × ')} mm · Actual size / 100%.</p>}
 <p className="field-help">Only print preferences are saved on this device. Order data stays in this session.</p>
 </fieldset></details>;
}
