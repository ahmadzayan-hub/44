const state = {
  language: 'ar', compact: false,
  telemetry: { active: true, ticks: 0, timer: null, eventId: 0, lastSignalAt: null, lastSignalLabel: null },
  kpis: [
    { value: '98.522', base: 98.522, unit: '%', precision: 3, status: 'high', ar: 'التوافر التشغيلي', en: 'Operational availability', arTrend: 'أقل من النطاق التجريبي', enTrend: 'Below demo target', target: '≥ 99.5%' },
    { value: '04', base: 4, unit: '', precision: 0, status: 'good', ar: 'حالات العطل', en: 'Failure count', arTrend: 'ضمن الحد التجريبي', enTrend: 'At demo target', target: '≤ 4' },
    { value: '183.5', base: 183.5, unit: 'h', precision: 1, status: 'good', ar: 'متوسط الزمن بين الأعطال', en: 'Mean time between failures', arTrend: 'ضمن النطاق', enTrend: 'Within target', target: '≥ 120h' },
    { value: '2.75', base: 2.75, unit: 'h', precision: 2, status: 'critical', ar: 'متوسط زمن الإصلاح', en: 'Mean time to repair', arTrend: 'الخروق المتتالية: 3', enTrend: 'Third breach cycle', target: '≤ 2h' },
    { value: '03', base: 3, unit: 'WO', precision: 0, status: 'good', ar: 'الأعمال المتراكمة', en: 'Maintenance backlog', arTrend: 'ضمن الحد التجريبي', enTrend: 'Within demo limit', target: '≤ 5' },
  ],
  exceptions: [
    { id: 'DEC-042', severity: 'critical', ar: 'خروج متكرر لمؤشر MTTR', en: 'Persistent MTTR breach', arDetail: '2.75 ساعة مقابل حد تجريبي ≤ 2 ساعة. يفترض العرض التجريبي وجود خرقين سابقين للتصعيد.', enDetail: '2.75h against a synthetic demo threshold of ≤2h. The demonstration assumes two prior breaches for escalation.', arDecision: 'يلزم مراجعة مالك صيانة أو عقد مُسمى.', enDecision: 'Named maintenance or contract owner review is required.', arOwner: 'حوكمة الصيانة', enOwner: 'Maintenance governance', arDue: 'مراجعة خلال 4 ساعات', enDue: 'Review within 4 hours', evidence: 'Maximo Demo · WO-1001–WO-1004', arFresh: '4 سجلات مصدر · تحديث قبل 12 دقيقة', enFresh: '4 source records · refreshed 12 min ago' },
    { id: 'DEC-043', severity: 'high', ar: 'التوافر أقل من المستهدف التجريبي', en: 'Availability below demo target', arDetail: '98.522% مقابل حد تجريبي ≥ 99.5%. يجب التحقق من تصنيف وقت التوقف قبل اعتماد أي إجراء.', enDetail: '98.522% against a synthetic demo threshold of ≥99.5%. Validate downtime classification before approving any action.', arDecision: 'تحقق من تصنيف التوقف والإجراء التصحيحي.', enDecision: 'Validate downtime classification and corrective action.', arOwner: 'فريق الأداء', enOwner: 'Performance team', arDue: 'قرار قبل نهاية اليوم', enDue: 'Decision before close of day', evidence: 'Maximo Demo · KPI availability v1.0', arFresh: '4 سجلات مصدر · حالة جودة موثقة', enFresh: '4 source records · quality verified' },
    { id: 'DEC-044', severity: 'watch', ar: 'حجم أعمال الصيانة الوقائية المفتوحة', en: 'Open preventive maintenance workload', arDetail: 'أمرا عمل للصيانة الوقائية في حالة WAPPR ضمن العينة الاصطناعية.', enDetail: 'Two preventive maintenance work orders remain WAPPR in the synthetic sample.', arDecision: 'أكد الجدولة وتواريخ الاستحقاق.', enDecision: 'Confirm scheduling and due dates.', arOwner: 'تخطيط الصيانة', enOwner: 'Maintenance planning', arDue: 'متابعة خلال يوم عمل', enDue: 'Follow up within one business day', evidence: 'Maximo Demo · WO-1005–WO-1006', arFresh: 'سجلان مصدر · تحديث قبل 12 دقيقة', enFresh: '2 source records · refreshed 12 min ago' },
  ],
  assets: [
    { id: 'ATC-ZC-01', arClass: 'إشارات / تحكم آلي بالقطارات', enClass: 'Signalling / ATC', arLocation: 'خط المترو', enLocation: 'Metro line', open: 1, arSignal: 'متابعة', enSignal: 'Watch' },
    { id: 'ATC-ZC-02', arClass: 'إشارات / تحكم آلي بالقطارات', enClass: 'Signalling / ATC', arLocation: 'خط المترو', enLocation: 'Metro line', open: 0, arSignal: 'تكرار عالٍ للعطل', enSignal: 'High repeat failure' },
    { id: 'TRAM-APS-03', arClass: 'تغذية كهربائية', enClass: 'Traction power', arLocation: 'الترام', enLocation: 'Tram', open: 2, arSignal: 'توقف حرج', enSignal: 'Critical downtime' },
  ],
  agents: [
    { ar: 'وكيل جودة البيانات', en: 'Data Quality Agent', arState: 'جاهز', enState: 'Ready', arDetail: 'يتحقق من الاكتمال والطوابع الزمنية وجودة المصدر', enDetail: 'Validates completeness, timestamps, and source quality' },
    { ar: 'وكيل ذكاء الأصول', en: 'Asset Intelligence Agent', arState: 'جاهز', enState: 'Ready', arDetail: 'يفسر صحة الأصل ومحركات الأعطال', enDetail: 'Explains asset health and failure drivers' },
    { ar: 'وكيل مؤشرات الصيانة', en: 'Maintenance KPI Agent', arState: 'حتمي', enState: 'Deterministic', arDetail: 'يحسب الصيغ المعتمدة خارج نموذج اللغة', enDetail: 'Computes approved formulas outside the language model' },
    { ar: 'وكيل سياق العقد', en: 'Contract Context Agent', arState: 'جاهز', enState: 'Ready', arDetail: 'يربط أدلة KPI بالسياق التعاقدي المعتمد', enDetail: 'Maps KPI evidence to approved contract context' },
    { ar: 'وكيل التقارير', en: 'Reporting Agent', arState: 'بوابة بشرية', enState: 'Human gate', arDetail: 'يصوغ السرد بعد اعتماد KPI', enDetail: 'Drafts narrative after KPI approval' },
  ],
};

