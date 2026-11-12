import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";

// Keep App's module-level effects and weather dependencies out of the guide.
const App = lazy(() => import("./App"));
const GuidePage = lazy(() => import("./pages/GuidePage"));

export function isGuidePath(pathname: string): boolean {
  return pathname === "/guia" || pathname === "/guia/";
}

export default function Root() {
  const { t } = useTranslation();
  return (
    <Suspense fallback={<p role="status">{t("loading")}</p>}>
      {isGuidePath(window.location.pathname) ? <GuidePage /> : <App />}
    </Suspense>
  );
}
