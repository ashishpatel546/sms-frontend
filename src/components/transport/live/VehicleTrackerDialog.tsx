"use client";

import * as React from "react";
import useSWR from "swr";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import QRCode from "react-qr-code";
import { BatteryMedium, Copy } from "lucide-react";

import {
  errorMessage,
  fetchVehicleTracker,
  revokeVehicleTracker,
  rotateVehicleTracker,
  type Vehicle,
  vehicleName,
} from "@/lib/transport-api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusChip } from "@/components/ui/StatusChip";
import { Ago } from "./Ago";
import { useCrewAppRelease } from "./crewApp";
import {
  TRACCAR_APP_STORE_URL,
  TRACCAR_PLAY_URL,
  trackerServerUrl,
  trackerSetupLink,
} from "./trackerApp";

/**
 * Manager view of a bus's tracking app (Traccar Client): is it reporting,
 * the setup QR for a crew phone, and a new key / disconnect for a lost phone
 * or a crew change. Opening it issues the key if the bus has none yet.
 */
export function VehicleTrackerDialog({
  vehicle,
  onClose,
}: {
  vehicle: Vehicle;
  onClose: () => void;
}) {
  const t = useTranslations("transport.live.tracker");
  const tc = useTranslations("common");
  const { data, error, mutate } = useSWR(
    ["vehicle-tracker", vehicle.id],
    () => fetchVehicleTracker(vehicle.id),
    {
      refreshInterval: 15_000,
    },
  );
  const [busy, setBusy] = React.useState(false);
  const release = useCrewAppRelease();
  const [appLink, setAppLink] = React.useState("");
  React.useEffect(() => {
    queueMicrotask(() => setAppLink(`${window.location.origin}/crew-app`));
  }, []);

  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await fn();
      await mutate();
      toast.success(done);
    } catch (e) {
      toast.error(errorMessage(e, t("failed")));
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("copied"));
    } catch {
      toast.error(t("failed"));
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t("dialogTitle", { vehicle: vehicleName(vehicle) })}
          </DialogTitle>
        </DialogHeader>

        {error ? (
          <p className="text-[13px] text-accent-danger-deep">
            {errorMessage(error, t("failed"))}
          </p>
        ) : !data ? (
          <div className="skeleton h-48 w-full rounded-lg" />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              {data.active ? (
                <StatusChip
                  pigment="success"
                  size="sm"
                  label={t("statusSharing")}
                />
              ) : data.lastSeenAt ? (
                <StatusChip
                  pigment="neutral"
                  size="sm"
                  label={t("statusIdle")}
                />
              ) : (
                <StatusChip pigment="attn" size="sm" label={t("statusNever")} />
              )}
              {data.lastSeenAt && (
                <Ago at={data.lastSeenAt} stale={!data.active} />
              )}
              {data.battery != null && (
                <span className="tabular inline-flex items-center gap-1 text-ink-muted">
                  <BatteryMedium className="size-3.5" /> {data.battery}%
                </span>
              )}
            </div>

            {release && appLink && (
              <div className="rounded-md border border-line bg-surface-sunk px-3 py-2 text-[13px]">
                <p className="text-ink">{t("dialogOwnApp")}</p>
                <p className="mt-1 flex items-center gap-1">
                  <a
                    href="/crew-app"
                    target="_blank"
                    rel="noreferrer"
                    className="tabular min-w-0 break-all text-brand underline-offset-4 hover:underline"
                  >
                    {appLink}
                  </a>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={t("copy")}
                    onClick={() => copy(appLink)}
                  >
                    <Copy />
                  </Button>
                </p>
              </div>
            )}

            <p className="text-[13px] text-ink-muted">{t("dialogIntro")}</p>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="w-fit shrink-0 rounded-md border border-line bg-white p-2">
                <QRCode
                  value={trackerSetupLink(data.key)}
                  size={160}
                  level="M"
                />
              </div>
              <ol className="list-decimal space-y-1.5 pl-5 text-[13px] text-ink">
                <li>
                  {t("dialogStep1")}{" "}
                  <a
                    className="text-brand underline-offset-4 hover:underline"
                    href={TRACCAR_PLAY_URL}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("android")}
                  </a>{" "}
                  ·{" "}
                  <a
                    className="text-brand underline-offset-4 hover:underline"
                    href={TRACCAR_APP_STORE_URL}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("iphone")}
                  </a>
                </li>
                <li>{t("dialogStep2")}</li>
                <li>{t("dialogStepBattery")}</li>
                <li>{t("dialogStep3")}</li>
              </ol>
            </div>

            <details className="rounded-md border border-line px-3 py-2 text-[12.5px]">
              <summary className="cursor-pointer text-ink-muted">
                {t("manual")}
              </summary>
              <dl className="mt-2 grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1.5">
                <dt className="text-ink-muted">{t("serverUrl")}</dt>
                <dd className="tabular min-w-0 break-all text-ink">
                  {trackerServerUrl()}
                </dd>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t("copy")}
                  onClick={() => copy(trackerServerUrl())}
                >
                  <Copy />
                </Button>
                <dt className="text-ink-muted">{t("deviceId")}</dt>
                <dd className="tabular min-w-0 break-all text-ink">
                  {data.key}
                </dd>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t("copy")}
                  onClick={() => copy(data.key)}
                >
                  <Copy />
                </Button>
              </dl>
            </details>
          </div>
        )}

        <DialogFooter className="mt-4 flex-wrap gap-2">
          {data && (
            <>
              <Button
                variant="destructive"
                disabled={busy}
                onClick={() => {
                  if (window.confirm(t("disconnectConfirm"))) {
                    void run(async () => {
                      await revokeVehicleTracker(vehicle.id);
                      onClose();
                    }, t("disconnected"));
                  }
                }}
              >
                {t("disconnect")}
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  if (window.confirm(t("newKeyConfirm")))
                    void run(
                      () => rotateVehicleTracker(vehicle.id),
                      t("newKeyDone"),
                    );
                }}
              >
                {t("newKey")}
              </Button>
            </>
          )}
          <Button variant="ghost" onClick={onClose}>
            {tc("action.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