const en = {
  pilot:'Safe pilot mode', navControl:'Control Tower', navExceptions:'Exception Centre', navAssets:'Asset Intelligence', navContract:'Contract Performance', navReports:'Reports Workspace', navAgents:'Agent Workspace', guardrailTitle:'Decision safeguards', guardrailNav:'Read, analyse, and draft only', userName:'Ahmed Zaian', userRole:'Decision owner', search:'Search or open command', compact:'Compact view', eyebrow:'CONTROL TOWER · INTELLIGENT OPERATIONS', greeting:'Good morning, Ahmed', tagline:'Evidence-led operations, not impressions', synthetic:'Safe illustrative data for testing', updated:'Last updated', executiveView:'EXECUTIVE VIEW', heroTitle:'Today’s picture is clear.', heroText:'Move from exception to a clear decision with a complete trail for source, reviewer, and approval.', refresh:'Refresh view', scopeLabel:'Current scope', scopeRed:'Pilot scope · Red Line', scopeTram:'Pilot scope · Dubai Tram', scopeDepot:'Pilot scope · Al Qusais Depot', periodLabel:'Analysis window', periodMonth:'This month', period30:'Last 30 days', periodLocked:'Locked report period', boundaryTitle:'P0 boundary', boundaryText:'Read, analyse, and draft only. No operational control or autonomous external write.', priorityDecisions:'Priority decisions', priorityText:'Rank exceptions by consequence and urgency, then open evidence before any decision is approved.', viewAll:'View all', signalSummary:'Signal summary', signalText:'The priority now: protect decision clarity before increasing automation scale.', signalSource:'Based on a traceable illustrative pack', openBrief:'Open decision brief', openBriefText:'Evidence, assumptions, and approval status', performancePulse:'Performance pulse', performanceText:'The illustrative trajectory is stable, with one evidence-linked watch point.', availability:'Availability', watchPoint:'Watch point', week1:'Week 1', week2:'Week 2', week3:'Week 3', today:'Today', evidenceChain:'Evidence chain', evidenceText:'Trace a conclusion from narrative to metric, source record, and timestamp.', sourceRecord:'Source record', governedMetric:'Governed metric', pmBacklog:'PM backlog · v1.0', recommendationDraft:'Recommendation draft', awaitingReview:'Awaiting human review', safeWorkspace:'SAFEGUARDED WORKSPACE', agentWorkspace:'Agent workspace', agentText:'Request analysis, then inspect assumptions and evidence before using any draft.', waiting:'Waiting for your request', suggestedQuestions:'Suggested questions', qAttention:'What decision is required today?', qEvidence:'Check evidence completeness', qBreaches:'Show KPI breaches', qReport:'Is the monthly report ready?', agentPlaceholder:'Example: Summarise PM backlog drivers in the Red Line scope', runAnalysis:'Run safeguarded analysis', agentFooter:'No high-impact decision is released before named human approval.', priorityQueue:'PRIORITY QUEUE', exceptionCentre:'Exception Centre', maximoLinked:'MAXIMO-LINKED', assetIntelligence:'Asset Intelligence', sharedTruth:'SHARED CONTRACT TRUTH', contractPerformance:'Contract Performance', approvedData:'GENERATED FROM APPROVED DATA', reportingCentre:'Reporting Centre', governedAgents:'GOVERNED MULTI-AGENT SYSTEM', askRailmind:'ASK RAILMIND', decisionQuery:'Decision query', queryInitial:'Choose a decision question. Demo answers are deterministic and grounded in synthetic data.', decisionPack:'Decision pack', telemetryTitle:'Simulated live telemetry stream', telemetrySource:'Local simulation · no external connection', telemetryPaused:'Simulation paused', telemetryLast:'Last signal', telemetryReady:'Ready to start', telemetryPausedAt:'Paused', telemetryStop:'Pause stream', telemetryStart:'Resume stream', telemetryReset:'Simulation reset', telemetryEventPrefix:'TLM'
};
const ar = { details:'التفاصيل', action:'مطلوب إجراء', source:'المصدر', observed:'وقت الرصد', quality:'حالة الجودة', verified:'تم التحقق', recommendation:'التوصية المقترحة', governance:'حاجز الحوكمة', requestReview:'إرسال للمراجعة البشرية', reviewReady:'تم تجهيز الطلب للمراجعة البشرية فقط', reviewNote:'يتطلب الاعتماد اسم المراجع والدور والتوقيت قبل اعتبار المخرج جاهزاً.', noWrite:'لا ينفذ هذا العرض أي أمر عمل أو رسالة أو تغيير في نظام مصدر.', analysisReady:'مسودة جاهزة للمراجعة', working:'يجري تجهيز المسودة...', attention:'تتطلب ثلاثة عناصر الانتباه: خرق MTTR المتكرر، والتوافر الأدنى من الهدف التجريبي، وأمرا صيانة وقائية مفتوحان. كل النتائج مرتبطة بسجلات Maximo اصطناعية.', evidence:'اكتمال الأدلة في هذا العرض التجريبي موثق لكل KPI وسجل مصدر. لا يتعامل العرض مع بيانات تشغيلية أو تعاقدية حية.', breaches:'يوجد خرقان لمؤشرات تجريبية: التوافر 98.522% مقابل ≥99.5%، وMTTR عند 2.75 ساعة مقابل ≤2 ساعة.', report:'لا. التقرير الشهري ما زال في حالة مسودة، ويلزم اعتماد بشري مُسمى بسبب الاستثناء الحرج.', guardrail:'واجهة P0 للقراءة والتحليل والصياغة فقط. لا توجد كتابة خارجية تلقائية.', refreshed:'تم تحديث العرض التجريبي', compactOn:'تم تفعيل العرض المبسط', compactOff:'تم إلغاء العرض المبسط', notify:'لا توجد تنبيهات غير مقروءة في العرض التجريبي.', severity:{critical:'حرج',high:'مرتفع',watch:'متابعة',good:'ضمن النطاق'}, contractHeading:'الأداء الشهري · أغسطس 2026', contractText:'يوضح هذا النموذج الأولي طبقة ذكاء مشتركة بين المالك والمقاول. يجب استبدال بنود العقد والصيغ والحدود بتعريفات معتمدة رسمياً قبل الإنتاج.', reportMonthly:'تقرير الأداء الشهري', reportQuarterly:'المراجعة التنفيذية الفصلية', reportAnnual:'تقرير الأصول والعقد السنوي', reportDraft:'مسودة · مراجعة بشرية مطلوبة', reportNotGenerated:'لم يتم التوليد', reportSummary:'ملخص تنفيذي حتمي', reportBody:'ثلاثة من خمسة مؤشرات تجريبية ضمن المستهدف. يوجد خرقان للمؤشرات وثلاثة استثناءات إدارية مفتوحة. هذا الملخص حتمي ولا يحتوي على حقائق مولدة من نموذج لغوي.', telemetryTitle:'تدفق قياسات لحظي تجريبي', telemetrySource:'محاكاة محلية · لا يوجد اتصال خارجي', telemetryPaused:'محاكاة متوقفة مؤقتاً', telemetryLast:'آخر إشارة', telemetryReady:'جاهز للبدء', telemetryPausedAt:'متوقف مؤقتاً', telemetryStop:'إيقاف التدفق', telemetryStart:'استئناف التدفق', telemetryReset:'تمت إعادة ضبط المحاكاة', telemetryEventPrefix:'TLM' };
const enExtra = { details:'Details', action:'Action required', source:'Source', observed:'Observed at', quality:'Quality state', verified:'Verified', recommendation:'Proposed recommendation', governance:'Governance guardrail', requestReview:'Request human review', reviewReady:'Request prepared for human review only', reviewNote:'A reviewer name, role, and timestamp are required before an output is considered ready.', noWrite:'This demonstration never creates a work order, message, or source-system change.', analysisReady:'Draft ready for review', working:'Preparing your draft...', attention:'Three items require attention: persistent MTTR breach, availability below the demo target, and two open preventive maintenance work orders. Every result is linked to synthetic Maximo records.', evidence:'Evidence completeness is documented for every illustrative KPI and source record. This interface does not handle live operational or contractual data.', breaches:'There are two demo KPI breaches: availability at 98.522% versus ≥99.5%, and MTTR at 2.75h versus ≤2h.', report:'No. The monthly report remains a draft and needs named human approval because a critical exception is open.', guardrail:'P0 interface for read, analyse, and draft only. No autonomous external write exists.', refreshed:'Illustrative view refreshed', compactOn:'Compact view enabled', compactOff:'Compact view disabled', notify:'No unread notifications in the illustrative view.', severity:{critical:'Critical',high:'High',watch:'Watch',good:'Within range'}, contractHeading:'Monthly Performance · August 2026', contractText:'This P0 demonstrates a shared intelligence layer for the owner and contractor. Contract clauses, formulas, and thresholds must be replaced with formally approved definitions before production.', reportMonthly:'Monthly Performance Report', reportQuarterly:'Quarterly Executive Review', reportAnnual:'Annual Asset & Contract Report', reportDraft:'Draft · human review required', reportNotGenerated:'Not generated', reportSummary:'Deterministic executive summary', reportBody:'Three of five demo KPIs are within target. Two KPI breaches and three management exceptions remain open. This summary is deterministic and contains no language-model generated facts.' };

