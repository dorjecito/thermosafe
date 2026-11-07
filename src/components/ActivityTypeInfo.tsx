import { useRef } from "react";
import { useTranslation } from "react-i18next";

export default function ActivityTypeInfo() {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        className="activity-info-icon"
        aria-label={t("windActivity.info_label")}
        aria-haspopup="dialog"
        onClick={() => dialogRef.current?.showModal()}
      >
        ⓘ
      </button>
      <dialog
        ref={dialogRef}
        className="activity-info-dialog notifications-info-dialog"
        aria-labelledby="wind-activity-info-title"
        aria-describedby="wind-activity-info-body"
      >
        <h3 id="wind-activity-info-title">{t("windActivity.info_title")}</h3>
        <p id="wind-activity-info-body">{t("windActivity.info_body")}</p>
        <p>{t("windActivity.info_example")}</p>
        <p>{t("windActivity.info_context")}</p>
        <p>{t("windActivity.info_default")}</p>
        <button
          type="button"
          className="activity-info-close"
          onClick={() => dialogRef.current?.close()}
        >
          {t("windActivity.info_close")}
        </button>
      </dialog>
    </>
  );
}
