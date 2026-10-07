"use client";

import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useLocale, useTranslations } from "next-intl";
import {
  ChevronDown,
  Globe,
  LifeBuoy,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  School,
} from "lucide-react";
import { getUser } from "@/lib/auth";
import { useSchoolInfo } from "@/lib/useSchoolInfo";
import { PageBody, PageHeader, PageShell } from "@/components/ui/PageHeader";
import { Panel, PanelBody, PanelHeader, Note } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/Field";
import { usePullToRefresh } from "@/components/ui/PullToRefresh";

/**
 * HELP FOR A PARENT
 *
 * A parent has two different people to reach, and confusing them wastes
 * everyone's time: the **school office** answers everything about their child
 * (fees, attendance, a wrong phone number), while **app support** only handles
 * the software itself. So the school's own contact details come first and the
 * WhatsApp line to us sits underneath, named for what it is.
 *
 * Every school detail is read from the resolved tenant (`GET /school/info`) —
 * one deployment serves every school, so nothing here can be hard-coded.
 */

/** Platform (not school) support — the software vendor's line. */
const APP_SUPPORT_NUMBER = "7838160389";
const APP_SUPPORT_EMAIL = "support@colegios.in";

interface Faq {
  question: string;
  answer: string;
}

export default function ParentSupportPage() {
  const t = useTranslations("parent.support");
  const tc = useTranslations("common");
  const tp = useTranslations("product");
  const locale = useLocale();
  const schoolInfo = useSchoolInfo();
  const [user, setUser] = useState<any>(null);
  const [issue, setIssue] = useState("");
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Parents get their own FAQ set — the staff list is written for people with
  // a sidebar full of admin menus they cannot see.
  // Hindi and Bengali have their own file; English is the fallback if it fails.
  const loadFaqs = useCallback(() => {
    const loadFaqFile = (url: string) =>
      fetch(url).then((res) => {
        if (!res.ok) throw new Error("Failed to load FAQs");
        return res.json();
      });
    const request =
      locale === "hi" || locale === "bn"
        ? loadFaqFile(`/faq-parent.${locale}.json`).catch(() =>
            loadFaqFile("/faq-parent.json"),
          )
        : loadFaqFile("/faq-parent.json");
    return request
      .then((data: Faq[]) => setFaqs(data))
      .catch(() => setFaqs([]));
  }, [locale]);

  useEffect(() => {
    setUser(getUser());
    void loadFaqs();
  }, [loadFaqs]);

  // A cached page can be showing yesterday's FAQ file; the pull that refreshes
  // every other parent screen refreshes this one too.
  usePullToRefresh(loadFaqs);

  const schoolName = schoolInfo?.name ?? "";
  const parentName = user
    ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
    : "";
  const hasSchoolContact = !!(schoolInfo?.phone || schoolInfo?.email);

  const openAppSupportChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!issue.trim()) return;

    const message =
      `Hello, I need help with the parent app.\n\n` +
      `*Name:* ${parentName || "N/A"}\n` +
      `*Mobile:* ${user?.mobile || "N/A"}\n` +
      `*School:* ${schoolName || "N/A"}\n` +
      `*Role:* Parent\n\n` +
      `*Issue Details:*\n${issue}`;

    window.open(
      `https://wa.me/91${APP_SUPPORT_NUMBER}?text=${encodeURIComponent(message)}`,
      "_blank",
    );
  };

  return (
    <PageShell measure="reading">
      <PageHeader
        section={tp("module.parentPortal")}
        title={t("title")}
        description={t("description")}
      />

      <PageBody>
        {/* ── The school office — the right answer to almost every question ── */}
        <Panel>
          <PanelHeader
            title={schoolName ? t("contactSchool", { school: schoolName }) : t("contactYourSchool")}
            description={t("contactDescription")}
          />
          {hasSchoolContact || schoolInfo?.address ? (
            <PanelBody className="space-y-2.5">
              {schoolInfo?.phone && (
                <ContactRow
                  icon={<Phone />}
                  label={t("callOffice")}
                  value={schoolInfo.phone}
                  href={`tel:${schoolInfo.phone.replace(/\s/g, "")}`}
                />
              )}
              {schoolInfo?.email && (
                <ContactRow
                  icon={<Mail />}
                  label={t("emailOffice")}
                  value={schoolInfo.email}
                  href={`mailto:${schoolInfo.email}`}
                />
              )}
              {schoolInfo?.website && (
                <ContactRow
                  icon={<Globe />}
                  label={t("website")}
                  value={schoolInfo.website.replace(/^https?:\/\//, "")}
                  href={
                    schoolInfo.website.startsWith("http")
                      ? schoolInfo.website
                      : `https://${schoolInfo.website}`
                  }
                />
              )}
              {schoolInfo?.address && (
                <ContactRow
                  icon={<MapPin />}
                  label={tc("field.address")}
                  value={schoolInfo.address}
                />
              )}
            </PanelBody>
          ) : (
            <EmptyState
              compact
              icon={<School />}
              title={t("noContactTitle")}
              description={
                schoolInfo
                  ? t("noContactDescription")
                  : t("loadingSchool")
              }
            />
          )}
        </Panel>

        {/* ── FAQs ─────────────────────────────────────────────────────────── */}
        <Panel>
          <PanelHeader
            title={t("faqTitle")}
            description={t("faqDescription")}
          />
          {faqs.length === 0 ? (
            <EmptyState
              compact
              title={t("faqFailedTitle")}
              description={t("faqFailedDescription")}
            />
          ) : (
            <div className="divide-y divide-line">
              {faqs.map((faq, index) => {
                const open = openFaq === index;
                return (
                  <div key={index}>
                    <button
                      type="button"
                      onClick={() => setOpenFaq(open ? null : index)}
                      aria-expanded={open}
                      className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-secondary"
                    >
                      <span className="text-[13.5px] font-semibold text-ink">
                        {faq.question}
                      </span>
                      <ChevronDown
                        aria-hidden
                        className={`size-4 shrink-0 text-ink-faint transition-transform duration-200 ${
                          open ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {open && (
                      <div className="px-4 pb-4 text-[13px] leading-relaxed text-ink-muted [&_strong]:font-semibold [&_strong]:text-ink">
                        <ReactMarkdown>{faq.answer}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        {/* ── App support — the vendor, not the school ─────────────────────── */}
        <Panel>
          <PanelHeader
            title={t("appTitle")}
            description={t("appDescription")}
          />
          <PanelBody className="space-y-4">
            <Note pigment="info" icon={<LifeBuoy />}>
              {t("appNote")}
            </Note>

            <div className="rounded-lg border border-line bg-surface-secondary px-4 py-3">
              <p className="eyebrow mb-2">{t("sentWith")}</p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
                <dt className="text-ink-muted">{tc("field.name")}</dt>
                <dd className="text-right font-medium text-ink">
                  {parentName || "—"}
                </dd>
                <dt className="text-ink-muted">{tc("field.mobile")}</dt>
                <dd className="text-right font-medium text-ink">
                  {user?.mobile || "—"}
                </dd>
                <dt className="text-ink-muted">{t("school")}</dt>
                <dd className="text-right font-medium text-ink">
                  {schoolName || "—"}
                </dd>
              </dl>
            </div>

            <form onSubmit={openAppSupportChat} className="space-y-4">
              <Field
                label={t("issueLabel")}
                htmlFor="parent-support-issue"
                required
                hint={t("issueHint")}
              >
                <Textarea
                  id="parent-support-issue"
                  required
                  rows={5}
                  value={issue}
                  onChange={(e) => setIssue(e.target.value)}
                  placeholder={t("issuePlaceholder")}
                />
              </Field>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="submit" block className="sm:w-auto sm:flex-1">
                  <MessageCircle />
                  {t("sendWhatsapp")}
                </Button>
                <Button
                  variant="outline"
                  block
                  className="sm:w-auto"
                  render={<a href={`mailto:${APP_SUPPORT_EMAIL}`} />}
                >
                  <Mail />
                  {t("emailInstead")}
                </Button>
              </div>
              <p className="text-[12px] text-ink-muted">
                {t("whatsappNote", { email: APP_SUPPORT_EMAIL })}
              </p>
            </form>
          </PanelBody>
        </Panel>
      </PageBody>
    </PageShell>
  );
}

/** One reachable contact line: icon, what it is, and the value as a live link. */
function ContactRow({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-line bg-surface-secondary px-3.5 py-3">
      <span className="mt-0.5 shrink-0 text-brand [&_svg]:size-4">{icon}</span>
      <div className="min-w-0">
        <p className="eyebrow">{label}</p>
        {href ? (
          <a
            href={href}
            className="mt-0.5 block text-[13.5px] font-medium break-words text-brand hover:underline"
          >
            {value}
          </a>
        ) : (
          <p className="mt-0.5 text-[13.5px] break-words text-ink">{value}</p>
        )}
      </div>
    </div>
  );
}