const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
const L = () => state.language === 'ar' ? ar : {...en, ...enExtra};
const tx = (key) => L()[key] || key;
const local = (item, suffix = '') => item[`${state.language}${suffix}`] ?? item[state.language];
const status = (value) => `<span class="status-pill status-pill--${value}"><i>●</i>${tx('severity')[value]}</span>`;

function renderKpis(){
  $('#kpi-grid').innerHTML = state.kpis.map((k, index) => `<article class="metric-card metric-card--${k.status}" data-metric="${index}"><div class="metric-top"><span class="metric-icon">${k.status==='critical'?'△':k.status==='good'?'◌':'◒'}</span><span class="metric-trend"><i></i>${local(k,'Trend')}</span></div><strong><span class="metric-value">${k.value}</span><small>${k.unit}</small></strong><b>${local(k)}</b><small class="metric-secondary">${state.language==='ar'?'المستهدف':'Target'} ${k.target}</small><span class="metric-rule"></span><span class="metric-live" aria-hidden="true"></span></article>`).join('');
}
function renderDecisions(){ $('#decision-list').innerHTML = state.exceptions.map((x,i) => `<article class="decision-item decision-item--${x.severity}"><span class="decision-rail"></span><span class="decision-index">0${i+1}</span><div class="decision-content"><div class="decision-title"><div><b>${local(x)}</b><small>${state.language==='ar'?x.en:x.ar}</small></div>${status(x.severity)}</div><p>${local(x,'Detail')}</p><div class="decision-meta"><span>⌁ ${local(x,'Owner')}</span><span>◷ ${local(x,'Due')}</span><span>${x.id}</span></div></div><button class="decision-action" data-decision="${x.id}" type="button">${state.language==='ar'?'اعرض الأدلة':'Open evidence'} <i>‹</i></button></article>`).join(''); $$('[data-decision]').forEach((b)=>b.addEventListener('click',()=>openDecision(b.dataset.decision))); }
function renderExceptionTable(){ $('#exception-count').textContent = `${state.exceptions.length} ${state.language==='ar'?'مفتوحة':'open'}`; const h=state.language==='ar'?['الحالة','الاستثناء','الأدلة','الإجراء المطلوب']:['Severity','Exception','Evidence','Decision required']; $('#exception-table').innerHTML=`<div class="data-table"><div class="table-row table-head">${h.map(v=>`<span>${v}</span>`).join('')}</div>${state.exceptions.map(x=>`<div class="table-row"><span>${status(x.severity)}</span><span><b>${local(x)}</b><small>${local(x,'Detail')}</small></span><span>${x.evidence}</span><span>${local(x,'Decision')}</span></div>`).join('')}</div>`; }
function renderAssets(){ const h=state.language==='ar'?['الأصل','الفئة','الموقع','أوامر مفتوحة','الإشارة']:['Asset','Class','Location','Open WOs','Signal']; $('#asset-table').innerHTML=`<div class="data-table asset-table"><div class="table-row table-head">${h.map(v=>`<span>${v}</span>`).join('')}</div>${state.assets.map(a=>`<div class="table-row"><span><b dir="ltr">${a.id}</b></span><span>${local(a,'Class')}</span><span>${local(a,'Location')}</span><span>${a.open}</span><span>${local(a,'Signal')}</span></div>`).join('')}</div>`; }
function renderContract(){ $('#contract-content').innerHTML=`<div class="contract-grid"><div class="contract-summary"><p class="section-kicker">DEMO-CONTRACT</p><h3>${tx('contractHeading')}</h3><p>${tx('contractText')}</p></div><div class="mini-stats"><div><strong>5</strong><span>KPIs</span></div><div><strong>2</strong><span>${state.language==='ar'?'خروقات':'Breaches'}</span></div><div><strong>3</strong><span>${state.language==='ar'?'استثناءات':'Exceptions'}</span></div><div><strong>1</strong><span>${state.language==='ar'?'بوابة اعتماد':'Approval gate'}</span></div></div></div>`; }
function renderReports(){ const r=[[tx('reportMonthly'),'31 Aug 2026',tx('reportDraft'),'M'],[tx('reportQuarterly'),'Q3 2026',tx('reportNotGenerated'),'Q'],[tx('reportAnnual'),'2026',tx('reportNotGenerated'),'A']]; $('#report-cards').innerHTML=`<div class="report-grid">${r.map(([n,d,s,i],x)=>`<article class="report-card"><span class="report-icon">${i}</span><div><b>${n}</b><p>${d}</p><small>${s}</small></div>${x===0?`<button data-report type="button">${tx('details')} ↗</button>`:''}</article>`).join('')}</div><div class="report-preview" id="report-preview"></div>`; $('[data-report]')?.addEventListener('click',()=>$('#report-preview').innerHTML=`<b>${tx('reportSummary')}</b><p>${tx('reportBody')}</p>`); }
function renderAgents(){ $('#agent-list').innerHTML=state.agents.map(a=>`<div class="agent-row"><span>AI</span><div><b>${local(a)}</b><small>${local(a,'Detail')}</small></div><i>${local(a,'State')}</i></div>`).join(''); }
function renderAll(){renderKpis();renderDecisions();renderExceptionTable();renderAssets();renderContract();renderReports();renderAgents();}

