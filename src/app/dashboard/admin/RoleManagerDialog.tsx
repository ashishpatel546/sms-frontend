'use client';

/* ═══════════════════════════════════════════════════════════════════════════
   THE ROLE EDITOR

   One person, one sheet: the primary role they ARE, and the extra roles they
   also DO. The two are not the same kind of thing, so they do not look the
   same — the primary is a single choice in a framed strip, the additional
   roles are a list of capabilities you switch on and off.

   The one thing this screen must never let someone misread is that nothing
   here is live. Roles are baked into the access token at sign-in and those
   tokens run for a week, so a grant made now reaches the person the next time
   they sign in — not on their next click. That fact is the sheet's signature:
   every switch you flip writes a line into a standing "takes effect at next
   sign-in" ledger at the bottom, so the delay is visible rather than buried in
   a footnote nobody reads.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react';
import {
  Briefcase,
  BookOpen,
  Check,
  GraduationCap,
  Loader2,
  ShieldCheck,
  UserCog,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '@/lib/api';
import { authFetch, getToken } from '@/lib/auth';
import { READ_ONLY_TITLE } from '@/lib/support-session';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { InitialsAvatar, initialsOf } from '@/components/ui/InitialsAvatar';
import { Note } from '@/components/ui/Panel';
import { cn } from '@/lib/utils';

/* ── The catalogue ───────────────────────────────────────────────────────── */

export const ROLE_LABELS: Record<string, { label: string; chip: string }> = {
  SUPER_ADMIN: {
    label: 'Super Admin',
    chip: 'bg-iris-100 text-iris-700 border-iris-200',
  },
  ADMIN: {
    label: 'Admin',
    chip: 'bg-accent-info-tint text-accent-info-deep border-accent-info-edge',
  },
  SUB_ADMIN: {
    label: 'Sub Admin',
    chip: 'bg-lapis-100 text-lapis-700 border-lapis-200',
  },
  HR_ADMIN: {
    label: 'HR Admin',
    chip: 'bg-brand-tint text-brand-deep border-brand-edge',
  },
  LIBRARIAN: {
    label: 'Librarian',
    chip: 'bg-accent-success-tint text-accent-success-deep border-accent-success-edge',
  },
  TEACHER: {
    label: 'Teacher',
    chip: 'bg-sage-100 text-sage-800 border-sage-200',
  },
  GUARD: {
    label: 'Guard',
    chip: 'bg-surface-inset text-ink-muted border-line-strong',
  },
  STUDENT: {
    label: 'Student',
    chip: 'bg-accent-warn-tint text-accent-warn-deep border-accent-warn-edge',
  },
  PARENT: {
    label: 'Parent',
    chip: 'bg-accent-ai-tint text-accent-ai border-accent-ai-edge',
  },
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role]?.label ?? role;
}

/**
 * The only roles the API will grant as an additional role, and what each one
 * actually opens up. The server enforces the same list — this copy exists so
 * the sheet can be drawn before the request comes back, and it is replaced by
 * the server's `grantable` array the moment it arrives.
 */
const GRANTABLE: {
  role: string;
  icon: typeof ShieldCheck;
  unlocks: string;
}[] = [
  {
    role: 'HR_ADMIN',
    icon: Briefcase,
    unlocks: 'HR Portal — staff attendance, leave policies, payroll and salary setup.',
  },
  {
    role: 'SUB_ADMIN',
    icon: UserCog,
    unlocks: 'Day-to-day admin — students, staff, subjects, sections, enrolment and fees.',
  },
  {
    role: 'LIBRARIAN',
    icon: BookOpen,
    unlocks: 'Library — book catalogue, issuing, returns and overdue tracking.',
  },
  {
    role: 'TEACHER',
    icon: GraduationCap,
    unlocks: 'Classroom tools — attendance, homework, marks entry and AI teaching aids.',
  },
];

const GRANTABLE_ORDER = GRANTABLE.map((g) => g.role);

