'use client';

import * as React from 'react';
import { Toaster } from 'react-hot-toast';
import { useSWRConfig } from 'swr';
import { Plus } from 'lucide-react';

import { PageBody, PageHeader, PageShell } from '@/components/ui/PageHeader';
import { CircularFeed } from '@/components/circulars/CircularFeed';
import { IssueCircularDialog } from '@/components/circulars/IssueCircularDialog';
import { Button } from '@/components/ui/button';
import { useRbac } from '@/lib/rbac';
import { READ_ONLY_TITLE, useReadOnlySession } from '@/lib/support-session';

/**
 * CIRCULARS — the staff side.
 *
 * Same feed the parent portal shows, plus the one thing only the office can
 * do. Reading measure, not the wide one: a circular is prose, and the list is
 * a column of prose.
 */
export default function CircularsPage() {
  const rbac = useRbac();
  const readOnly = useReadOnlySession();
  const { mutate } = useSWRConfig();
  const [issuing, setIssuing] = React.useState(false);

  const refresh = () =>
    void mutate((key) => Array.isArray(key) && key[0] === 'circulars');

  const canIssue = rbac.canIssueCirculars;

  return (
    <PageShell measure="reading">
      <Toaster position="top-center" />
      <PageHeader
        section="Communication"
        title="Circulars"
        description="School-wide notices, newest first. Every circular is final once issued."
        actions={
          canIssue ? (
            <Button
              onClick={() => setIssuing(true)}
              disabled={readOnly}
              title={readOnly ? READ_ONLY_TITLE : undefined}
            >
              <Plus /> Issue circular
            </Button>
          ) : undefined
        }
      />

      <PageBody>
        <CircularFeed
          emptyDescription={
            canIssue
              ? 'Nothing has been issued yet. A circular goes out to every parent and staff member the moment you publish it.'
              : 'Nothing has been issued yet. Notices from the school office will appear here.'
          }
          emptyAction={
            canIssue ? (
              <Button
                onClick={() => setIssuing(true)}
                disabled={readOnly}
                title={readOnly ? READ_ONLY_TITLE : undefined}
              >
                <Plus /> Issue the first circular
              </Button>
            ) : undefined
          }
        />
      </PageBody>

      {issuing && (
        <IssueCircularDialog onClose={() => setIssuing(false)} onIssued={refresh} />
      )}
    </PageShell>
  );
}
