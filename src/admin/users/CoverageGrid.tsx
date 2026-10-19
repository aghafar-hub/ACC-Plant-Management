import { useMemo } from 'react';
import type { AdminUser } from '../../api/types';
import { useStartup } from '../../data/useStartup';
import { t } from '../../i18n/t';
import {
  AREA_DUTIES, SECTION_DUTIES, SECTIONS, coverage, dutyName, sectionCoverage, sectionName, type CoverageCell, type Responsibility,
} from '../../plant/responsibilities';

const todayIso = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function Cell({ cell, name, testid }: { cell: CoverageCell | undefined; name: (id: string) => string; testid: string }) {
  if (!cell || cell.main.length === 0) {
    return (
      <td className="cov-gap" data-testid={testid} data-state="gap">
        <span aria-hidden="true">✕ </span>{cell && cell.backup.length > 0 ? t('Backup only: {who}', { who: cell.backup.map(name).join(', ') }) : t('Nobody')}
      </td>
    );
  }
  return (
    <td className={cell.backup.length ? 'cov-ok' : 'cov-thin'} data-testid={testid} data-state={cell.backup.length ? 'ok' : 'no-backup'}>
      {cell.main.map(name).join(', ')}
      {cell.backup.length > 0 ? <span className="adm-muted-sm"> · {t('backup')} {cell.backup.map(name).join(', ')}</span> : <span className="adm-muted-sm"> · {t('no backup')}</span>}
    </td>
  );
}

/**
 * Users › Coverage (backend 2.0.0): for today, who holds each duty of each area and each section's month closing.
 * A red cell has no main person: a shift report there could not move on. Only active people and duties in force count.
 */
export default function CoverageGrid({ rows, users }: { rows: Responsibility[]; users: AdminUser[] }) {
  const { startup } = useStartup();
  const areas = useMemo(() => (startup?.areas ?? []).filter((a) => a.active !== false).slice().sort((a, b) => a.sort_order - b.sort_order), [startup]);
  const day = todayIso();
  const grid = useMemo(() => coverage(rows, users, areas, day), [rows, users, areas, day]);
  const sections = useMemo(() => sectionCoverage(rows, users, day), [rows, users, day]);
  const names = useMemo(() => new Map(users.map((u) => [u.user_id, u.display_name])), [users]);
  const name = (id: string) => names.get(id) ?? id;
  const gaps = [...grid.values(), ...sections.values()].filter((c) => c.main.length === 0).length;

  return (
    <section className="cov" data-testid="coverage">
      <h3 className="cov-title">{t('Coverage today')}</h3>
      <p className="status-line" data-testid="coverage-summary">
        {gaps === 0 ? t('Every area duty and every month closing has a main person.') : t('{n} duties have nobody. A shift report or a month there cannot move on until someone holds the duty.', { n: gaps })}
      </p>
      <div className="table-wrap">
        <table className="data-table cov-table" data-testid="coverage-areas">
          <thead><tr><th scope="col">{t('Area')}</th>{AREA_DUTIES.map((d) => <th key={d} scope="col">{dutyName(d)}</th>)}</tr></thead>
          <tbody>
            {areas.map((a) => (
              <tr key={a.area_id}>
                <th scope="row" className="mono">{a.area_id}</th>
                {AREA_DUTIES.map((d) => <Cell key={d} cell={grid.get(`${a.area_id}|${d}`)} name={name} testid={`cov-${a.area_id}-${d}`} />)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-wrap" style={{ marginTop: 12 }}>
        <table className="data-table cov-table" data-testid="coverage-sections">
          <thead><tr><th scope="col">{t('Section')}</th>{SECTION_DUTIES.map((d) => <th key={d} scope="col">{dutyName(d)}</th>)}</tr></thead>
          <tbody>
            {SECTIONS.map((s) => (
              <tr key={s}>
                <th scope="row">{sectionName(s)}</th>
                {SECTION_DUTIES.map((d) => (s === 'plant' && d === 'month_review'
                  ? <td key={d} className="adm-muted-sm">{t('Not needed')}</td>
                  : <Cell key={d} cell={sections.get(`${s}|${d}`)} name={name} testid={`cov-${s}-${d}`} />))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
