import { useAuth } from '../auth/AuthContext';
import { SERVER_2_4, versionAtLeast } from '../auth/serverVersion';
import { PAGES, type PageDef } from '../navigation';

/**
 * The pages whose tab is View or Edit for the signed-in person. The Dispatch & Packing pages also need a server that has
 * the feature (backend 2.4.0), so a server without it never shows a section whose calls would fail.
 */
export function useVisiblePages(): PageDef[] {
  const { canView, serverVersion } = useAuth();
  const dispatchServer = versionAtLeast(serverVersion, SERVER_2_4);
  return PAGES.filter((p) => canView(p.access) && (p.group !== 'dispatch' || dispatchServer));
}
