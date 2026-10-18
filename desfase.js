/* ═══════════ DESFASE DE HORÓMETROS · común a todas las pestañas ═══════════
   Tabla desfase_horometro (se registra en Equipos → botón ⟲).
   Cada fila: el día "fecha" el horómetro viejo marcaba hm_dia (horas máquina)
   y el panel nuevo quedó en panel_dia. Desfase = hm_dia − panel_dia.
   Regla: después del cambio, una lectura MENOR que hm_dia es del panel y se le
   suma el desfase; una igual o mayor ya está en horas máquina. La conversión
   es idempotente: convertir dos veces el mismo valor no lo cambia.
   Además se compara con lo esperado según el Maestro (último HR/KM + HR/día ×
   días): si no encaja ni como panel ni como horas máquina, se pregunta.     */
(function(){
  const N=s=>String(s??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  const f0=n=>Math.round(+n).toLocaleString('es-PE');
  const fd=v=>{if(!v)return'';const p=String(v).slice(0,10).split('-');return p.length===3?`${p[2]}/${p[1]}/${p[0].slice(2)}`:String(v);};
  const hoy=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);};
  const escA=s=>String(s??'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  const D={
    lista:[],
    async cargar(sb){
      try{const r=await sb.from('desfase_horometro').select('*').order('fecha'); this.lista=r.error?[]:(r.data||[]);}
      catch(_){this.lista=[];}
      return this.lista;
    },
    de(sap){const k=N(sap); return k?this.lista.filter(d=>N(d.cod_sap)===k):[];},
    en(sap,f){f=String(f||hoy()).slice(0,10); return this.de(sap).filter(d=>String(d.fecha)<=f).reduce((s,d)=>s+(+d.hm_dia-(+d.panel_dia||0)),0);},
    ref(sap,f){f=String(f||hoy()).slice(0,10); const L=this.de(sap).filter(d=>String(d.fecha)<=f); return L.length?Math.max(...L.map(d=>+d.hm_dia)):null;},
    /* tipo: normal (equipo sin desfase) · antes (fecha anterior al cambio) · panel · hm · duda */
    clasificar(sap,fIso,val,eq){
      if(val==null||val===''||!isFinite(+val))return {tipo:'normal',v:val};
      val=+val; fIso=String(fIso||hoy()).slice(0,10);
      if(!this.de(sap).length)return {tipo:'normal',v:val};
      const des=this.en(sap,fIso); if(!des)return {tipo:'antes',v:val};
      const ref=this.ref(sap,fIso);
      let tipo=val<ref?'panel':'hm';
      const res={des,ref,orig:val,exp:null};
      if(eq&&eq.hrkm_actual!=null&&eq.hrkm_actual!==''&&eq.fecha_lectura){
        let base=+eq.hrkm_actual; const fb=String(eq.fecha_lectura).slice(0,10);
        const rb=this.ref(sap,fb); if(rb!=null&&base<rb)base+=this.en(sap,fb);
        const dd=(new Date(fIso)-new Date(fb))/86400000, hd=+eq.hr_dia||0, km=eq.contador==='Km';
        const tol=(km?400:48)+Math.abs(dd)*(hd?hd*0.5:(km?200:12));
        if(hd)res.exp=base+hd*dd;
        const ok=x=>hd?Math.abs(x-res.exp)<=tol:(dd>=0?x>=base-tol:x<=base+tol);
        const v1=tipo==='panel'?val+des:val, v2=tipo==='panel'?val:val+des;
        if(!ok(v1)){ if(ok(v2))tipo=tipo==='panel'?'hm':'panel'; else tipo='duda'; }
      }
      return {...res,tipo,v:tipo==='panel'?val+des:val,panel:tipo==='panel'?val:null};
    },
    /* Devuelve {v, panel, tipo}. En caso de duda pregunta (Aceptar = panel). */
    decisiones:new Map(),          // respuestas a las dudas: no se vuelve a preguntar lo mismo
    convertir(sap,fIso,val,eq,etiqueta){
      const c=this.clasificar(sap,fIso,val,eq);
      if(c.tipo!=='duda')return c;
      const kd=N(sap)+'|'+String(fIso||'').slice(0,10)+'|'+(+val);
      if(this.decisiones.has(kd)){const esP=this.decisiones.get(kd);
        return esP?{...c,tipo:'panel',v:c.orig+c.des,panel:c.orig}:{...c,tipo:'hm',v:c.orig,panel:null};}
      const esPanel=confirm(`⟲ ${sap} · ${etiqueta||'lectura'} del ${fd(fIso)}\nHorómetro anotado: ${f0(c.orig)}\n\n`
        +`Este equipo tiene desfase de horómetro (+${f0(c.des)}) y el valor no coincide con lo esperado`
        +(c.exp!=null?` (~${f0(c.exp)} horas máquina)`:'')+`.\n\n`
        +`Aceptar = es del PANEL → se guarda ${f0(c.orig+c.des)}\nCancelar = ya está en HORAS MÁQUINA → se guarda ${f0(c.orig)}`);
      this.decisiones.set(kd,esPanel);
      return esPanel?{...c,tipo:'panel',v:c.orig+c.des,panel:c.orig}:{...c,tipo:'hm',v:c.orig,panel:null};
    },
    /* Convierte una lista de filas; pregunta una sola vez por equipo + fecha + valor.
       Devuelve un resumen {panel, hm, duda}. */
    convertirFilas(filas,{sap,fecha,campo,eqDe,etiqueta,alPanel}){
      const res={panel:0,hm:0,duda:0}, memo=new Map();
      filas.forEach(r=>{
        const s=typeof sap==='function'?sap(r):r[sap]; if(!s||!this.de(s).length)return;
        const v=r[campo]; if(v==null||v==='')return;
        const f=typeof fecha==='function'?fecha(r):r[fecha];
        const k=N(s)+'|'+f+'|'+v;
        let c=memo.get(k);
        if(!c){ const pre=this.clasificar(s,f,v,eqDe?eqDe(s):null); if(pre.tipo==='duda')res.duda++;
          c=pre.tipo==='duda'?this.convertir(s,f,v,eqDe?eqDe(s):null,etiqueta):pre; memo.set(k,c); }
        if(c.tipo==='panel'){ r[campo]=c.v; res.panel++; if(alPanel)alPanel(r,c); }
        else if(c.tipo==='hm')res.hm++;
      });
      return res;
    },
    nota(sap){
      const L=this.de(sap); if(!L.length)return '';
      return 'Horómetro con desfase (los valores están en horas máquina)\n'
        +L.map(d=>`Cambio ${fd(d.fecha)}: ${f0(d.hm_dia)} → ${f0(d.panel_dia||0)} (+${f0(d.hm_dia-(d.panel_dia||0))})${d.motivo?' · '+d.motivo:''}`).join('\n');
    },
    /* marca ⟲ con nota; si se pasa el valor y la fecha, muestra también la lectura de panel */
    marca(sap,val,fIso){
      if(!this.de(sap).length)return '';
      let t=this.nota(sap);
      if(val!=null&&val!==''&&isFinite(+val)){const des=this.en(sap,fIso);
        if(des&&+val>=this.ref(sap,fIso))t=`Panel: ${f0(+val-des)} · Horas máquina: ${f0(+val)}\n`+t;}
      return `<span title="${escA(t)}" style="display:inline-block;margin-left:3px;background:#E6E9F7;color:#334281;border-radius:5px;padding:0 4px;font-size:10.5px;font-weight:800;cursor:help">⟲</span>`;
    },
    resumen(r){return (r.panel||r.hm)?`⟲ Equipos con desfase de horómetro: ${r.panel} lectura(s) de panel convertidas a horas máquina · ${r.hm} ya venían en horas máquina`:'';}
  };
  window.GLLR_DSF=D;
})();