const telemetrySignals = [
  { asset: 'ATC-ZC-02', ar: 'نبضة صحة التحكم الآلي', en: 'ATC health pulse' },
  { asset: 'TRAM-APS-03', ar: 'تأكيد حالة مصدر التغذية', en: 'Power-source status confirmed' },
  { asset: 'ATC-ZC-01', ar: 'تحديث دورة الصيانة الوقائية', en: 'Preventive-maintenance cycle updated' },
  { asset: 'MAXIMO-DEMO', ar: 'تحديث سجل مصدر توضيحي', en: 'Illustrative source record refreshed' },
];

function telemetryValue(value, precision, index) {
  const waveform = Math.sin((state.telemetry.ticks + 1) * (1.21 + index * 0.19));
  const amplitude = [0.018, 0, 1.6, 0.04, 0][index];
  const next = value + waveform * amplitude;
  if (precision === 0) return String(Math.round(next)).padStart(2, '0');
  return next.toFixed(precision);
}

function renderTelemetry() {
  const stream = state.telemetry;
  const active = stream.active;
  $('#telemetry-title').textContent = active ? tx('telemetryTitle') : tx('telemetryPaused');
  $('#telemetry-source').textContent = tx('telemetrySource');
  $('#telemetry-label').textContent = tx('telemetryLast');
  $('#telemetry-updated').textContent = stream.lastSignalAt ? `${stream.lastSignalAt} · ${stream.lastSignalLabel}` : (active ? tx('telemetryReady') : tx('telemetryPausedAt'));
  $('#telemetry-toggle').setAttribute('aria-pressed', String(active));
  $('#telemetry-toggle-icon').textContent = active ? 'Ⅱ' : '▶';
  $('#telemetry-toggle-label').textContent = active ? tx('telemetryStop') : tx('telemetryStart');
  $('#telemetry-dot').classList.toggle('telemetry-dot--paused', !active);
  $('#telemetry-event').classList.toggle('telemetry-event--idle', !active);
}