/** Primary roles the API refuses to stack anything on top of. */
const NO_ADDITIONAL_ROLES = ['PARENT', 'STUDENT'];

/**
 * Primary roles a super admin may assign. SUPER_ADMIN is deliberately absent —
 * it is provisioned out-of-band, so a mis-click can never mint one.
 */
export const ASSIGNABLE_PRIMARY_ROLES = ['ADMIN', 'SUB_ADMIN', 'HR_ADMIN', 'TEACHER'];

/* ── Pieces ──────────────────────────────────────────────────────────────── */

export function RoleChip({
  role,
  primary = false,
  className,
}: {
  role: string;
  /** The headline role gets a filled dot; additional roles get a hollow one. */
  primary?: boolean;
  className?: string;
}) {
  const meta = ROLE_LABELS[role];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5',
        'text-[11.5px] font-semibold whitespace-nowrap',
        meta?.chip ?? 'bg-surface-inset text-ink-muted border-line-strong',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'size-1.5 shrink-0 rounded-full',
          primary ? 'bg-current' : 'border border-current bg-transparent',
        )}
      />
      {meta?.label ?? role}
    </span>
  );
}

/** A switch that reads as a switch — label, state, and a busy state of its own. */
function RoleSwitch({
  on,
  busy,
  disabled,
  onToggle,
  label,
  title,
}: {
  on: boolean;
  busy: boolean;
  disabled: boolean;
  onToggle: () => void;
  label: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      title={title}
      disabled={disabled || busy}
      onClick={onToggle}
      className={cn(
        'relative h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-colors duration-200',
        // The switch is 44×24 on screen but 64×44 to a thumb — the ::after is
        // an invisible tap target, so the control stays small without being
        // fiddly on a phone.
        "after:absolute after:-inset-2.5 after:content-['']",
        'focus-visible:ring-3 focus-visible:ring-brand/35 focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-45',
        on ? 'border-brand bg-brand' : 'border-line-strong bg-surface-inset',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 grid size-4.5 place-items-center rounded-full bg-white shadow-soft',
          'transition-[left] duration-200 ease-out-ink',
          on ? 'left-5.5' : 'left-0.5',
        )}
      >
        {busy ? (
          <Loader2 className="size-3 animate-spin text-brand" />
        ) : on ? (
          <Check className="size-3 text-brand" />
        ) : null}
      </span>
    </button>
  );
}

/* ── The sheet ───────────────────────────────────────────────────────────── */

export interface RoleManagerUser {
  id: number;
  firstName?: string;
  lastName?: string;
  email?: string | null;
  mobile?: string | null;
  role: string;
}

interface SecondaryGrant {
  role: string;
  grantedAt?: string;
  grantedBy?: { id: number; name: string } | null;
}

interface UserRolesPayload {
  primary: string;
  secondary: SecondaryGrant[];
  /** The server's own grantable list. It wins over the local catalogue. */
  grantable?: string[];
}

