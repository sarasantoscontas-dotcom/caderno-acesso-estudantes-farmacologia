(()=>{'use strict';const $=s=>document.querySelector(s),profile=window.FARMA_PROFILE,store=profile.storage;const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const app=$('#app'),status=t=>$('#backupStatus').textContent=t;
const allowed=k=>/^farmacologia-(caderno-v1|academic-[a-z0-9-]+-v2|calculator-v1)$/.test(k);
$('#exportBackup').onclick=()=>{const email=profile.active();if(!email){status('Entre no caderno para baixar seus registros.');return}const prefix=profile.scopedKey(''),entries={};for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key.startsWith(prefix)){const base=key.slice(prefix.length);if(allowed(base))entries[base]=localStorage.getItem(key)}}const blob=new Blob([JSON.stringify({format:'caderno-farmacologia',version:1,email,exportedAt:new Date().toISOString(),entries},null,2)],{type:'application/json'});download(blob,'caderno-farmacologia-'+new Date().toISOString().slice(0,10)+'.json');status('Registros baixados. Os PDFs devem ser guardados também em seus arquivos originais.')};
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$('#importBackup').onclick=()=>{if(!profile.active()){status('Entre no caderno antes de restaurar.');return}$('#backupFile').click()};$('#backupFile').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>10*1024*1024)throw Error('Use um arquivo de até 10 MB.');const b=JSON.parse(await file.text());if(b.format!=='caderno-farmacologia'||b.version!==1||b.email!==profile.active()||!b.entries||typeof b.entries!=='object'||Array.isArray(b.entries))throw Error('Selecione um backup deste caderno e do mesmo e-mail.');const entries=Object.entries(b.entries);if(!entries.length)throw Error('O arquivo está sem registros.');for(const[k,v]of entries){if(!allowed(k)||typeof v!=='string')throw Error('Registro incompatível.');const obj=JSON.parse(v);if(!obj||typeof obj!=='object'||Array.isArray(obj))throw Error('Registro inválido.')}if(!confirm('Restaurar os registros deste backup? Os registros correspondentes serão substituídos.'))return;const before=entries.map(([k])=>[k,store.getItem(k)]);try{for(const[k,v]of entries)store.setItem(k,v)}catch(error){for(const[k,v]of before)v===null?store.removeItem(k):store.setItem(k,v);throw error}location.reload()}catch(error){status(error.message||'Não foi possível restaurar.')}finally{e.target.value=''}};
const num=v=>Number(String(v).trim().replace(',','.'));const fmt=v=>v.toLocaleString('pt-BR',{maximumFractionDigits:4});
function customShell(title,text){app.innerHTML=`<section class="page"><header class="farmacologia-tool-intro"><a href="#home">← Página principal</a><h1>${title}</h1><p>${text}</p></header><div id="FARMAToolContent"></div></section>`;$('#breadcrumbs').textContent='Farmacologia › '+title;return $('#FARMAToolContent')}
function calculators(){const root=customShell('Ferramentas de Estudo','Confira tempo, média ponderada e progresso. Informe valores positivos e unidades compatíveis.');let cached={};try{cached=JSON.parse(store.getItem('farmacologia-calculator-v1')||'{}')}catch{}const configs=[{id:'tempo',title:'Tempo de revisão',labels:['Quantidade de temas','Minutos por tema'],values:['4','25'],solve:([a,b])=>`Tempo: ${fmt(a*b)} minutos\n${fmt(a*b/60)} horas de estudo, antes das pausas.`},{id:'media',title:'Média de duas avaliações',labels:['Primeira nota','Peso da primeira nota','Segunda nota','Peso da segunda nota'],values:['8','2','7','3'],solve:([a,b,c,d])=>`Média ponderada: ${fmt((a*b+c*d)/(b+d))}\nSoma dos produtos dividida pela soma dos pesos.`},{id:'progresso',title:'Progresso das atividades',labels:['Atividades concluídas','Total de atividades'],values:['6','10'],solve:([a,b])=>`Progresso: ${fmt(100*a/b)}%\n${fmt(a)} de ${fmt(b)} atividades.`},{id:'distribuicao',title:'Distribuir blocos de estudo',labels:['Minutos disponíveis','Número de blocos'],values:['120','4'],solve:([a,b])=>`Cada bloco: ${fmt(a/b)} minutos\nReserve as pausas fora do tempo informado.`}];root.innerHTML='<div class="farmacologia-calc-grid">'+configs.map(c=>`<section class="farmacologia-panel"><h2>${c.title}</h2><form class="farmacologia-form" data-calc="${c.id}">${c.labels.map((l,i)=>`<label>${l}<input type="text" inputmode="decimal" required name="v${i}" value="${escape(cached[c.id]?.[i]??c.values[i])}"></label>`).join('')}<button type="submit">Conferir resultado</button><output aria-live="polite"></output></form></section>`).join('')+'</div>';for(const form of root.querySelectorAll('[data-calc]'))form.onsubmit=e=>{e.preventDefault();const c=configs.find(x=>x.id===form.dataset.calc),inputs=[...form.querySelectorAll('input')],vals=inputs.map(x=>num(x.value));if(vals.some(x=>!Number.isFinite(x)||x<=0)){form.querySelector('output').textContent='Preencha todos os valores com números positivos.';return}if(c.id==='progresso'&&vals[0]>vals[1]){form.querySelector('output').textContent='O número concluído não pode superar o total.';return}form.querySelector('output').textContent=c.solve(vals);cached[c.id]=inputs.map(x=>x.value);store.setItem('farmacologia-calculator-v1',JSON.stringify(cached))}}
let dbPromise;function db(){if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{const req=indexedDB.open('farmacologia-pdf-library-v1',1);req.onupgradeneeded=()=>req.result.createObjectStore('files',{keyPath:'id'});req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});return dbPromise}async function fileRequest(mode,action){const conn=await db();return new Promise((resolve,reject)=>{const tx=conn.transaction('files',mode),req=action(tx.objectStore('files'));let result;req.onsuccess=()=>result=req.result;tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('A operação não foi concluída.'))})}
async function pdfs(){const root=customShell('Biblioteca de PDFs','Guarde PDFs de estudo, enunciados e entregas neste dispositivo. Os arquivos ficam neste navegador e não são incluídos no backup JSON dos registros; mantenha também seus originais.');root.innerHTML='<section class="farmacologia-panel"><h2>Meus materiais</h2><form class="farmacologia-form" id="FARMAPdfForm"><label>Selecionar PDF (até 10 MB)<input id="FARMAPdfFile" type="file" accept="application/pdf,.pdf" required></label><label>Disciplina ou pasta<input id="FARMAPdfFolder" type="text" maxlength="100" placeholder="Ex.: Farmacologia geral"></label><button type="submit">Guardar PDF</button><output id="FARMAPdfStatus" aria-live="polite"></output></form><label class="farmacologia-form">Buscar meus arquivos<input id="FARMAPdfSearch" class="farmacologia-file-search" type="search" placeholder="Nome ou disciplina"></label><div class="farmacologia-files-list" id="FARMAFilesList"></div></section>';const feedback=$('#FARMAPdfStatus');let files=[];const render=()=>{const list=$('#FARMAFilesList');if(!list)return;const q=$('#FARMAPdfSearch').value.toLocaleLowerCase('pt-BR');const hits=files.filter(f=>(f.name+' '+f.folder).toLocaleLowerCase('pt-BR').includes(q));list.innerHTML=hits.length?hits.map(f=>`<article class="farmacologia-file-row"><div><strong>${escape(f.name)}</strong><small>${escape(f.folder||'Sem pasta')} · ${fmt(f.size/1024)} KB</small></div><button data-pdf-download="${escape(f.id)}">Baixar</button><button data-pdf-delete="${escape(f.id)}">Remover</button></article>`).join(''):'<p>Seus PDFs aparecerão aqui depois de adicionados.</p>';for(const b of list.querySelectorAll('[data-pdf-download]'))b.onclick=()=>{const f=files.find(x=>x.id===b.dataset.pdfDownload);download(f.blob,f.name)};for(const b of list.querySelectorAll('[data-pdf-delete]'))b.onclick=async()=>{const f=files.find(x=>x.id===b.dataset.pdfDelete);if(!confirm('Remover este PDF da biblioteca? Guarde o arquivo original antes de continuar.'))return;try{await fileRequest('readwrite',s=>s.delete(f.id));files=files.filter(x=>x.id!==f.id);render()}catch{feedback.textContent='Não foi possível remover o arquivo.'}}};try{files=(await fileRequest('readonly',s=>s.getAll())).filter(f=>f.profile===profile.active());render()}catch{feedback.textContent='O navegador não permitiu abrir a biblioteca de arquivos.'}$('#FARMAPdfSearch').oninput=render;$('#FARMAPdfForm').onsubmit=async e=>{e.preventDefault();const file=$('#FARMAPdfFile').files[0];if(!file)return;if(file.size>10*1024*1024||!file.name.toLowerCase().endsWith('.pdf')){feedback.textContent='Selecione um PDF de até 10 MB.';return}try{const signature=new TextDecoder().decode(await file.slice(0,5).arrayBuffer());if(signature!=='%PDF-')throw Error('Este arquivo não foi reconhecido como PDF.');const rec={id:crypto.randomUUID(),profile:profile.active(),name:file.name,folder:$('#FARMAPdfFolder').value.trim(),size:file.size,blob:file};await fileRequest('readwrite',s=>s.put(rec));files.push(rec);render();feedback.textContent='PDF guardado na sua biblioteca.';$('#FARMAPdfFile').value=''}catch(error){feedback.textContent=error.message||'Não foi possível guardar o PDF.'}}}
const questions=[
  [
    "Qual explicação corresponde a fármaco, medicamento e alvo?",
    [
      "Fármaco é uma substância estudada por seus efeitos biológicos; medicamento é um produto com composição, forma e finalidade definidas. O alvo molecular participa da explicação do efeito.",
      "O néfron apresenta segmentos com permeabilidades e transportadores distintos. A distribuição desses mecanismos permite relacionar local de ação e alterações na excreção de água e solutos.",
      "Citocinas formam redes de comunicação entre células e tecidos. Interferir em um mediador ou receptor altera partes de uma rede, com efeitos que dependem do contexto biológico."
    ],
    0,
    "Fármaco é uma substância estudada por seus efeitos biológicos; medicamento é um produto com composição, forma e finalidade definidas. O alvo molecular participa da explicação do efeito. Receptores, canais, enzimas e transportadores representam classes distintas de alvos. Uma substância pode interagir com mais de um alvo, e o efeito observado depende também do sistema biológico."
  ],
  [
    "Qual explicação corresponde a biodisponibilidade e primeira passagem?",
    [
      "A insulina atua por receptor com atividade tirosina-quinase e regula processos metabólicos em tecidos diferentes. Captação de glicose, síntese e armazenamento respondem a vias integradas.",
      "Biodisponibilidade descreve a fração da substância que alcança a circulação sistêmica de forma inalterada. A absorção intestinal e a eliminação pré-sistêmica contribuem para seu valor.",
      "Processos de replicação, reparo e divisão celular oferecem alvos para substâncias antineoplásicas. Sensibilidade depende de características celulares e não apenas da velocidade de proliferação."
    ],
    1,
    "Biodisponibilidade descreve a fração da substância que alcança a circulação sistêmica de forma inalterada. A absorção intestinal e a eliminação pré-sistêmica contribuem para seu valor. Solubilidade, permeabilidade, formulação e metabolismo intestinal ou hepático podem alterar a exposição. Absorção e biodisponibilidade são relacionadas, mas não descrevem exatamente o mesmo processo."
  ],
  [
    "Qual explicação corresponde a agonismo e eficácia?",
    [
      "O calibre das vias aéreas resulta da interação entre músculo liso, controle neural e mediadores locais. Broncodilatação e modificação da inflamação representam objetivos mecanísticos distintos.",
      "Hemostasia envolve adesão e ativação plaquetária, geração de trombina e formação de fibrina em processos integrados. Antiagregação e anticoagulação modificam componentes diferentes.",
      "Agonistas promovem respostas por meio de receptores; eficácia descreve sua capacidade de gerar efeito em um sistema. Afinidade e eficácia são propriedades conceitualmente distintas."
    ],
    2,
    "Agonistas promovem respostas por meio de receptores; eficácia descreve sua capacidade de gerar efeito em um sistema. Afinidade e eficácia são propriedades conceitualmente distintas. Agonistas parciais podem produzir resposta máxima menor no mesmo sistema, apesar de se ligarem ao receptor. Reserva receptora e acoplamento modificam a resposta observada."
  ],
  [
    "Qual explicação corresponde a genótipo e fenótipo metabólico?",
    [
      "Variantes genéticas podem modificar expressão ou função de proteínas relacionadas a medicamentos. A tradução de genótipo em fenótipo depende do gene, das variantes e do contexto.",
      "A secreção de ácido depende de células parietais e de sinais neurais, hormonais e parácrinos. Receptores e a bomba de prótons ocupam posições diferentes nessa regulação.",
      "Perigo é a capacidade de produzir dano; risco considera a possibilidade desse dano em condições de exposição. Via, duração, intensidade e características do organismo modificam a avaliação."
    ],
    0,
    "Variantes genéticas podem modificar expressão ou função de proteínas relacionadas a medicamentos. A tradução de genótipo em fenótipo depende do gene, das variantes e do contexto. Enzimas, transportadores e alvos podem ser afetados. Interações e condições clínicas também alteram o fenótipo observado, impedindo uma leitura puramente determinista da informação genética."
  ],
  [
    "Qual explicação corresponde a fases de biotransformação?",
    [
      "Antibacterianos podem interferir em estruturas ou processos bacterianos, como parede celular e ribossomos. Diferenciar alvos ajuda a compreender seletividade, espectro e mecanismos de resistência.",
      "Biotransformação reúne reações que modificam substâncias e seus metabólitos. Oxidação, redução e hidrólise são frequentemente agrupadas na fase I; conjugação integra muitos processos de fase II.",
      "Evento adverso é uma ocorrência indesejada temporalmente associada ao uso; reação adversa pressupõe avaliação da possibilidade de relação causal. Os termos cumprem funções diferentes na vigilância."
    ],
    1,
    "Biotransformação reúne reações que modificam substâncias e seus metabólitos. Oxidação, redução e hidrólise são frequentemente agrupadas na fase I; conjugação integra muitos processos de fase II. As etapas não formam sequência obrigatória. Produtos podem ser ativos, inativos ou reativos, e as propriedades resultantes influenciam distribuição e eliminação."
  ],
  [
    "Qual explicação corresponde a interações de disposição?",
    [
      "Entrada, processamento, replicação e liberação oferecem pontos de interferência que variam entre vírus. A presença de um alvo em um grupo não implica sua existência funcional em outro.",
      "A forma farmacêutica organiza a apresentação da substância e pode modificar sua liberação. Desintegração, dissolução e absorção são etapas relacionadas, mas conceitualmente diferentes.",
      "Interações farmacocinéticas alteram absorção, distribuição, metabolismo ou eliminação. A identificação do mecanismo ajuda a compreender por que exposição e tempo de resposta podem mudar."
    ],
    2,
    "Interações farmacocinéticas alteram absorção, distribuição, metabolismo ou eliminação. A identificação do mecanismo ajuda a compreender por que exposição e tempo de resposta podem mudar. Transportadores, enzimas e propriedades do ambiente gastrointestinal são mecanismos diferentes. A relevância depende da magnitude da alteração e da relação entre exposição e efeito."
  ],
  [
    "Qual explicação corresponde a transmissão colinérgica?",
    [
      "A acetilcolina atua em receptores nicotínicos e muscarínicos, com distribuição e sinalização diferentes. Síntese, liberação e remoção organizam o ciclo da neurotransmissão.",
      "Fungos são eucariotos com componentes de membrana e parede que diferem das células humanas. Ergosterol e determinados polímeros da parede oferecem alvos de estudo farmacológico.",
      "Randomização distribui participantes entre grupos por procedimento aleatório e reduz confundimento em expectativa. Seu efeito depende também da execução e da preservação do desenho do estudo."
    ],
    0,
    "A acetilcolina atua em receptores nicotínicos e muscarínicos, com distribuição e sinalização diferentes. Síntese, liberação e remoção organizam o ciclo da neurotransmissão. Receptores nicotínicos são canais ativados por ligante; muscarínicos se acoplam a proteínas G. Localização e subtipo ajudam a explicar respostas específicas de cada tecido."
  ],
  [
    "Qual explicação corresponde a gaba, glutamato e excitabilidade?",
    [
      "Citocinas formam redes de comunicação entre células e tecidos. Interferir em um mediador ou receptor altera partes de uma rede, com efeitos que dependem do contexto biológico.",
      "GABA e glutamato participam de redes com funções inibitórias e excitatórias predominantes, respectivamente. A resposta depende do receptor, dos gradientes iônicos e do estado da célula.",
      "Informações sobre medicamentos precisam de fonte, data, população e contexto. Documentos regulatórios, estudos e bases de alvos respondem a perguntas diferentes e devem ser lidos conforme sua finalidade."
    ],
    1,
    "GABA e glutamato participam de redes com funções inibitórias e excitatórias predominantes, respectivamente. A resposta depende do receptor, dos gradientes iônicos e do estado da célula. Receptores ionotrópicos e metabotrópicos modificam condutância ou sinalização intracelular por caminhos diferentes. Modulação alostérica não equivale à ativação direta do sítio do neurotransmissor."
  ],
  [
    "Qual explicação corresponde a prostanoides e ciclo-oxigenases?",
    [
      "Processos de replicação, reparo e divisão celular oferecem alvos para substâncias antineoplásicas. Sensibilidade depende de características celulares e não apenas da velocidade de proliferação.",
      "Fármaco é uma substância estudada por seus efeitos biológicos; medicamento é um produto com composição, forma e finalidade definidas. O alvo molecular participa da explicação do efeito.",
      "Prostanoides derivam do metabolismo do ácido araquidônico e participam de funções fisiológicas e inflamatórias. As ciclo-oxigenases integram essa via e apresentam expressão dependente de contexto."
    ],
    2,
    "Prostanoides derivam do metabolismo do ácido araquidônico e participam de funções fisiológicas e inflamatórias. As ciclo-oxigenases integram essa via e apresentam expressão dependente de contexto. Modificar a via altera múltiplos mediadores, não apenas um sinal doloroso. Efeitos em mucosa, rim, plaquetas e outros tecidos ajudam a compreender a diversidade de consequências."
  ],
  [
    "Qual explicação corresponde a sistema renina-angiotensina?",
    [
      "O sistema renina-angiotensina participa do controle vascular e hidroeletrolítico por uma sequência de mediadores e receptores. Interferências em etapas diferentes não são mecanicamente idênticas.",
      "Hemostasia envolve adesão e ativação plaquetária, geração de trombina e formação de fibrina em processos integrados. Antiagregação e anticoagulação modificam componentes diferentes.",
      "Biodisponibilidade descreve a fração da substância que alcança a circulação sistêmica de forma inalterada. A absorção intestinal e a eliminação pré-sistêmica contribuem para seu valor."
    ],
    0,
    "O sistema renina-angiotensina participa do controle vascular e hidroeletrolítico por uma sequência de mediadores e receptores. Interferências em etapas diferentes não são mecanicamente idênticas. Produção de angiotensinas, ação receptora e secreção de aldosterona articulam respostas. Retroalimentação e vias alternativas influenciam o efeito de modificar um ponto do sistema."
  ]
];let qi=0;function quizzes(){const root=customShell('Quizzes de Farmacologia','Responda, confira a explicação e avance. As perguntas retomam conceitos presentes na biblioteca do caderno.');const q=questions[qi];root.innerHTML=`<section class="farmacologia-panel"><p>Questão ${qi+1} de ${questions.length}</p><h2 class="farmacologia-question">${escape(q[0])}</h2><div class="farmacologia-quiz-options">${q[1].map((a,i)=>`<button data-choice="${i}">${escape(a)}</button>`).join('')}</div><div class="farmacologia-feedback" role="status" aria-live="polite"></div><button class="farmacologia-main-button" id="FARMAQuizNext" hidden>${qi===questions.length-1?'Recomeçar':'Próxima questão'}</button></section>`;let answered=false;for(const b of root.querySelectorAll('[data-choice]'))b.onclick=()=>{if(answered)return;answered=true;for(const btn of root.querySelectorAll('[data-choice]')){btn.disabled=true;if(+btn.dataset.choice===q[2])btn.classList.add('correct')}if(+b.dataset.choice!==q[2])b.classList.add('incorrect');root.querySelector('.farmacologia-feedback').textContent=q[3];$('#FARMAQuizNext').hidden=false};$('#FARMAQuizNext').onclick=()=>{qi=(qi+1)%questions.length;quizzes()}}
function route(){const id=location.hash.split('/')[1];if(location.hash.startsWith('#module/')){if(id==='calculadoras')calculators();if(id==='biblioteca-pdfs')pdfs();if(id==='quizzes')quizzes()}if(location.hash.startsWith('#summary/')&&!$('#FARMAPrintSummary')){const actions=$('.article-actions');if(actions){const b=document.createElement('button');b.id='FARMAPrintSummary';b.className='farmacologia-print';b.textContent='Imprimir / salvar PDF';b.onclick=()=>window.print();actions.append(b)}}}window.addEventListener('hashchange',route);route();
document.addEventListener('keydown',e=>{const modal=!$('#profileModal').hidden?$('#profileModal'):!$('#searchModal').hidden?$('#searchModal'):null;if(!modal)return;if(e.key==='Escape'){if(modal.id==='searchModal'){modal.hidden=true;$('#searchBtn').focus()}else if(profile.active()){$('#profileClose').click();$('#profileBtn').focus()}}if(e.key==='Tab'){const els=[...modal.querySelectorAll('button,input,a[href],select,textarea')].filter(x=>!x.hidden&&!x.disabled&&x.offsetParent!==null);if(!els.length)return;const first=els[0],last=els[els.length-1];if(e.shiftKey&&(document.activeElement===first||!modal.contains(document.activeElement))){e.preventDefault();last.focus()}else if(!e.shiftKey&&(document.activeElement===last||!modal.contains(document.activeElement))){e.preventDefault();first.focus()}}});window.FARMA_TOOLS_TEST={questions};})();
