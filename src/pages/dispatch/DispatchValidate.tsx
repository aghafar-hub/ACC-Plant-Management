// Dispatch & Packing > Data validation: the checks run on every stored day, in four groups. A check never changes a value;
// it lists what a person should look at (and says why).
import { useMemo, useState } from 'react';
import { Tile } from '../../components/Tile';
import { DEFAULT_LIMITS, GROUP_LABELS, RULES, ruleById, runChecks, summarise, type CheckGroup, type CheckLevel, type Finding } from '../../dispatch/checks';
import { DispatchPage, Tbl, useTableExport } from '../../dispatch/ui';
import type { DispatchDay, DispatchSettings } from '../../dispatch/model';
import { exportCol, type ExportTable } from '../../export/table';
import { t } from '../../i18n/t';
import { useTheme } from '../../theme/ThemeContext';
import '../../components/ui.css';

const LEVEL_TEXT: Record<CheckLevel, string> = { block: 'Must fix', warn: 'Check', info: 'Information' };
const LEVELS: CheckLevel[] = ['block', 'warn', 'info'];
const PAGE = 200;

function Validate({ days, settings }: { days: DispatchDay[]; settings: DispatchSettings }) {
  const { T } = useTheme();
  const exp = useTableExport('validation');
  const [group, setGroup] = useState<CheckGroup | ''>('');
  const [level, setLevel] = useState<CheckLevel | ''>('');
  const [rule, setRule] = useState('');
  const [shown, setShown] = useState(PAGE);
  const findings = useMemo(() => runChecks(days, settings), [days, settings]);
  const sum = useMemo(() => summarise(findings), [findings]);
  const list = findings.filter((f) => (!group || f.group === group) && (!level || f.level === level) && (!rule || f.rule === rule));
  const tone = (l: CheckLevel) => (l === 'block' ? T.danger : l === 'warn' ? T.warning : undefined);
  const exportTable: ExportTable = {
    id: 'findings', sheet: t('Findings'),
    columns: [exportCol(t('Date'), 'date'), exportCol(t('Rule')), exportCol(t('Check')), exportCol(t('Level')), exportCol(t('Packer')), exportCol(t('Message'))],
    rows: list.map((f) => [f.date, f.rule, ruleById(f.rule)?.name ?? '', t(LEVEL_TEXT[f.level]), f.packer ? `Packer ${f.packer}` : '', f.message]),
  };
  return (
    <>
      <div className="tiles" data-testid="dv-tiles">
        <Tile icon="ban" label={t('Must fix')} value={sum.block} tone={sum.block ? T.danger : undefined} sub={t('wrong or impossible values')} testid="dv-block" />
        <Tile icon="alert" label={t('To check')} value={sum.warn} tone={sum.warn ? T.warning : undefined} sub={t('look at the day, then accept or correct')} testid="dv-warn" />
        <Tile icon="info" label={t('Information')} value={sum.info} sub={t('shown, nothing required')} testid="dv-info" />
        <Tile icon="calendar" label={t('Days with a finding')} value={`${sum.days} / ${days.length}`} testid="dv-days" />
      </div>

      <section className="card">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="field"><label htmlFor="dv-group">{t('Group')}</label>
              <select id="dv-group" className="select" value={group} onChange={(e) => { setGroup(e.target.value as CheckGroup | ''); setShown(PAGE); }} data-testid="dv-group">
                <option value="">{t('All groups')}</option>
                {(Object.keys(GROUP_LABELS) as CheckGroup[]).map((g) => <option key={g} value={g}>{t(GROUP_LABELS[g])}</option>)}
              </select></div>
            <div className="field"><label htmlFor="dv-level">{t('Level')}</label>
              <select id="dv-level" className="select" value={level} onChange={(e) => { setLevel(e.target.value as CheckLevel | ''); setShown(PAGE); }} data-testid="dv-level">
                <option value="">{t('All levels')}</option>
                {LEVELS.map((l) => <option key={l} value={l}>{t(LEVEL_TEXT[l])}</option>)}
              </select></div>
            <div className="field"><label htmlFor="dv-rule">{t('Check')}</label>
              <select id="dv-rule" className="select" value={rule} onChange={(e) => { setRule(e.target.value); setShown(PAGE); }} data-testid="dv-rule">
                <option value="">{t('All checks')}</option>
                {RULES.map((r) => <option key={r.id} value={r.id}>{`${r.id} · ${r.name} (${sum.byRule[r.id] ?? 0})`}</option>)}
              </select></div>
          </div>
          {exp.menu(exportTable)}
        </div>
        {exp.note && <p className="muted" role="status" style={{ marginTop: 6 }}>{exp.note}</p>}
        <p className="muted" style={{ margin: '10px 0 6px' }} data-testid="dv-count">{t('{n} findings shown of {m}.', { n: Math.min(shown, list.length), m: list.length })}</p>
        {list.length === 0 ? (
          <p className="muted" data-testid="dv-none">{findings.length === 0 ? t('Every check passed on every day.') : t('No finding matches these filters.')}</p>
        ) : (
          <Tbl<Finding> testid="dv-table" caption={t('Findings')} rows={list.slice(0, shown)}
            cols={[
              { head: t('Date'), render: (f) => f.date },
              { head: t('Level'), render: (f) => <span className="badge" style={tone(f.level) ? { color: tone(f.level), borderColor: tone(f.level) } : undefined}>{t(LEVEL_TEXT[f.level])}</span> },
              { head: t('Check'), render: (f) => `${f.rule} · ${ruleById(f.rule)?.name ?? ''}` },
              { head: t('Packer'), render: (f) => (f.packer ? `P${f.packer}` : '-') },
              { head: t('What was found'), render: (f) => f.message },
            ]} />
        )}
        {list.length > shown && <button type="button" className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => setShown((n) => n + PAGE)}>{t('Show more')}</button>}
      </section>

      <section className="card" data-testid="dv-rules">
        <h2>{t('What is checked')}</h2>
        <p className="muted">{t('A check never changes a value. Limits: day tie-out {a}%, month tie-out {b}%, time balance {c} h, sudden change {d}%, packing rate {e}% from typical, bags {f}%, broken bags {g}%.', { a: DEFAULT_LIMITS.tiePct, b: DEFAULT_LIMITS.tieMonthPct, c: DEFAULT_LIMITS.timeTolH, d: DEFAULT_LIMITS.jumpPct, e: DEFAULT_LIMITS.ratePct, f: DEFAULT_LIMITS.bagsPct, g: DEFAULT_LIMITS.brokenPct })}</p>
        <Tbl caption={t('Checks')} rows={RULES}
          cols={[
            { head: t('Check'), render: (r) => `${r.id} · ${r.name}` },
            { head: t('Group'), render: (r) => t(GROUP_LABELS[r.group]) },
            { head: t('Level'), render: (r) => t(LEVEL_TEXT[r.level]) },
            { head: t('What it looks for'), render: (r) => r.what },
            { head: t('Found'), num: true, render: (r) => sum.byRule[r.id] ?? 0 },
          ]} />
      </section>
    </>
  );
}

export default function DispatchValidate() {
  return (
    <DispatchPage pageId="dispatch-validate" testid="page-dispatch-validate" period={false} subtitle={(d) => (d.length ? t('{n} days checked, {a} to {b}', { n: d.length, a: d[0]!.date, b: d[d.length - 1]!.date }) : '')}>
      {({ days, data }) => <Validate days={days} settings={data.settings} />}
    </DispatchPage>
  );
}
