/**
 * Weather-provider boundary for Page 12. No approved/provider-backed weather integration exists
 * in this checkout, so the production adapter intentionally returns no measurements.
 * Do not substitute coordinates, operator notes, or deterministic placeholders for weather data.
 */
export interface WeatherUnavailable {
  readonly status: "UNAVAILABLE";
  readonly source: null;
  readonly reason: "PROVIDER_NOT_CONFIGURED";
  readonly observedAt: null;
  readonly temperatureCelsius: null;
  readonly precipitationMillimeters: null;
}

export type WeatherSnapshot = WeatherUnavailable;

export const noWeatherSnapshot: WeatherSnapshot = {
  status: "UNAVAILABLE",
  source: null,
  reason: "PROVIDER_NOT_CONFIGURED",
  observedAt: null,
  temperatureCelsius: null,
  precipitationMillimeters: null,
};

export interface WeatherAdapter {
  currentForSite(input: { organizationId: string; sellingLocationId: string }): Promise<WeatherSnapshot>;
}

export const unavailableWeatherAdapter: WeatherAdapter = {
  async currentForSite() {
    return noWeatherSnapshot;
  },
};
