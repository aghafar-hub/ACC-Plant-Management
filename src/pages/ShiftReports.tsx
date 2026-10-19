// Shift reports (plant system, backend 2.1.0; docs/plant-system/02-shift-workflow-and-roles.md): My shift (entry),
// Review (production and reliability queues) and All reports. Each tab is an address: /shift, /shift/review, /shift/all.
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { SERVER_2_1, versionAtLeast } from '../auth/serverVersion';
import AccessBadge from '../components/AccessBadge';
import { PageHeader, TabBar } from '../components/Tile';
import { useToast } from '../admin/useToast';
import { t } from '../i18n/t';
import { Icon } from '../icons';
import ShiftAll from '../plant/ShiftAll';
import ShiftEntry from '../plant/ShiftEntry';
import ShiftReview from '../plant/ShiftReview';
import '../components/ui.css';
import '../admin/admin.css';
import '../plant/plant.css';

export default function ShiftReports() {
  const { sub } = useParams();
  const navigate = useNavigate();
  const { canEdit, serverVersion, user } = useAuth();
  const [toastNode, toast] = useToast();
  const tab = sub === 'review' ? 'review' : sub === 'all' ? 'all' : 'entry';
  const edit = canEdit('shift');
  const tabs = [
    ...(edit ? [{ id: 'entry', label: t('My shift') }, { id: 'review', label: t('Review') }] : []),
    { id: 'all', label: t('All reports') },
  ];
  const shown = edit ? tab : 'all';
  return (
    <div className="page" data-testid="page-shift">
      <PageHeader title={t('Shift reports')} subtitle={<>{t('Shift leader enters · production reviews · reliability validates · then the stoppages go into the downtime analysis.')} <AccessBadge edit={edit} /></>} />
      {!versionAtLeast(serverVersion, SERVER_2_1) ? (
        <div className="callout callout--warning" data-testid="shift-old-server"><Icon name="info" size={16} /><span>{t('The server is not updated yet. Shift reports need backend 2.1.0 (deploy/plant-apps-script).')}</span></div>
      ) : (
        <>
          <TabBar tabs={tabs} value={shown} onChange={(id) => navigate(id === 'entry' ? '/shift' : `/shift/${id}`)} testid="shift-tabs" />
          {shown === 'entry' && <ShiftEntry toast={toast} />}
          {shown === 'review' && <ShiftReview toast={toast} me={user?.user_id ?? ''} />}
          {shown === 'all' && <ShiftAll />}
        </>
      )}
      {toastNode}
    </div>
  );
}
