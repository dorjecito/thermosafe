import { useState } from "react";

type Params = {
  t: any;
  city: string | null;
  realCity: string | null;
  pushEnabled: boolean;
  enableColdAlerts: boolean;
  enableWindAlerts: boolean;
  enableUvAlerts: boolean;
  dataSource: "gps" | "search" | null;
};

export function useRiskNotifications({
  t: _t,
  city: _city,
  realCity: _realCity,
  pushEnabled: _pushEnabled,
  enableColdAlerts: _enableColdAlerts,
  enableWindAlerts: _enableWindAlerts,
  enableUvAlerts: _enableUvAlerts,
  dataSource: _dataSource,
}: Params) {
  const [msgHeat, setMsgHeat] = useState<string | null>(null);

  async function maybeNotifyCold(temp: number, windKmh: number) {
    void temp;
    void windKmh;
  }

  async function maybeNotifyWind(kmh: number) {
    void kmh;
  }

  async function maybeNotifyUV(uvi: number | null) {
    void uvi;
  }

  async function maybeNotifyHeat(hi: number | null) {
    void hi;
  }

  return {
    maybeNotifyCold,
    maybeNotifyWind,
    maybeNotifyUV,
    maybeNotifyHeat,
    msgHeat,
    setMsgHeat,
  };
}