async function fetchUserRoles(userId: number): Promise<UserRolesPayload> {
  const res = await authFetch(`${API_BASE_URL}/users/${userId}/roles`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error(`Roles lookup failed (${res.status})`);
  return (await res.json()) as UserRolesPayload;
}

export function RoleManagerDialog({
  user,
  open,
  onOpenChange,
  canEditPrimary,
  readOnly,
  isSelf,
  onRolesChanged,
  onPrimaryChanged,
}: {
  user: RoleManagerUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Only a super admin may move someone's primary role. */
  canEditPrimary: boolean;
  readOnly: boolean;
  isSelf: boolean;
  /** Fires after every accepted grant/revoke so the table behind can restripe. */
  onRolesChanged: (userId: number, secondary: string[]) => void;
  onPrimaryChanged: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [primary, setPrimary] = useState<string>(user?.role ?? '');
  const [secondary, setSecondary] = useState<string[]>([]);
  const [grantable, setGrantable] = useState<string[]>(GRANTABLE_ORDER);
  const [busyRole, setBusyRole] = useState<string | null>(null);
  const [savingPrimary, setSavingPrimary] = useState(false);
  /**
   * What the roles were when the sheet opened. The footer ledger is the
   * difference between this and now, so toggling something on and back off
   * leaves nothing behind — it reports the net change, not the clicks.
   */
  const [opening, setOpening] = useState<{ primary: string; secondary: string[] } | null>(
    null,
  );

  const userId = user?.id;
  const firstName = user?.firstName ?? '';
  const lastName = user?.lastName ?? '';
  const shortName = firstName || lastName || 'This user';

  // The sheet is remounted (keyed on the person) each time it opens, so
  // `loading` starts true and there is nothing to reset on the way in. State
  // lands in the promise callback, never synchronously inside the effect.
  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;
    fetchUserRoles(userId)
      .then((data) => {
        if (cancelled) return;
        const held = (data.secondary ?? []).map((s) => s.role);
        setPrimary(data.primary);
        setSecondary(held);
        setOpening({ primary: data.primary, secondary: held });
        if (Array.isArray(data.grantable) && data.grantable.length) {
          setGrantable(data.grantable);
        }
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
        toast.error("Couldn't load this person's roles.");
      });
    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  const held = primary ? [primary, ...secondary.filter((r) => r !== primary)] : secondary;
  const blocked = NO_ADDITIONAL_ROLES.includes(primary);

  /**
   * The net change since the sheet opened — what this person will find waiting
   * for them at their next sign-in. A diff, not a click log: switch something
   * on and back off and the line disappears, because nothing changed.
   */
  const ledger: { kind: 'add' | 'remove' | 'primary'; role: string }[] = [];
  if (opening) {
    if (primary !== opening.primary) ledger.push({ kind: 'primary', role: primary });
    secondary
      .filter((r) => !opening.secondary.includes(r))
      .forEach((r) => ledger.push({ kind: 'add', role: r }));
    opening.secondary
      // A grant the server dropped because it became the primary is already
      // reported by the primary line above — don't say it twice.
      .filter((r) => !secondary.includes(r) && r !== primary)
      .forEach((r) => ledger.push({ kind: 'remove', role: r }));
  }

  /** Rows to draw: the server's grantable list, in the catalogue's order. */
  const rows = GRANTABLE.filter((g) => grantable.includes(g.role));

  const toggle = async (role: string, next: boolean) => {
    if (!userId || busyRole) return;
    setBusyRole(role);
    const before = secondary;
    // Optimistic: the switch answers immediately, and reverts if the server says no.
    setSecondary(next ? [...secondary, role] : secondary.filter((r) => r !== role));
    try {
      const res = await authFetch(
        next
          ? `${API_BASE_URL}/users/${userId}/roles`
          : `${API_BASE_URL}/users/${userId}/roles/${role}`,
        {
          method: next ? 'POST' : 'DELETE',
          headers: {
            Authorization: `Bearer ${getToken()}`,
            'Content-Type': 'application/json',
          },
          ...(next ? { body: JSON.stringify({ role }) } : {}),
        },
      );
      if (res.ok) {
        const after = next
          ? [...before.filter((r) => r !== role), role]
          : before.filter((r) => r !== role);
        setSecondary(after);
        onRolesChanged(userId, after);
        toast.success(
          next
            ? `${roleLabel(role)} added — active at next sign-in`
            : `${roleLabel(role)} removed — applies at next sign-in`,
        );
      } else {
        setSecondary(before);
        const d = await res.json().catch(() => null);
        toast.error(d?.message || `Couldn't ${next ? 'add' : 'remove'} ${roleLabel(role)}`);
      }
    } catch {
      setSecondary(before);
      toast.error('Network error — nothing was changed.');
    }
    setBusyRole(null);
  };

  const changePrimary = async (role: string) => {
    if (!userId || role === primary) return;
    setSavingPrimary(true);
    const before = primary;
    setPrimary(role);
    try {
      const res = await authFetch(`${API_BASE_URL}/users/${userId}/role`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role }),
      });
      if (res.ok) {
        // The server drops any additional grant equal to the new primary.
        const after = secondary.filter((r) => r !== role);
        setSecondary(after);
        onRolesChanged(userId, after);
        onPrimaryChanged();
        toast.success(`Primary role is now ${roleLabel(role)}`);
      } else {
        setPrimary(before);
        const d = await res.json().catch(() => null);
        toast.error(d?.message || "Couldn't change the primary role");
      }
    } catch {
      setPrimary(before);
      toast.error('Network error — nothing was changed.');
    }
    setSavingPrimary(false);
  };

  if (!user) return null;

  const locked = readOnly;
  const lockTitle = locked ? READ_ONLY_TITLE : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          'w-full gap-0 overflow-hidden p-0 sm:max-w-136',
          'max-h-[calc(100dvh-2rem)] rounded-2xl',
          'grid-rows-[auto_minmax(0,1fr)_auto]',
        )}
      >
        {/* ── Who ─────────────────────────────────────────────────────── */}
        <header className="border-line bg-surface-secondary border-b px-4 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <InitialsAvatar
              initials={initialsOf(firstName, lastName)}
              index={user.id}
              size="lg"
            />
            <div className="min-w-0 flex-1">
              <DialogTitle className="font-display text-ink text-[17px] leading-tight font-semibold tracking-[-0.01em]">
                {firstName} {lastName}
              </DialogTitle>
              <DialogDescription className="text-ink-muted mt-0.5 truncate text-[12.5px]">
                {user.email || user.mobile || 'No contact on file'}
              </DialogDescription>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {held.map((r) => (
                  <RoleChip key={r} role={r} primary={r === primary} />
                ))}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
              className="-mt-1 -mr-1 shrink-0"
            >
              ✕
            </Button>
          </div>
        </header>

        {/* ── What ────────────────────────────────────────────────────── */}
        <div className="overflow-y-auto px-4 py-5 sm:px-6">
          {loading ? (
            <div className="space-y-3" aria-busy="true">
              <div className="bg-surface-inset h-16 animate-pulse rounded-xl" />
              <div className="bg-surface-inset h-16 animate-pulse rounded-xl" />
              <div className="bg-surface-inset h-16 animate-pulse rounded-xl" />
            </div>
          ) : (
            <>
              {/* Primary role — one choice, framed */}
              <section>
                <h3 className="text-ink-muted text-[11px] font-semibold tracking-[0.09em] uppercase">
                  Primary role
                </h3>
                <p className="text-ink-faint mt-1 text-[12.5px] leading-relaxed">
                  Who this person is in the school. One only, and it is the role their
                  dashboard is built around.
                </p>
                <div className="border-line bg-surface-secondary mt-2.5 flex flex-wrap items-center gap-3 rounded-xl border px-3.5 py-3">
                  {canEditPrimary && !isSelf ? (
                    <>
                      <select
                        value={primary}
                        onChange={(e) => void changePrimary(e.target.value)}
                        disabled={locked || savingPrimary}
                        title={lockTitle}
                        aria-label="Primary role"
                        className={cn(
                          'border-line-strong bg-surface text-ink h-9 min-w-40 flex-1 rounded-md border px-2.5',
                          'cursor-pointer text-[13.5px] font-medium',
                          'focus-visible:ring-3 focus-visible:ring-brand/35 focus-visible:outline-none',
                          'disabled:cursor-not-allowed disabled:opacity-50',
                        )}
                      >
                        {/* The current role stays selectable even when it isn't assignable. */}
                        {!ASSIGNABLE_PRIMARY_ROLES.includes(primary) && (
                          <option value={primary} disabled>
                            {roleLabel(primary)}
                          </option>
                        )}
                        {ASSIGNABLE_PRIMARY_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {roleLabel(r)}
                          </option>
                        ))}
                      </select>
                      {savingPrimary && (
                        <Loader2 className="text-brand size-4 shrink-0 animate-spin" />
                      )}
                    </>
                  ) : (
                    <>
                      <RoleChip role={primary} primary />
                      <span className="text-ink-faint text-[12px]">
                        {isSelf
                          ? 'You cannot change your own primary role.'
                          : 'Only a super admin can change the primary role.'}
                      </span>
                    </>
                  )}
                </div>
              </section>

              {/* Additional roles — capabilities, switched on and off */}
              <section className="mt-6">
                <h3 className="text-ink-muted text-[11px] font-semibold tracking-[0.09em] uppercase">
                  Additional roles
                </h3>
                <p className="text-ink-faint mt-1 text-[12.5px] leading-relaxed">
                  Extra work this person also does. Access adds up — an admin who also
                  holds HR Admin keeps the admin panel and gains the HR Portal.
                </p>

                {blocked ? (
                  <Note
                    pigment="neutral"
                    className="mt-3"
                    title={`${roleLabel(primary)} accounts can't hold additional roles`}
                  >
                    A {roleLabel(primary).toLowerCase()} login is a portal identity tied to
                    one person&apos;s relationship with the school. Staff access belongs on a
                    separate staff account.
                  </Note>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {rows.map(({ role, icon: Icon, unlocks }) => {
                      const isPrimary = role === primary;
                      const on = isPrimary || secondary.includes(role);
                      const busy = busyRole === role;
                      return (
                        <li
                          key={role}
                          className={cn(
                            'flex items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors',
                            isPrimary
                              ? 'border-line bg-surface-secondary'
                              : on
                                ? 'border-brand-edge bg-brand-tint/55'
                                : 'border-line bg-surface hover:border-line-strong',
                          )}
                        >
                          <span
                            className={cn(
                              'mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border',
                              on
                                ? 'border-brand-edge bg-brand/10 text-brand-deep'
                                : 'border-line bg-surface-inset text-ink-faint',
                            )}
                          >
                            <Icon className="size-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-ink text-[13.5px] font-semibold">
                                {roleLabel(role)}
                              </span>
                              {isPrimary && (
                                <span className="border-line-strong bg-surface-inset text-ink-muted rounded-full border px-1.5 py-px text-[10.5px] font-semibold tracking-wide uppercase">
                                  Primary
                                </span>
                              )}
                            </div>
                            <p className="text-ink-muted mt-0.5 text-[12px] leading-relaxed">
                              {isPrimary
                                ? 'Already held as the primary role — nothing to add.'
                                : unlocks}
                            </p>
                          </div>
                          <RoleSwitch
                            on={on}
                            busy={busy}
                            disabled={isPrimary || locked || !!busyRole || savingPrimary}
                            onToggle={() => void toggle(role, !on)}
                            label={`${roleLabel(role)} for ${shortName}`}
                            title={
                              isPrimary
                                ? 'This is already the primary role'
                                : lockTitle
                            }
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>

        {/* ── When ────────────────────────────────────────────────────── */}
        <footer className="border-line bg-surface-secondary border-t px-4 py-3.5 sm:px-6">
          {ledger.length > 0 ? (
            <Note pigment="attn" title="Takes effect at next sign-in">
              <ul className="mt-1 space-y-0.5">
                {ledger.map((entry) => (
                  <li key={entry.kind + entry.role} className="flex items-center gap-1.5">
                    <span aria-hidden className="font-mono text-[11px] opacity-70">
                      {entry.kind === 'remove' ? '-' : '+'}
                    </span>
                    <span>
                      {entry.kind === 'primary'
                        ? 'Primary role set to ' + roleLabel(entry.role)
                        : roleLabel(entry.role) +
                          (entry.kind === 'add' ? ' added' : ' removed')}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 opacity-90">
                {shortName} keeps their current access until they sign out and sign in
                again.
              </p>
            </Note>
          ) : (
            <p className="text-ink-muted flex items-start gap-2 text-[12px] leading-relaxed">
              <ShieldCheck className="text-ink-faint mt-px size-4 shrink-0" />
              Role changes are written into the sign-in token, so they reach this person
              the next time they sign in — not straight away.
            </p>
          )}
        </footer>
      </DialogContent>
    </Dialog>
  );
}
