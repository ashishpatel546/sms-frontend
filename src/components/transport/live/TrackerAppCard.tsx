"use client";

import * as React from "react";
import useSWR from "swr";
import { useTranslations } from "next-intl";
import QRCode from "react-qr-code";
import { BatteryMedium, ChevronDown, Smartphone } from "lucide-react";

import { fetchTripTracker, secondsSince } from "@/lib/transport-api";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Ago } from "./Ago";
import {
  detectPlatform,
  TRACCAR_APP_STORE_URL,
  TRACCAR_PLAY_URL,
  TRACKER_START_LINK,
  TRACKER_STOP_LINK,
  trackerSetupLink,
  type Platform,
} from "./trackerApp";

/** After a trip ends, offer "Stop tracking app" if it was sending this recently. */
const STOP_PROMPT_SECONDS = 15 * 60;

/**
 * The crew's way to keep the bus on the map with the screen locked: install
 * Traccar Client, connect it to this bus with one tap, start it. Once the
 * app reports, this turns into a green "sharing" strip (and the trip
 * screen's own sharing stands down on the server).
 */
export function TrackerAppCard({
  tripId,
  running,
}: {
  tripId: number;
  running: boolean;
}) {
  const t = useTranslations("transport.live.tracker");
  const { data } = useSWR(
    ["trip-tracker", tripId],
    () => fetchTripTracker(tripId),
    {
      refreshInterval: running ? 15_000 : 0,
    },
  );
  // Rendered only after the client fetch, so no server/client mismatch.
  const [platform] = React.useState<Platform>(detectPlatform);
  const [open, setOpen] = React.useState(false);

  if (!data) return null;
  const seenBefore = !!data.lastSeenAt;

  if (!running) {
    if (!data.lastSeenAt || secondsSince(data.lastSeenAt) > STOP_PROMPT_SECONDS)
      return null;
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink-muted">
        <Smartphone className="size-4 shrink-0" />
        <span className="min-w-0 flex-1">{t("finished")}</span>
        <a
          href={TRACKER_STOP_LINK}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          {t("stop")}
        </a>
      </div>
    );
  }

  if (data.active) {
    return (
      <div
        role="status"
        className="rounded-lg border border-accent-success-edge bg-accent-success-tint px-3 py-2 text-[13px] text-accent-success-deep"
      >
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <Smartphone className="size-4 shrink-0" />
          <span className="font-medium">{t("sharing")}</span>
          {data.lastSeenAt && (
            <span className="text-[12px]">
              · <Ago at={data.lastSeenAt} />
            </span>
          )}
          {data.battery != null && (
            <span className="tabular inline-flex items-center gap-1 text-[12px]">
              · <BatteryMedium className="size-3.5" /> {data.battery}%
            </span>
          )}
        </p>
        <p className="mt-0.5 pl-6 text-[12px]">{t("canLock")}</p>
      </div>
    );
  }

  const setup = trackerSetupLink(data.key);
  const store = platform === "ios" ? TRACCAR_APP_STORE_URL : TRACCAR_PLAY_URL;

  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2",
        seenBefore
          ? "border-accent-warn-edge bg-accent-warn-tint"
          : "border-line bg-surface",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Smartphone
          className={cn(
            "size-4 shrink-0",
            seenBefore ? "text-accent-warn-deep" : "text-ink-muted",
          )}
        />
        <p
          className={cn(
            "min-w-0 flex-1 text-[13px]",
            seenBefore ? "text-accent-warn-deep" : "text-ink",
          )}
        >
          {seenBefore
            ? `${t("notSending")} ${t("notSendingBattery")}`
            : t("pitch")}
        </p>
        {seenBefore && (
          <a
            href={TRACKER_START_LINK}
            className={cn(buttonVariants({ variant: "attn", size: "sm" }))}
          >
            {t("start")}
          </a>
        )}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={cn(
            buttonVariants({
              variant: seenBefore ? "ghost" : "outline",
              size: "sm",
            }),
          )}
        >
          {seenBefore ? t("setupAgain") : t("setup")}
          <ChevronDown
            className={cn("transition-transform", open && "rotate-180")}
          />
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-3 border-t border-line pt-3">
          <p className="text-[12.5px] text-ink-muted">{t("why")}</p>
          <ol className="space-y-3">
            <Step n={1} title={t("step1")} hint={t("step1Hint")}>
              {platform === "other" ? (
                <span className="flex flex-wrap gap-2">
                  <a
                    href={TRACCAR_PLAY_URL}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                    )}
                  >
                    {t("android")}
                  </a>
                  <a
                    href={TRACCAR_APP_STORE_URL}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                    )}
                  >
                    {t("iphone")}
                  </a>
                </span>
              ) : (
                <a
                  href={store}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                  )}
                >
                  {t("install")}
                </a>
              )}
            </Step>
            <Step
              n={2}
              title={t("step2", { vehicle: data.vehicle })}
              hint={t("step2Hint")}
            >
              {platform === "other" ? (
                <div className="w-fit rounded-md border border-line bg-white p-2">
                  <QRCode value={setup} size={148} level="M" />
                  <p className="mt-1 max-w-[148px] text-center text-[11px] text-ink-muted">
                    {t("scanHint")}
                  </p>
                </div>
              ) : (
                <a
                  href={setup}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                  )}
                >
                  {t("connect")}
                </a>
              )}
            </Step>
            <Step
              n={3}
              title={t("stepBattery")}
              hint={
                platform === "ios"
                  ? t("stepBatteryIos")
                  : t("stepBatteryAndroid")
              }
            >
              {platform === "other" && (
                <p className="text-[12px] text-ink-muted">
                  {t("stepBatteryIos")}
                </p>
              )}
            </Step>
            <Step n={4} title={t("step3")} hint={t("step3Hint")}>
              {platform !== "other" && (
                <a
                  href={TRACKER_START_LINK}
                  className={cn(
                    buttonVariants({ variant: "attn", size: "sm" }),
                  )}
                >
                  {t("start")}
                </a>
              )}
            </Step>
          </ol>
        </div>
      )}
    </div>
  );
}

function Step({
  n,
  title,
  hint,
  children,
}: {
  n: number;
  title: string;
  hint: string;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="tabular flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-inset text-[12px] font-semibold text-ink">
        {n}
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-[13.5px] font-medium text-ink">{title}</p>
        <p className="text-[12px] text-ink-muted">{hint}</p>
        {children}
      </div>
    </li>
  );
}