function emitTelemetry({ announce = false } = {}) {
  const stream = state.telemetry;
  stream.ticks += 1;
  stream.eventId += 1;
  const signal = telemetrySignals[stream.ticks % telemetrySignals.length];
  state.kpis.forEach((kpi, index) => { kpi.value = telemetryValue(kpi.base, kpi.precision, index); });
  $$('.metric-card').forEach((card, index) => {
    const value = card.querySelector('.metric-value');
    if (value) value.textContent = state.kpis[index].value;
    card.classList.remove('metric-card--updating');
    void card.offsetWidth;
    card.classList.add('metric-card--updating');
  });
  stream.lastSignalAt = new Date().toLocaleTimeString(state.language === 'ar' ? 'ar-AE' : 'en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  $('#telemetry-event').textContent = `${tx('telemetryEventPrefix')}-${String(stream.eventId).padStart(3, '0')} · ${signal.asset}`;
  stream.lastSignalLabel = state.language === 'ar' ? signal.ar : signal.en;
  renderTelemetry();
  if (announce) toast(state.language === 'ar' ? 'تم تحديث مؤشرات المحاكاة محلياً.' : 'Local simulation indicators updated.');
}

function startTelemetry({ immediate = false } = {}) {
  window.clearInterval(state.telemetry.timer);
  state.telemetry.active = true;
  if (immediate) emitTelemetry();
  state.telemetry.timer = window.setInterval(() => emitTelemetry(), 3200);
  renderTelemetry();
}

function pauseTelemetry() {
  window.clearInterval(state.telemetry.timer);
  state.telemetry.timer = null;
  state.telemetry.active = false;
  renderTelemetry();
}

function resetTelemetry() {
  state.telemetry.ticks = 0;
  state.telemetry.eventId = 0;
  state.telemetry.lastSignalAt = null;
  state.telemetry.lastSignalLabel = null;
  state.kpis.forEach((kpi) => { kpi.value = kpi.precision === 0 ? String(kpi.base).padStart(2, '0') : Number(kpi.base).toFixed(kpi.precision); });
  renderKpis();
  $('#telemetry-event').textContent = 'TLM-000 · BASELINE';
  renderTelemetry();
  toast(tx('telemetryReset'));
}

function openDecision(id){ const x=state.exceptions.find(v=>v.id===id)||state.exceptions[0]; $('#drawer-id').textContent=x.id; $('#drawer-content').innerHTML=`<div class="drawer-status">${status(x.severity)}</div><h3>${local(x)}</h3><small class="drawer-secondary">${state.language==='ar'?x.en:x.ar}</small><section class="drawer-block"><span>${tx('recommendation')}</span><p>${local(x,'Decision')} ${state.language==='ar'?'هذا مقترح للمراجعة فقط.':'This is a review-only proposal.'}</p></section><section class="drawer-evidence"><div><span>⌁</span><p><small>${tx('source')}</small><b dir="ltr">${x.evidence}</b></p></div><div><span>◷</span><p><small>${tx('observed')}</small><b>${local(x,'Fresh')}</b></p></div><div><span>✓</span><p><small>${tx('quality')}</small><b>${tx('verified')}</b></p></div></section><section class="governance-callout"><span>⌑</span><p><b>${tx('governance')}</b><small>${tx('noWrite')}</small></p></section><button class="review-button" id="request-review" type="button">✓ ${tx('requestReview')}</button><p class="review-note">◷ ${tx('reviewNote')}</p>`; $('#drawer-backdrop').hidden=false; document.body.classList.add('drawer-open'); $('#request-review')?.addEventListener('click',()=>{toast(tx('reviewReady'));closeDrawer();}); }
function closeDrawer(){$('#drawer-backdrop').hidden=true;document.body.classList.remove('drawer-open');}
function toast(message){const box=$('#toast');box.textContent=message;box.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>box.classList.remove('show'),2700);}
function answer(kind,target='#query-output'){const o=$(target);if(o)o.innerHTML=`<b>${tx('analysisReady')}</b><p>${tx(kind)}</p><small>✓ ${state.language==='ar'?'لا يتم نشر أي قرار عالي الأثر قبل اعتماد بشري مُسمى.':'No high-impact decision is released before named human approval.'}</small>`;}
function applyLanguage(){const isAr=state.language==='ar';document.documentElement.lang=state.language;document.documentElement.dir=isAr?'rtl':'ltr';document.title=isAr?'RailMind | منصة ذكاء الأصول':'RailMind | Asset Intelligence Platform';if(!isAr)$$('[data-i18n]').forEach(e=>{const key=e.dataset.i18n;if(en[key])e.textContent=en[key];});if(isAr)window.location.reload();$$('[data-i18n-option]').forEach(e=>{if(en[e.dataset.i18nOption])e.textContent=en[e.dataset.i18nOption];});$$('[data-i18n-placeholder]').forEach(e=>{if(en[e.dataset.i18nPlaceholder])e.placeholder=en[e.dataset.i18nPlaceholder];});$('#language-button b').textContent=isAr?'EN':'ع';renderAll();}
function switchView(view){$$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===view));$$('.view').forEach(s=>s.classList.toggle('active',s.id===`view-${view}`));$('#app-shell').classList.remove('menu-open');window.scrollTo({top:0,behavior:'smooth'});}
function setup(){ $$('.nav-item').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view))); $('#language-button').addEventListener('click',()=>{state.language=state.language==='ar'?'en':'ar';applyLanguage();}); $('#menu-button').addEventListener('click',()=>$('#app-shell').classList.toggle('menu-open')); $('#refresh-button').addEventListener('click',()=>{ $('#updated-time').textContent=new Date().toLocaleTimeString(state.language==='ar'?'ar-AE':'en-GB',{hour:'2-digit',minute:'2-digit'});toast(tx('refreshed'));}); $('#density-button').addEventListener('click',()=>{state.compact=!state.compact;$('#app-shell').classList.toggle('compact',state.compact);toast(tx(state.compact?'compactOn':'compactOff'));}); $('#notifications').addEventListener('click',()=>toast(tx('notify'))); ['#safeguard-button','#boundary-button','#more-button'].forEach(s=>$(s).addEventListener('click',()=>toast(tx('guardrail')))); $('#view-all-button').addEventListener('click',()=>switchView('exceptions')); $('#open-brief-button').addEventListener('click',()=>openDecision('DEC-042')); $('#evidence-button').addEventListener('click',()=>openDecision('DEC-043')); $('#drawer-close').addEventListener('click',closeDrawer); $('#drawer-backdrop').addEventListener('click',(e)=>{if(e.target===$('#drawer-backdrop'))closeDrawer();}); $('#search-trigger').addEventListener('click',()=>{switchView('agents');setTimeout(()=>$('#agent-input').focus(),260);}); document.addEventListener('keydown',(e)=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();switchView('agents');setTimeout(()=>$('#agent-input').focus(),260);}if(e.key==='Escape')closeDrawer();}); $$('[data-question]').forEach(b=>b.addEventListener('click',()=>{answer(b.dataset.question);answer(b.dataset.question,'#agent-answer');$('#agent-status').classList.add('ready');$('#agent-status b').textContent=tx('analysisReady');})); $('#agent-run').addEventListener('click',()=>{if(!$('#agent-input').value.trim()){toast(state.language==='ar'?'اكتب سؤالاً أو اختر اقتراحاً أولاً.':'Write a question or choose a suggestion first.');return;}const s=$('#agent-status');s.classList.add('working');s.querySelector('b').textContent=tx('working');setTimeout(()=>{s.classList.remove('working');s.classList.add('ready');s.querySelector('b').textContent=tx('analysisReady');answer('attention','#agent-answer');},620);}); }
function setupTelemetryControls() {
  $('#telemetry-toggle').addEventListener('click', () => {
    if (state.telemetry.active) pauseTelemetry();
    else startTelemetry({ immediate: true });
  });
  $('#telemetry-reset').addEventListener('click', () => resetTelemetry());
  $('#language-button').addEventListener('click', () => window.setTimeout(renderTelemetry, 0));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) window.clearInterval(state.telemetry.timer);
    else if (state.telemetry.active) startTelemetry();
  });
}

renderAll();
renderTelemetry();
setup();
setupTelemetryControls();
startTelemetry({ immediate: true });
setTimeout(()=>$('#loading-wash').classList.add('hide'),560);
