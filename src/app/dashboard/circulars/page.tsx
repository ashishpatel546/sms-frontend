'use client';

import * as React from 'react';
import { Toaster } from 'react-hot-toast';
import { useSWRConfig } from 'swr';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

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
  const t = useTranslations('circulars');
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
        section={t('page.section')}
        title={t('page.title')}
        description={t('page.description')}
        actions={
          canIssue ? (
            <Button
              onClick={() => setIssuing(true)}
              disabled={readOnly}
              title={readOnly ? READ_ONLY_TITLE : undefined}
            >
              <Plus /> {t('page.issue')}
            </Button>
          ) : undefined
        }
      />

      <PageBody>
        <CircularFeed
          emptyDescription={
            canIssue
              ? t('page.emptyStaff')
              : t('page.emptyReader')
          }
          emptyAction={
            canIssue ? (
              <Button
                onClick={() => setIssuing(true)}
                disabled={readOnly}
                title={readOnly ? READ_ONLY_TITLE : undefined}
              >
                <Plus /> {t('page.issueFirst')}
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
