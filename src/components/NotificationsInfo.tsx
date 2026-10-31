import { useRef } from "react";
import { useTranslation } from "react-i18next";

export default function NotificationsInfo() {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        className="activity-info-icon notifications-info-icon"
        aria-label={t("notifications.info_label")}
        aria-haspopup="dialog"
        onClick={() => dialogRef.current?.showModal()}
      >
        ⓘ
      </button>
      <dialog
        ref={dialogRef}
        className="activity-info-dialog notifications-info-dialog"
        aria-labelledby="notifications-info-title"
        aria-describedby="notifications-info-body"
      >
        <h3 id="notifications-info-title">{t("notifications.info_title")}</h3>
        <p id="notifications-info-body">{t("notifications.info_body")}</p>
        <button
          type="button"
          className="activity-info-close"
          onClick={() => dialogRef.current?.close()}
        >
          {t("notifications.info_close")}
        </button>
      </dialog>
    </>
  );
}
